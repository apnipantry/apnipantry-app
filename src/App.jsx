import { useState, useEffect } from 'react'
import { supabase, getMyProfile } from './lib/supabase'
import Login from './components/Login.jsx'
import Setup from './components/Setup.jsx'
import Main from './components/Main.jsx'

export default function App() {
  const [session, setSession]     = useState(undefined)
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [inviteInfo, setInvite]   = useState(null)

  // Check URL for invite token on mount
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/join\/([a-f0-9-]{36})$/i)
    if (match) {
      const token = match[1]
      import('./lib/supabase').then(({ validateInvite }) => {
        validateInvite(token).then(result => {
          if (result?.valid) {
            // Make absolutely sure invite_id is stored (some older cached results may lack it)
            const toStore = { ...result, invite_id: result.invite_id || token }
            sessionStorage.setItem('apnipantry_invite', JSON.stringify(toStore))
            setInvite(toStore)
          }
          window.history.replaceState({}, '', '/')
        }).catch(() => window.history.replaceState({}, '', '/'))
      })
    } else {
      // Restore from sessionStorage if present
      const stored = sessionStorage.getItem('apnipantry_invite')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (new Date(parsed.expires_at) > new Date()) {
            setInvite(parsed)
          } else {
            sessionStorage.removeItem('apnipantry_invite')
          }
        } catch {
          sessionStorage.removeItem('apnipantry_invite')
        }
      }
    }
  }, [])

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load profile when session changes
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setLoading(false); return }
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [session])

  if (loading || session === undefined) return <Splash />
  if (!session) return <Login inviteInfo={inviteInfo} />

  // Logged in but no profile — incomplete setup
  if (!profile) {
    return (
      <Setup
        inviteInfo={inviteInfo}
        onDone={p => {
          sessionStorage.removeItem('apnipantry_invite')
          setProfile(p)
        }}
      />
    )
  }

  return <Main profile={profile} onProfileUpdate={setProfile} />
}

function Splash() {
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center',
                  gap:'12px', background:'#FDFAF5' }}>
      <div style={{ width:'48px', height:'48px', background:'#2D6A4F',
                    borderRadius:'12px', display:'flex',
                    alignItems:'center', justifyContent:'center' }}>
        <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
          <path d="M3 8h16M5 8V6a2 2 0 012-2h8a2 2 0 012 2v2M5 8l1.2 12h9.6L17 8"
            stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 13v4M13 13v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ fontSize:'15px', color:'#2D6A4F', fontWeight:'500' }}>Apni Pantry</div>
      <div style={{ fontSize:'12px', color:'#8FAF9F' }}>Loading...</div>
    </div>
  )
}
