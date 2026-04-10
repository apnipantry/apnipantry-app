// Settings.jsx — household settings + invite generation for parents
import { useState, useEffect } from 'react'
import { createInvite, getHouseholdMembers } from '../lib/supabase'

export default function Settings({ profile, onClose }) {
  const [members, setMembers]   = useState([])
  const [inviteRole, setRole]   = useState('member')
  const [invite, setInvite]     = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')

  const isParent = profile.role === 'parent'

  useEffect(() => {
    getHouseholdMembers().then(setMembers).catch(console.error)
  }, [])

  async function handleCreateInvite() {
    setCreating(true)
    setError('')
    setInvite(null)
    try {
      const result = await createInvite({ role: inviteRole, hours: 48 })
      setInvite(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const inviteLink = invite
    ? `${window.location.origin}/join/${invite.invite_id}`
    : null

  const waMessage = invite
    ? `Hey! I've added you to our Apni Pantry household 🛒\n\nUse this link to join — expires in 48 hours:\n${inviteLink}\n\nYou'll join as: ${invite.role}`
    : null

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
      .then(() => alert('Link copied!'))
      .catch(() => alert(inviteLink))
  }

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.title}>Settings</div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Household info */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Household</div>
          <div style={S.infoRow}>
            <span style={S.infoLabel}>Name</span>
            <span style={S.infoValue}>{profile.households?.name || '—'}</span>
          </div>
          <div style={S.infoRow}>
            <span style={S.infoLabel}>Your role</span>
            <span style={{ ...S.infoValue,
              color: profile.role === 'parent' ? '#2D6A4F' : '#4A6357',
              fontWeight: 500 }}>
              {profile.role}
            </span>
          </div>
        </div>

        {/* Members */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Members ({members.length})</div>
          {members.map(m => (
            <div key={m.id} style={S.memberRow}>
              <div style={{ ...S.avatar, background: m.color, color: m.text_color }}>
                {m.initials}
              </div>
              <div style={{ flex:1 }}>
                <div style={S.memberName}>{m.name}</div>
              </div>
              <div style={{ ...S.roleBadge,
                background: m.role === 'parent' ? '#EAF3DE' : '#F5FAF7',
                color: m.role === 'parent' ? '#2D6A4F' : '#8FAF9F' }}>
                {m.role}
              </div>
            </div>
          ))}
        </div>

        {/* Invite — parents only */}
        {isParent && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Invite a family member</div>
            <p style={S.hint}>Generate a link to share via WhatsApp. Expires in 48 hours.</p>

            <div style={S.roleRow}>
              {['member','parent'].map(r => (
                <div key={r}
                  style={{ ...S.roleChip,
                    ...(inviteRole === r ? S.roleChipActive : {}) }}
                  onClick={() => { setRole(r); setInvite(null) }}>
                  {r === 'parent' ? 'Parent' : 'Member'}
                </div>
              ))}
            </div>

            {error && <div style={S.error}>{error}</div>}

            {!invite ? (
              <button style={{ ...S.btn, opacity: creating ? 0.6 : 1 }}
                disabled={creating} onClick={handleCreateInvite}>
                {creating ? 'Generating...' : 'Generate invite link'}
              </button>
            ) : (
              <div style={S.inviteBox}>
                <div style={S.inviteLabel}>
                  Invite link · expires in 48 hours · {invite.role}
                </div>
                <div style={S.inviteLink}>{inviteLink}</div>
                <div style={S.inviteActions}>
                  <button style={S.btnCopy} onClick={copyLink}>
                    Copy link
                  </button>
                  <button style={S.btnWA}
                    onClick={() => window.open(
                      `https://wa.me/?text=${encodeURIComponent(waMessage)}`,
                      '_blank'
                    )}>
                    Share on WhatsApp
                  </button>
                </div>
                <button style={S.btnNew}
                  onClick={() => { setInvite(null); setError('') }}>
                  Generate new link
                </button>
              </div>
            )}
          </div>
        )}

        {!isParent && (
          <div style={S.hint}>
            Only parents can invite new members.
          </div>
        )}

      </div>
    </div>
  )
}

