// Setup.jsx — handles both create household and join via invite.
// Also handles the "lost invite" case — user can paste a new invite link.
import { useState } from 'react'
import { setupHousehold, joinHousehold, getMyProfile, signOut, validateInvite } from '../lib/supabase'

export default function Setup({ inviteInfo: initialInvite, onDone }) {
  const [inviteInfo, setInviteInfo]   = useState(initialInvite)
  const [mode, setMode]               = useState(
    initialInvite ? 'join' : 'choose'   // choose = pick create or join
  )

  // Create flow state
  const [step, setStep]       = useState(1)
  const [hName, setHName]     = useState('')
  const [uName, setUName]     = useState('')
  const [role, setRole]       = useState('parent')

  // Join flow state
  const [joinName, setJoinName]       = useState('')
  const [inviteLink, setInviteLink]   = useState('')
  const [validating, setValidating]   = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // ── Validate a pasted invite link ───────────────────────────
  async function handleValidateLink() {
    setError('')
    setValidating(true)
    try {
      // Extract UUID from pasted URL or raw UUID
      const match = inviteLink.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)
      if (!match) throw new Error('Invalid invite link format. Paste the full link you received.')
      const token = match[0]
      const result = await validateInvite(token)
      if (!result?.valid) throw new Error(result?.reason || 'Invite is invalid or expired.')
      // Store and use it
      sessionStorage.setItem('apnipantry_invite', JSON.stringify(result))
      setInviteInfo(result)
      setMode('join')
    } catch (e) {
      setError(e.message)
    } finally {
      setValidating(false)
    }
  }

  // ── Join household ───────────────────────────────────────────
  async function handleJoin() {
    if (!joinName.trim()) return
    setLoading(true)
    setError('')
    try {
      // invite_id is returned by validate_invite RPC
      // fall back to id if stored differently
      const token = inviteInfo.invite_id || inviteInfo.id || inviteInfo.household_id
      console.log('[Apni Pantry] Joining with token:', token, '| inviteInfo:', JSON.stringify(inviteInfo))
      if (!token) throw new Error('Invite token missing. Please paste the invite link again.')
      await joinHousehold({ inviteId: token, userName: joinName.trim() })
      const profile = await getMyProfile()
      if (!profile) throw new Error('Could not load profile after joining.')
      onDone(profile)
    } catch (e) {
      if (e.message?.includes('duplicate') || e.message?.includes('users_pkey')) {
        // Profile already exists — just load it
        try {
          const profile = await getMyProfile()
          if (profile) { onDone(profile); return }
        } catch {}
      }
      setError(e.message || 'Something went wrong.')
      setLoading(false)
    }
  }

  // ── Create household ─────────────────────────────────────────
  async function handleCreate() {
    if (!hName.trim() || !uName.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await setupHousehold({
        householdName: hName.trim(),
        userName: uName.trim(),
        role,
      })
      if (result?.already_existed) {
        const profile = await getMyProfile()
        if (profile) { onDone(profile); return }
      }
      const profile = await getMyProfile()
      if (!profile) throw new Error('Could not load profile. Please sign out and try again.')
      onDone(profile)
    } catch (e) {
      if (e.message?.includes('duplicate') || e.message?.includes('users_pkey')) {
        try {
          const profile = await getMyProfile()
          if (profile) { onDone(profile); return }
        } catch {}
        setError('Account already set up. Sign out and sign back in.')
      } else {
        setError(e.message || 'Something went wrong.')
      }
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Logo />

        {/* ── Mode: choose create or join ── */}
        {mode === 'choose' && (
          <>
            <h2 style={S.heading}>Welcome to Apni Pantry</h2>
            <p style={S.sub}>Do you want to create a new household or join an existing one?</p>
            <div style={S.choiceGrid}>
              <div style={S.choiceCard} onClick={() => setMode('create')}>
                <div style={S.choiceIcon}>🏠</div>
                <div style={S.choiceTitle}>Create household</div>
                <div style={S.choiceDesc}>Start fresh — set up your family pantry</div>
              </div>
              <div style={S.choiceCard} onClick={() => setMode('paste-invite')}>
                <div style={S.choiceIcon}>🔗</div>
                <div style={S.choiceTitle}>Join household</div>
                <div style={S.choiceDesc}>Paste an invite link from your family</div>
              </div>
            </div>
            <div style={S.escape}>
              Wrong account? <span style={S.escapeLink} onClick={signOut}>Sign out</span>
            </div>
          </>
        )}

        {/* ── Mode: paste invite link ── */}
        {mode === 'paste-invite' && (
          <>
            <h2 style={S.heading}>Join a household</h2>
            <p style={S.sub}>Paste the invite link you received from your family member.</p>
            <input style={S.input}
              placeholder="https://apnipantry.com/join/..."
              value={inviteLink}
              onChange={e => { setInviteLink(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && inviteLink.trim() && handleValidateLink()}
              autoFocus/>
            {error && <div style={S.error}>{error}</div>}
            <button style={{ ...S.btn, opacity: (inviteLink.trim() && !validating) ? 1 : 0.5 }}
              disabled={!inviteLink.trim() || validating}
              onClick={handleValidateLink}>
              {validating ? 'Checking...' : 'Continue →'}
            </button>
            <div style={S.backRow}>
              <span style={S.backLink} onClick={() => { setMode('choose'); setError('') }}>
                ← Back
              </span>
            </div>
          </>
        )}

        {/* ── Mode: join (invite validated) ── */}
        {mode === 'join' && inviteInfo && (
          <>
            <div style={S.inviteBanner}>
              <div style={S.inviteIcon}>🏠</div>
              <div>
                <div style={S.inviteLabel}>You've been invited to join</div>
                <div style={S.inviteHousehold}>{inviteInfo.household_name}</div>
                <div style={S.inviteRole}>
                  Joining as: <strong>{inviteInfo.role}</strong>
                </div>
              </div>
            </div>
            <p style={S.sub}>Just enter your name to get started.</p>
            <input style={S.input}
              placeholder="Your name (e.g. Kaveri)"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinName.trim() && handleJoin()}
              autoFocus/>
            {error && (
              <div style={S.error}>
                {error}
                {error.includes('expired') && (
                  <div style={{ marginTop:'6px' }}>
                    <span style={S.escapeLink}
                      onClick={() => { setMode('paste-invite'); setError(''); setInviteInfo(null) }}>
                      Paste a new invite link →
                    </span>
                  </div>
                )}
              </div>
            )}
            <button style={{ ...S.btn, opacity: (joinName.trim() && !loading) ? 1 : 0.5 }}
              disabled={!joinName.trim() || loading}
              onClick={handleJoin}>
              {loading ? 'Joining...' : 'Join household →'}
            </button>
            <div style={S.escape}>
              Wrong account? <span style={S.escapeLink} onClick={signOut}>Sign out</span>
            </div>
          </>
        )}

        {/* ── Mode: create — step 1 ── */}
        {mode === 'create' && step === 1 && (
          <>
            <div style={S.stepLine}>Step 1 of 2</div>
            <h2 style={S.heading}>Name your household</h2>
            <p style={S.sub}>This is what your family will see when they join.</p>
            <input style={S.input}
              placeholder="e.g. Sharma Family, Apni Ghar"
              value={hName}
              onChange={e => setHName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && hName.trim() && setStep(2)}
              autoFocus/>
            <button style={{ ...S.btn, opacity: hName.trim() ? 1 : 0.5 }}
              disabled={!hName.trim()} onClick={() => setStep(2)}>
              Continue →
            </button>
            <div style={S.backRow}>
              <span style={S.backLink} onClick={() => setMode('choose')}>← Back</span>
            </div>
          </>
        )}

        {/* ── Mode: create — step 2 ── */}
        {mode === 'create' && step === 2 && (
          <>
            <div style={S.stepLine}>Step 2 of 2</div>
            <h2 style={S.heading}>About you</h2>
            <p style={S.sub}>Your name and role in the household.</p>
            <input style={S.input}
              placeholder="Your name (e.g. Himanshu)"
              value={uName}
              onChange={e => setUName(e.target.value)}
              autoFocus/>
            <div style={S.roleGrid}>
              {[
                { value:'parent', title:'Parent',
                  desc:'Add items, manage cart, place orders' },
                { value:'member', title:'Member',
                  desc:'View list and request items' },
              ].map(r => (
                <div key={r.value}
                  style={{ ...S.roleCard, ...(role===r.value ? S.roleActive : {}) }}
                  onClick={() => setRole(r.value)}>
                  <div style={S.roleTitle}>{r.title}</div>
                  <div style={S.roleDesc}>{r.desc}</div>
                </div>
              ))}
            </div>
            {error && (
              <div style={S.error}>
                {error}
                {error.includes('sign out') && (
                  <div style={{ marginTop:'6px' }}>
                    <span style={S.escapeLink} onClick={signOut}>Sign out →</span>
                  </div>
                )}
              </div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={S.btnBack}
                onClick={() => { setStep(1); setError('') }}>← Back</button>
              <button style={{ ...S.btn, flex:1,
                               opacity: (uName.trim() && !loading) ? 1 : 0.5 }}
                disabled={!uName.trim() || loading}
                onClick={handleCreate}>
                {loading ? 'Setting up...' : 'Get started'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1.5rem' }}>
      <div style={{ width:'36px', height:'36px', background:'#2D6A4F',
                    borderRadius:'9px', display:'flex',
                    alignItems:'center', justifyContent:'center' }}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <path d="M3 8h16M5 8V6a2 2 0 012-2h8a2 2 0 012 2v2M5 8l1.2 12h9.6L17 8"
            stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 13v4M13 13v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <span style={{ fontSize:'16px', fontWeight:'600', color:'#2D6A4F' }}>Apni Pantry</span>
    </div>
  )
}

const S = {
  page:          { minHeight:'100vh', display:'flex', alignItems:'center',
                   justifyContent:'center', padding:'1rem', background:'#FDFAF5' },
  card:          { width:'100%', maxWidth:'400px', background:'white',
                   border:'0.5px solid rgba(45,106,79,0.15)',
                   borderRadius:'12px', padding:'2rem' },
  heading:       { fontSize:'18px', fontWeight:'500', color:'#1A2E22', marginBottom:'6px' },
  sub:           { fontSize:'13px', color:'#4A6357', marginBottom:'1.25rem', lineHeight:'1.5' },
  stepLine:      { fontSize:'11px', color:'#8FAF9F', textTransform:'uppercase',
                   letterSpacing:'1px', marginBottom:'0.75rem' },
  choiceGrid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'1rem' },
  choiceCard:    { padding:'1rem', border:'1px solid rgba(45,106,79,0.15)',
                   borderRadius:'10px', cursor:'pointer', textAlign:'center' },
  choiceIcon:    { fontSize:'24px', marginBottom:'6px' },
  choiceTitle:   { fontSize:'13px', fontWeight:'500', color:'#1A2E22', marginBottom:'4px' },
  choiceDesc:    { fontSize:'11px', color:'#8FAF9F', lineHeight:'1.4' },
  inviteBanner:  { display:'flex', gap:'12px', alignItems:'flex-start',
                   background:'#EAF3DE', border:'1px solid #95D5B2',
                   borderRadius:'10px', padding:'12px 14px', marginBottom:'1.25rem' },
  inviteIcon:    { fontSize:'20px', flexShrink:0 },
  inviteLabel:   { fontSize:'11px', color:'#52B788', textTransform:'uppercase',
                   letterSpacing:'0.05em', marginBottom:'3px' },
  inviteHousehold:{ fontSize:'16px', fontWeight:'600', color:'#1A2E22', marginBottom:'3px' },
  inviteRole:    { fontSize:'12px', color:'#4A6357' },
  input:         { width:'100%', padding:'10px 12px',
                   border:'0.5px solid rgba(45,106,79,0.2)', borderRadius:'8px',
                   fontSize:'14px', marginBottom:'12px', outline:'none',
                   color:'#1A2E22', display:'block', fontFamily:'inherit' },
  roleGrid:      { display:'grid', gridTemplateColumns:'1fr 1fr',
                   gap:'8px', marginBottom:'16px' },
  roleCard:      { padding:'12px', border:'0.5px solid rgba(45,106,79,0.15)',
                   borderRadius:'8px', cursor:'pointer' },
  roleActive:    { border:'1.5px solid #2D6A4F', background:'#EAF3DE' },
  roleTitle:     { fontSize:'13px', fontWeight:'500', color:'#1A2E22', marginBottom:'4px' },
  roleDesc:      { fontSize:'11px', color:'#8FAF9F', lineHeight:'1.4' },
  error:         { fontSize:'13px', color:'#922B21', background:'#FCEBEB',
                   border:'1px solid #F09595', borderRadius:'8px',
                   padding:'8px 12px', marginBottom:'12px', lineHeight:'1.6' },
  btn:           { width:'100%', padding:'11px', background:'#2D6A4F', color:'white',
                   border:'none', borderRadius:'8px', fontSize:'14px',
                   fontWeight:'500', cursor:'pointer', fontFamily:'inherit' },
  btnBack:       { padding:'11px 16px', background:'transparent', color:'#4A6357',
                   border:'0.5px solid rgba(45,106,79,0.2)', borderRadius:'8px',
                   fontSize:'14px', cursor:'pointer', fontFamily:'inherit' },
  backRow:       { textAlign:'center', marginTop:'12px' },
  backLink:      { fontSize:'12px', color:'#8FAF9F', cursor:'pointer' },
  escape:        { fontSize:'12px', color:'#8FAF9F', textAlign:'center', marginTop:'1.25rem' },
  escapeLink:    { color:'#2D6A4F', cursor:'pointer', fontWeight:'500' },
}
