// InviteExpired.jsx — shown when invite link is invalid or expired
import { signOut } from '../lib/supabase'

export default function InviteExpired({ reason }) {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.icon}>⏱️</div>
        <h2 style={S.heading}>Invite link invalid</h2>
        <p style={S.reason}>{reason || 'This invite link has expired or is no longer valid.'}</p>
        <p style={S.hint}>
          Ask the household owner to generate a new invite link and share it with you.
          Invite links expire after 48 hours.
        </p>
        <button style={S.btn} onClick={() => window.location.href = '/'}>
          Go to home page
        </button>
      </div>
    </div>
  )
}

const S = {
  page:    { minHeight:'100vh', display:'flex', alignItems:'center',
             justifyContent:'center', padding:'1rem' },
  card:    { width:'100%', maxWidth:'360px', background:'white',
             border:'0.5px solid rgba(45,106,79,0.15)', borderRadius:'12px',
             padding:'2rem', textAlign:'center' },
  icon:    { fontSize:'36px', marginBottom:'1rem' },
  heading: { fontSize:'18px', fontWeight:'500', color:'#1A2E22', marginBottom:'8px' },
  reason:  { fontSize:'13px', color:'#922B21', background:'#FCEBEB',
             border:'1px solid #F09595', borderRadius:'8px',
             padding:'8px 12px', marginBottom:'12px', lineHeight:'1.6' },
  hint:    { fontSize:'12px', color:'#8FAF9F', lineHeight:'1.6', marginBottom:'1.5rem' },
  btn:     { padding:'10px 20px', background:'#2D6A4F', color:'white',
             border:'none', borderRadius:'8px', fontSize:'14px',
             fontWeight:'500', cursor:'pointer' },
}