const S = {
  page:         { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)',
                  display:'flex', alignItems:'flex-end', justifyContent:'center',
                  zIndex:100 },
  card:         { width:'100%', maxWidth:'480px', background:'white',
                  borderRadius:'16px 16px 0 0', padding:'1.5rem',
                  maxHeight:'90vh', overflowY:'auto' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between',
                  marginBottom:'1.5rem' },
  title:        { fontSize:'18px', fontWeight:'500', color:'#1A2E22' },
  closeBtn:     { fontSize:'16px', color:'#8FAF9F', background:'none', border:'none',
                  cursor:'pointer', padding:'4px 8px' },
  section:      { marginBottom:'1.5rem', paddingBottom:'1.5rem',
                  borderBottom:'0.5px solid rgba(45,106,79,0.1)' },
  sectionTitle: { fontSize:'11px', fontWeight:'600', color:'#8FAF9F',
                  textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' },
  infoRow:      { display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'6px 0', fontSize:'13px' },
  infoLabel:    { color:'#8FAF9F' },
  infoValue:    { color:'#1A2E22' },
  memberRow:    { display:'flex', alignItems:'center', gap:'10px', padding:'6px 0' },
  avatar:       { width:'28px', height:'28px', borderRadius:'50%', display:'flex',
                  alignItems:'center', justifyContent:'center',
                  fontSize:'11px', fontWeight:'500', flexShrink:0 },
  memberName:   { fontSize:'13px', color:'#1A2E22' },
  roleBadge:    { fontSize:'10px', padding:'2px 8px', borderRadius:'999px', fontWeight:'500' },
  hint:         { fontSize:'12px', color:'#8FAF9F', lineHeight:'1.6', marginBottom:'10px' },
  roleRow:      { display:'flex', gap:'8px', marginBottom:'12px' },
  roleChip:     { padding:'6px 14px', border:'0.5px solid rgba(45,106,79,0.2)',
                  borderRadius:'999px', fontSize:'12px', color:'#8FAF9F', cursor:'pointer' },
  roleChipActive:{ background:'#2D6A4F', color:'white', border:'none' },
  error:        { fontSize:'12px', color:'#922B21', background:'#FCEBEB',
                  borderRadius:'8px', padding:'8px 12px', marginBottom:'10px' },
  btn:          { width:'100%', padding:'11px', background:'#2D6A4F', color:'white',
                  border:'none', borderRadius:'8px', fontSize:'14px',
                  fontWeight:'500', cursor:'pointer' },
  inviteBox:    { background:'#EAF3DE', borderRadius:'10px', padding:'12px' },
  inviteLabel:  { fontSize:'10px', color:'#52B788', textTransform:'uppercase',
                  letterSpacing:'0.05em', marginBottom:'6px' },
  inviteLink:   { fontSize:'12px', color:'#27500A', wordBreak:'break-all',
                  marginBottom:'10px', lineHeight:'1.5' },
  inviteActions:{ display:'flex', gap:'8px', marginBottom:'8px' },
  btnCopy:      { flex:1, padding:'8px', background:'white', color:'#2D6A4F',
                  border:'1px solid #95D5B2', borderRadius:'8px',
                  fontSize:'12px', fontWeight:'500', cursor:'pointer' },
  btnWA:        { flex:1, padding:'8px', background:'#25D366', color:'white',
                  border:'none', borderRadius:'8px',
                  fontSize:'12px', fontWeight:'500', cursor:'pointer' },
  btnNew:       { width:'100%', padding:'7px', background:'transparent', color:'#8FAF9F',
                  border:'none', fontSize:'12px', cursor:'pointer' },
}
