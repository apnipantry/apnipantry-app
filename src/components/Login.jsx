import { useState } from 'react'
import { signInWithEmail, signUpWithEmail, supabase } from '../lib/supabase'

export default function Login({ inviteInfo }) {
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [mode, setMode]       = useState('login') // login | signup | forgot
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(false)

  const configOk = import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes('your-project-id')

  function switchMode(newMode) {
    setMode(newMode)
    setEmail('')
    setPass('')
    setStatus(null)
  }

  async function handleSubmit() {
    if (!email || (mode !== 'forgot' && !password)) {
      setStatus({ type:'error', msg:'Please fill in all fields.' })
      return
    }
    if (mode !== 'forgot' && password.length < 6) {
      setStatus({ type:'error', msg:'Password must be at least 6 characters.' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)

      } else if (mode === 'signup') {
        const result = await signUpWithEmail(email, password)
        if (!result?.session) {
          setStatus({ type:'success',
            msg:'Account created! Check your email for a confirmation link, then sign in.' })
        }

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setStatus({ type:'success',
          msg:'Password reset link sent! Check your email. The link expires in 1 hour.' })
      }
    } catch (e) {
      const msg = e.message || ''
      if (msg.includes('Invalid login credentials')) {
        setStatus({ type:'error', msg:'Wrong email or password.' })
      } else if (msg.includes('User already registered')) {
        setStatus({ type:'error', msg:'This email already has an account.' })
        switchMode('login')
      } else if (msg.includes('Email not confirmed')) {
        setStatus({ type:'error', msg:'Please confirm your email first — check your inbox.' })
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setStatus({ type:'error', msg:'Cannot reach Supabase. Check .env.local and restart.' })
      } else {
        setStatus({ type:'error', msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>

        {!configOk && (
          <div style={S.warn}>
            ⚠️ Supabase not configured. Check .env.local and restart.
          </div>
        )}

        {/* Invite banner */}
        {inviteInfo?.valid && (
          <div style={S.inviteBanner}>
            <div>
              <div style={S.inviteLabel}>You've been invited to join</div>
              <div style={S.inviteHousehold}>{inviteInfo.household_name}</div>
            </div>
          </div>
        )}

        {/* Logo */}
        <div style={S.logo}>
          <div style={S.logoMark}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 8h16M5 8V6a2 2 0 012-2h8a2 2 0 012 2v2M5 8l1.2 12h9.6L17 8"
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 13v4M13 13v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={S.name}>Apni Pantry</div>
            <div style={S.tag}>All taken care of</div>
          </div>
        </div>

        {/* Mode tabs — only for login/signup */}
        {mode !== 'forgot' && (
          <div style={S.tabs}>
            <button style={{...S.tab, ...(mode==='login' ? S.tabActive : {})}}
              onClick={() => switchMode('login')}>Sign in</button>
            <button style={{...S.tab, ...(mode==='signup' ? S.tabActive : {})}}
              onClick={() => switchMode('signup')}>Create account</button>
          </div>
        )}

        {mode === 'forgot' && (
          <div style={S.forgotHeader}>
            <div style={S.forgotTitle}>Reset password</div>
            <div style={S.forgotSub}>
              Enter your email and we'll send a reset link.
            </div>
          </div>
        )}

        {/* Email field — always shown */}
        <input
          key={`email-${mode}`}
          style={S.input}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete={mode === 'login' ? 'email' : 'off'}
          autoFocus
        />

        {/* Password field — only for login/signup */}
        {mode !== 'forgot' && (
          <input
            key={`password-${mode}`}
            style={S.input}
            type="password"
            placeholder={mode === 'login'
              ? 'Password'
              : 'Create a password (min 6 characters)'}
            value={password}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        )}

        {/* Forgot password link — only on login mode */}
        {mode === 'login' && (
          <div style={S.forgotLink} onClick={() => switchMode('forgot')}>
            Forgot password?
          </div>
        )}

        {/* Status message */}
        {status && (
          <div style={status.type === 'error' ? S.error : S.success}>
            {status.msg}
          </div>
        )}

        <button
          style={{...S.btn, opacity: (loading || !configOk) ? 0.6 : 1}}
          onClick={handleSubmit}
          disabled={loading || !configOk}>
          {loading ? 'Please wait...' :
           mode === 'login' ? 'Sign in' :
           mode === 'signup' ? 'Create account' :
           'Send reset link'}
        </button>

        {/* Back to login from forgot */}
        {mode === 'forgot' && (
          <div style={S.backRow}>
            <span style={S.backLink} onClick={() => switchMode('login')}>
              ← Back to sign in
            </span>
          </div>
        )}

      </div>
    </div>
  )
}

const S = {
  page:           { minHeight:'100vh', display:'flex', alignItems:'center',
                    justifyContent:'center', padding:'1rem', background:'#FDFAF5' },
  card:           { width:'100%', maxWidth:'380px', background:'white',
                    border:'0.5px solid rgba(45,106,79,0.15)',
                    borderRadius:'12px', padding:'2rem' },
  warn:           { fontSize:'12px', background:'#FEF9E7', border:'1px solid #F9E79F',
                    borderRadius:'8px', padding:'10px 12px', marginBottom:'1rem',
                    color:'#7D6608', lineHeight:'1.6' },
  inviteBanner:   { background:'#EAF3DE', border:'1px solid #95D5B2',
                    borderRadius:'10px', padding:'10px 14px', marginBottom:'1.25rem' },
  inviteLabel:    { fontSize:'11px', color:'#52B788', textTransform:'uppercase',
                    letterSpacing:'0.05em', marginBottom:'3px' },
  inviteHousehold:{ fontSize:'15px', fontWeight:'600', color:'#1A2E22' },
  logo:           { display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.5rem' },
  logoMark:       { width:'40px', height:'40px', background:'#2D6A4F', borderRadius:'10px',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  name:           { fontSize:'18px', fontWeight:'600', color:'#2D6A4F' },
  tag:            { fontSize:'11px', color:'#8FAF9F' },
  tabs:           { display:'flex', border:'0.5px solid rgba(45,106,79,0.2)',
                    borderRadius:'8px', overflow:'hidden', marginBottom:'1.25rem' },
  tab:            { flex:1, padding:'9px', fontSize:'13px', background:'transparent',
                    border:'none', color:'#8FAF9F', cursor:'pointer', fontFamily:'inherit' },
  tabActive:      { background:'#2D6A4F', color:'white' },
  forgotHeader:   { marginBottom:'1.25rem' },
  forgotTitle:    { fontSize:'16px', fontWeight:'500', color:'#1A2E22', marginBottom:'4px' },
  forgotSub:      { fontSize:'13px', color:'#8FAF9F', lineHeight:'1.5' },
  input:          { width:'100%', padding:'10px 12px',
                    border:'0.5px solid rgba(45,106,79,0.2)', borderRadius:'8px',
                    fontSize:'14px', marginBottom:'10px', outline:'none',
                    color:'#1A2E22', display:'block', fontFamily:'inherit' },
  forgotLink:     { fontSize:'12px', color:'#2D6A4F', cursor:'pointer',
                    textAlign:'right', marginTop:'-4px', marginBottom:'12px' },
  error:          { fontSize:'13px', color:'#922B21', background:'#FCEBEB',
                    border:'1px solid #F09595', borderRadius:'8px',
                    padding:'8px 12px', marginBottom:'10px', lineHeight:'1.6' },
  success:        { fontSize:'13px', color:'#1A5276', background:'#EBF5FB',
                    border:'1px solid #AED6F1', borderRadius:'8px',
                    padding:'8px 12px', marginBottom:'10px', lineHeight:'1.6' },
  btn:            { width:'100%', padding:'11px', background:'#2D6A4F', color:'white',
                    border:'none', borderRadius:'8px', fontSize:'14px',
                    fontWeight:'500', cursor:'pointer', fontFamily:'inherit' },
  backRow:        { textAlign:'center', marginTop:'12px' },
  backLink:       { fontSize:'12px', color:'#8FAF9F', cursor:'pointer' },
}
