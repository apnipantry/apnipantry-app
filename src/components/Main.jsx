// Main.jsx — with defensive loading and error boundary
import { useState, useEffect, Component } from 'react'
import {
  loadCategoriesWithItems,
  getHouseholdMembers,
  subscribeToItems,
  addItem,
  toggleCart,
  deleteItem,
  signOut,
  addCategory,
  updateItem,
  updateCategory,
} from '../lib/supabase'

// ── Error boundary — catches render crashes and shows what broke ──
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:'2rem', fontFamily:'monospace', fontSize:'13px' }}>
          <div style={{ color:'#922B21', fontWeight:'bold', marginBottom:'8px' }}>
            App crashed — error details:
          </div>
          <div style={{ background:'#FCEBEB', padding:'12px', borderRadius:'8px',
                        color:'#922B21', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.split('\n').slice(0,6).join('\n')}
          </div>
          <button
            style={{ marginTop:'16px', padding:'8px 16px', background:'#2D6A4F',
                     color:'white', border:'none', borderRadius:'8px', cursor:'pointer' }}
            onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const PLATFORMS = {
  Blinkit:   { icon:'🟡', color:'#FAC775' },
  Zepto:     { icon:'🟣', color:'#CCC8F4' },
  Amazon:    { icon:'🟠', color:'#F0C4A0' },
  Myntra:    { icon:'🩷', color:'#F4C0D1' },
  PharmEasy: { icon:'💊', color:'#C0DD97' },
}

function MainInner({ profile, onProfileUpdate }) {
  const [cats, setCats]             = useState([])
  const [members, setMembers]       = useState([])
  const [openCats, setOpenCats]     = useState(new Set(['groceries']))
  const [tab, setTab]               = useState('list')
  const [addingIn, setAddingIn]     = useState(null)
  const [newName, setNewName]       = useState('')
  const [loading, setLoading]       = useState(true)
  const [showSettings, setSettings] = useState(false)
  const [loadError, setLoadError]   = useState(null)
  const [addItemSheet, setAddItemSheet]   = useState(null)   // catId or null
  const [showAddCat, setShowAddCat]       = useState(false)
  const [editItemData, setEditItemData]   = useState(null)   // item object or null
  const [editCatData, setEditCatData]     = useState(null)   // cat object or null

  const isParent = profile?.role === 'parent'
  const householdId = profile?.household_id

  useEffect(() => {
    if (!householdId) return
    loadAll()
    getHouseholdMembers()
      .then(setMembers)
      .catch(e => console.error('Members load error:', e))

    const unsub = subscribeToItems(householdId, loadAll)
    return unsub
  }, [householdId])

  async function loadAll() {
    try {
      const data = await loadCategoriesWithItems()
      setCats(data || [])
      setLoadError(null)
    } catch (e) {
      console.error('[Apni Pantry] Load error:', e)
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const allItems   = cats.flatMap(c => c.items || [])
  const cartItems  = allItems.filter(i => i.in_cart)
  const byPlatform = cartItems.reduce((acc, item) => {
    const src = item.source || 'Other'
    ;(acc[src] = acc[src] || []).push(item)
    return acc
  }, {})
  const grandTotal = cartItems.reduce((s, i) => s + (i.cost_inr || 0), 0)

  function toggleCat(id) {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Optimistic cart toggle — updates local state immediately.
  // Fixes two bugs:
  //   1. iOS Safari: onChange on <input type="checkbox"> fires inconsistently.
  //      onClick fires reliably on all browsers including iOS Safari.
  //   2. All browsers: Supabase realtime doesn't fire for the user who made
  //      the change, so without this the checkbox appears frozen until refresh.
  async function handleToggleCart(itemId, newInCart) {
    // Update local state immediately so the UI responds at once
    setCats(prev => prev.map(cat => ({
      ...cat,
      items: (cat.items || []).map(item =>
        item.id === itemId ? { ...item, in_cart: newInCart } : item
      )
    })))
    try {
      await toggleCart(itemId, newInCart)
    } catch (e) {
      console.error('Toggle cart error:', e)
      // Revert on failure
      setCats(prev => prev.map(cat => ({
        ...cat,
        items: (cat.items || []).map(item =>
          item.id === itemId ? { ...item, in_cart: !newInCart } : item
        )
      })))
    }
  }

  async function handleAddItem(catId) {
    if (!newName.trim()) return
    try {
      await addItem(catId, {
        name: newName.trim(), qty: '1 unit',
        frequency: 'monthly', source: 'Blinkit', for_whom: 'household',
      })
      setNewName('')
      setAddingIn(null)
    } catch (e) {
      console.error('Add item error:', e)
      alert('Could not add item: ' + e.message)
    }
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center',
                  justifyContent:'center', color:'#8FAF9F', fontSize:'14px' }}>
      Loading your pantry...
    </div>
  )

  if (loadError) return (
    <div style={{ padding:'2rem', maxWidth:'480px', margin:'0 auto' }}>
      <div style={{ color:'#922B21', fontSize:'14px', marginBottom:'8px' }}>
        Could not load pantry data
      </div>
      <div style={{ background:'#FCEBEB', padding:'12px', borderRadius:'8px',
                    fontSize:'12px', color:'#922B21', marginBottom:'16px' }}>
        {loadError}
      </div>
      <button style={{ padding:'8px 16px', background:'#2D6A4F', color:'white',
                       border:'none', borderRadius:'8px', cursor:'pointer' }}
        onClick={loadAll}>Try again</button>
      <button style={{ marginLeft:'8px', padding:'8px 16px', background:'transparent',
                       color:'#8FAF9F', border:'0.5px solid rgba(45,106,79,0.2)',
                       borderRadius:'8px', cursor:'pointer' }}
        onClick={signOut}>Sign out</button>
    </div>
  )

  return (
    <div style={S.app}>

      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.brandRow}>
          <div style={S.brandMark}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <path d="M3 8h16M5 8V6a2 2 0 012-2h8a2 2 0 012 2v2M5 8l1.2 12h9.6L17 8"
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 13v4M13 13v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={S.brandName}>Apni Pantry</div>
            <div style={S.brandSub}>
              {allItems.length} items · {cartItems.length} in cart
            </div>
          </div>
        </div>
        <button style={S.gearBtn} onClick={() => setSettings(true)}>
          <GearIcon />
        </button>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={{...S.tab, ...(tab==='list' ? S.tabActive : {})}}
          onClick={() => setTab('list')}>List</button>
        <button style={{...S.tab, ...(tab==='cart' ? S.tabActive : {})}}
          onClick={() => setTab('cart')}>
          Cart
          {cartItems.length > 0 && <span style={S.badge}>{cartItems.length}</span>}
        </button>
      </div>

      {/* List */}
      {tab === 'list' && cats.map(cat => (
        <div key={cat.id} style={S.catBlock}>
          <div style={S.catHead} onClick={() => toggleCat(cat.id)}>
            <span style={{ fontSize:'16px' }}>{cat.icon}</span>
            <span style={S.catName}>{cat.name}</span>
            <span style={S.catCount}>{(cat.items||[]).length}</span>
            {isParent && (
              <div style={{ display:'flex', gap:'2px' }} onClick={e => e.stopPropagation()}>
                <button style={S.catActionBtn} title="Add item"
                  onClick={() => setAddItemSheet(cat.id)}>+</button>
                <button style={S.catActionBtn} title="Edit category"
                  onClick={() => setEditCatData(cat)}>✎</button>
              </div>
            )}
            <span style={{ color:'#8FAF9F', fontSize:'11px', marginLeft:'2px' }}>
              {openCats.has(cat.id) ? '▲' : '▼'}
            </span>
          </div>
          {openCats.has(cat.id) && (
            <div style={S.catBody}>
              {(cat.items||[]).map(item => (
                <div key={item.id} style={S.itemRow}>
                  {isParent
                    ? <input type="checkbox" checked={!!item.in_cart}
                        onChange={() => {}} // needed to suppress React warning for controlled input
                        onClick={() => handleToggleCart(item.id, !item.in_cart)}
                        style={S.check}/>
                    : <div style={{...S.dot,
                        background: item.in_cart ? '#2D6A4F' : 'rgba(45,106,79,0.2)'}}/>
                  }
                  <div style={S.itemInfo}>
                    <div style={S.itemName}>
                      {item.name}
                      <span style={S.forTag}>for {item.for_whom}</span>
                    </div>
                    <div style={S.itemMeta}>{item.frequency} · {item.source}</div>
                  </div>
                  {item.stock_status==='danger' && <span style={S.bDanger}>Running out</span>}
                  {item.stock_status==='warning' && <span style={S.bWarn}>Due soon</span>}
                  {isParent && (
                    <div style={{ display:'flex', gap:'2px' }}>
                      <button style={S.editBtn}
                        onClick={() => setEditItemData(item)}>✎</button>
                      <button style={S.delBtn}
                        onClick={() => deleteItem(item.id)}>×</button>
                    </div>
                  )}
                </div>
              ))}
              <div style={S.addRow}
                onClick={() => setAddItemSheet(cat.id)}>
                <span style={S.addRowText}>
                  {isParent ? '+ Add item' : '+ Request item'}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Cart */}
      {tab === 'cart' && (
        cartItems.length === 0
          ? <div style={S.emptyCart}>Cart is empty — check items on the list to add them.</div>
          : <>
              {Object.entries(byPlatform).map(([platform, items]) => {
                const p = PLATFORMS[platform] || { icon:'🛍️', color:'#D3D1C7' }
                const sub = items.reduce((s,i) => s+(i.cost_inr||0), 0)
                return (
                  <div key={platform} style={S.platCard}>
                    <div style={S.platHead}>
                      <div style={{...S.platLogo, background:p.color}}>{p.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={S.platName}>{platform}</div>
                        <div style={S.platSub}>{items.length} item{items.length>1?'s':''}</div>
                      </div>
                      <div style={S.platTotal}>₹{sub.toLocaleString('en-IN')}</div>
                    </div>
                    {items.map(item => (
                      <div key={item.id} style={S.cartItem}>
                        <div style={{ flex:1, fontSize:'13px' }}>
                          {item.name}
                          <span style={S.forTag}>for {item.for_whom}</span>
                        </div>
                        <div style={{ fontSize:'12px', color:'#8FAF9F', marginRight:'8px' }}>
                          {item.qty}
                        </div>
                        <div style={{ fontSize:'13px', minWidth:'52px', textAlign:'right' }}>
                          {item.cost_inr ? `₹${item.cost_inr}` : '—'}
                        </div>
                        {isParent &&
                          <button style={S.delBtn}
                            onClick={() => handleToggleCart(item.id, false)}>×</button>}
                      </div>
                    ))}
                    <div style={S.platFooter}>
                      {isParent
                        ? <button style={S.orderBtn}
                            onClick={() => alert(`Opening ${platform}...`)}>
                            Order on {platform} →
                          </button>
                        : <span style={{ fontSize:'12px', color:'#8FAF9F' }}>
                            🔒 Only parents can place orders
                          </span>
                      }
                      <span style={{ fontSize:'12px', color:'#8FAF9F' }}>
                        ₹{sub.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div style={S.grandRow}>
                <span style={{ fontSize:'13px', color:'#8FAF9F' }}>Grand total</span>
                <span style={{ fontSize:'20px', fontWeight:'500', color:'#2D6A4F' }}>
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </>
      )}

      {/* Floating action button — add category (parents only) */}
      {isParent && tab === 'list' && (
        <button style={S.fab} onClick={() => setShowAddCat(true)} title="Add category">
          <span style={{ fontSize:'22px', lineHeight:1 }}>+</span>
          <span style={{ fontSize:'11px', marginTop:'1px' }}>Category</span>
        </button>
      )}

      {/* Add item sheet */}
      {addItemSheet && (
        <AddItemSheet
          catId={addItemSheet}
          catName={cats.find(c => c.id === addItemSheet)?.name || ''}
          isParent={isParent}
          profile={profile}
          onSave={async (catId, itemData) => {
            await addItem(catId, itemData)
            setAddItemSheet(null)
          }}
          onClose={() => setAddItemSheet(null)}
        />
      )}

      {/* Add category sheet */}
      {showAddCat && (
        <AddCategorySheet
          onSave={async (name, icon) => {
            await addCategory(name, icon, cats.length + 1)
            await loadAll()
            setShowAddCat(false)
          }}
          onClose={() => setShowAddCat(false)}
        />
      )}

      {/* Edit item sheet */}
      {editItemData && (
        <AddItemSheet
          catId={editItemData.category_id}
          catName={cats.find(c => c.id === editItemData.category_id)?.name || ''}
          isParent={isParent}
          profile={profile}
          editItem={editItemData}
          onSave={async (catId, itemData) => {
            await updateItem(editItemData.id, itemData)
            await loadAll()
            setEditItemData(null)
          }}
          onClose={() => setEditItemData(null)}
        />
      )}

      {/* Edit category sheet */}
      {editCatData && (
        <AddCategorySheet
          editCat={editCatData}
          onSave={async (name, icon) => {
            await updateCategory(editCatData.id, { name, icon })
            await loadAll()
            setEditCatData(null)
          }}
          onClose={() => setEditCatData(null)}
        />
      )}

      {/* Settings sheet */}
      {showSettings && (
        <SettingsSheet
          profile={profile}
          members={members}
          onClose={() => setSettings(false)}
        />
      )}
    </div>
  )
}

// Wrap in error boundary so crashes show what went wrong
export default function Main(props) {
  return (
    <ErrorBoundary>
      <MainInner {...props} />
    </ErrorBoundary>
  )
}

// ── Settings sheet ────────────────────────────────────────────
function SettingsSheet({ profile, members, onClose }) {
  const isParent = profile?.role === 'parent'
  const [inviteRole, setInviteRole] = useState('member')
  const [creating, setCreating]     = useState(false)
  const [copyLabel, setCopyLabel]   = useState('Copy link')
  const [error, setError]           = useState('')

  // Persist invite in localStorage — survives sheet close/reopen for 48h
  function getKey(role) {
    return `apnipantry_invite_${profile?.household_id}_${role}`
  }

  function getSaved(role) {
    try {
      const raw = localStorage.getItem(getKey(role))
      if (!raw) return null
      const saved = JSON.parse(raw)
      if (new Date(saved.expires_at) < new Date()) {
        localStorage.removeItem(getKey(role))
        return null
      }
      return saved
    } catch { return null }
  }

  const [invite, setInvite] = useState(() => getSaved('member'))

  function handleRoleChange(newRole) {
    setInviteRole(newRole)
    setError('')
    setInvite(getSaved(newRole))
  }

  async function handleCreateInvite() {
    setCreating(true)
    setError('')
    try {
      const { createInvite } = await import('../lib/supabase')
      const result = await createInvite({ role: inviteRole, hours: 48 })
      localStorage.setItem(getKey(inviteRole), JSON.stringify(result))
      setInvite(result)
    } catch (e) {
      console.error('Create invite error:', e)
      setError(e.message || 'Could not create invite. Check that 06_invites.sql has been run.')
    } finally {
      setCreating(false)
    }
  }

  const inviteLink = invite
    ? `${window.location.origin}/join/${invite.invite_id}`
    : null

  const waMessage = invite
    ? `Hey! I've invited you to join our Apni Pantry household 🛒\n\nClick this link to join (expires in 48 hours):\n${inviteLink}\n\nYou'll join as: ${invite.role === 'parent' ? 'Parent (full access)' : 'Member (view & request items)'}`
    : null

  function copyLink() {
    if (!inviteLink) return
    navigator.clipboard?.writeText(inviteLink)
      .then(() => { setCopyLabel('Copied!'); setTimeout(() => setCopyLabel('Copy link'), 2000) })
      .catch(() => {
        const el = document.createElement('textarea')
        el.value = inviteLink
        document.body.appendChild(el); el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setCopyLabel('Copied!'); setTimeout(() => setCopyLabel('Copy link'), 2000)
      })
  }

  return (
    <>
      <div style={SS.backdrop} onClick={onClose}/>
      <div style={SS.sheet}>
        <div style={SS.handle}/>

        <div style={SS.header}>
          <div style={SS.title}>Settings</div>
          <button style={SS.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Household */}
        <div style={SS.section}>
          <div style={SS.secTitle}>Household</div>
          <InfoRow label="Name"      value={profile?.households?.name || profile?.household_id?.slice(0,8) || '—'}/>
          <InfoRow label="Your name" value={profile?.name || '—'}/>
          <InfoRow label="Your role" value={profile?.role || '—'}
            valueStyle={{ color:'#2D6A4F', fontWeight:500, textTransform:'capitalize' }}/>
        </div>

        {/* Members */}
        <div style={SS.section}>
          <div style={SS.secTitle}>Members ({members.length})</div>
          {members.length === 0 && (
            <div style={{ fontSize:'12px', color:'#8FAF9F' }}>No members loaded yet.</div>
          )}
          {members.map(m => (
            <div key={m.id} style={SS.memberRow}>
              <div style={{...SS.avatar, background:m.color||'#EAF3DE', color:m.text_color||'#27500A'}}>
                {m.initials || m.name?.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, fontSize:'13px', color:'#1A2E22' }}>{m.name}</div>
              <div style={{...SS.roleBadge,
                background: m.role==='parent' ? '#EAF3DE' : '#F5FAF7',
                color:      m.role==='parent' ? '#2D6A4F' : '#8FAF9F'}}>
                {m.role}
              </div>
            </div>
          ))}
        </div>

        {/* Invite */}
        {isParent ? (
          <div style={SS.section}>
            <div style={SS.secTitle}>Invite a family member</div>
            <p style={SS.hint}>Generate a shareable link. Expires in 48 hours.</p>

            <div style={SS.roleLabel}>They will join as</div>
            <div style={SS.roleGrid}>
              {[
                { value:'member', title:'Member',
                  desc:'Can view list and request items. Parents approve what goes into cart.' },
                { value:'parent', title:'Parent',
                  desc:'Full access — add items, manage cart, and place orders.' },
              ].map(r => (
                <div key={r.value}
                  style={{...SS.roleCard, ...(inviteRole===r.value ? SS.roleActive : {})}}
                  onClick={() => handleRoleChange(r.value)}>
                  <div style={SS.roleCardTitle}>{r.title}</div>
                  <div style={SS.roleCardDesc}>{r.desc}</div>
                </div>
              ))}
            </div>

            {error && <div style={SS.error}>{error}</div>}

            <button style={{...SS.btn, opacity: creating ? 0.6 : 1}}
              disabled={creating} onClick={handleCreateInvite}>
              {creating ? 'Generating...' : invite ? '↺ New link' : `Generate ${inviteRole} invite`}
            </button>

            {invite && inviteLink && (
              <div style={SS.inviteBox}>
                <div style={SS.inviteMeta}>
                  {invite.role} invite · 48 hours
                </div>
                <div style={SS.inviteUrl}>{inviteLink}</div>
                <div style={SS.inviteActions}>
                  <button style={SS.btnCopy} onClick={copyLink}>{copyLabel}</button>
                  <button style={SS.btnWA}
                    onClick={() => window.open(
                      `https://wa.me/?text=${encodeURIComponent(waMessage)}`, '_blank'
                    )}>
                    WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{...SS.section, ...SS.hint}}>
            Only parents can invite new members.
          </div>
        )}

        <button style={SS.signOut} onClick={signOut}>Sign out</button>
      </div>
    </>
  )
}

function InfoRow({ label, value, valueStyle={} }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'7px 0', borderBottom:'0.5px solid rgba(45,106,79,0.08)',
                  fontSize:'13px' }}>
      <span style={{ color:'#8FAF9F' }}>{label}</span>
      <span style={{ color:'#1A2E22', ...valueStyle }}>{value}</span>
    </div>
  )
}

function GearIcon() {
  // Use explicit stroke colour — iOS Safari does not reliably inherit
  // currentColor from a parent button element into SVG strokes
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#4A6357" strokeWidth="1.8" strokeLinecap="round"
      style={{ display:'block' }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

const S = {
  app:       { maxWidth:'640px', margin:'0 auto', padding:'1rem 1rem 4rem' },
  topBar:    { display:'flex', alignItems:'center', justifyContent:'space-between',
               marginBottom:'1.25rem' },
  brandRow:  { display:'flex', alignItems:'center', gap:'10px' },
  brandMark: { width:'36px', height:'36px', background:'#2D6A4F', borderRadius:'10px',
               display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  brandName: { fontSize:'18px', fontWeight:'600', color:'#2D6A4F' },
  brandSub:  { fontSize:'12px', color:'#8FAF9F', marginTop:'1px' },
  gearBtn:   { width:'36px', height:'36px', display:'flex', alignItems:'center',
               justifyContent:'center', background:'white',
               border:'0.5px solid rgba(45,106,79,0.2)', borderRadius:'10px',
               color:'#4A6357', cursor:'pointer', flexShrink:0,
               WebkitTapHighlightColor:'transparent' },
  tabs:      { display:'flex', border:'0.5px solid rgba(45,106,79,0.2)',
               borderRadius:'8px', overflow:'hidden', marginBottom:'1.25rem' },
  tab:       { flex:1, padding:'8px', fontSize:'13px', textAlign:'center',
               background:'transparent', border:'none', color:'#8FAF9F',
               borderRight:'0.5px solid rgba(45,106,79,0.2)',
               fontFamily:'inherit', cursor:'pointer' },
  tabActive: { background:'#2D6A4F', color:'white' },
  badge:     { display:'inline-block', background:'#F4A261', color:'#412402',
               borderRadius:'999px', fontSize:'10px', padding:'1px 5px', marginLeft:'5px' },
  catBlock:  { marginBottom:'8px', border:'0.5px solid rgba(45,106,79,0.15)',
               borderRadius:'12px', overflow:'hidden', background:'white' },
  catHead:   { display:'flex', alignItems:'center', gap:'10px',
               padding:'0.7rem 1rem', cursor:'pointer' },
  catName:   { flex:1, fontSize:'14px', fontWeight:'500', color:'#1A2E22' },
  catCount:  { fontSize:'12px', color:'#8FAF9F' },
  catBody:   { borderTop:'0.5px solid rgba(45,106,79,0.08)' },
  itemRow:   { display:'flex', alignItems:'center', gap:'10px', padding:'0.6rem 1rem',
               borderBottom:'0.5px solid rgba(45,106,79,0.06)' },
  check:     { width:'16px', height:'16px', accentColor:'#2D6A4F', flexShrink:0 },
  dot:       { width:'6px', height:'6px', borderRadius:'50%', flexShrink:0 },
  itemInfo:  { flex:1, minWidth:0 },
  itemName:  { fontSize:'13px', color:'#1A2E22' },
  itemMeta:  { fontSize:'11px', color:'#8FAF9F', marginTop:'1px' },
  forTag:    { fontSize:'10px', padding:'2px 6px', borderRadius:'999px',
               background:'#EAF3DE', color:'#4A6357', marginLeft:'6px' },
  bDanger:   { fontSize:'10px', padding:'2px 7px', borderRadius:'999px',
               background:'#FCEBEB', color:'#922B21', flexShrink:0 },
  bWarn:     { fontSize:'10px', padding:'2px 7px', borderRadius:'999px',
               background:'#FAEEDA', color:'#633806', flexShrink:0 },
  delBtn:    { fontSize:'14px', color:'#8FAF9F', background:'none',
               border:'none', padding:'2px 6px', cursor:'pointer' },
  addRow:    { display:'flex', alignItems:'center', gap:'8px',
               padding:'0.5rem 1rem', borderTop:'0.5px solid rgba(45,106,79,0.06)' },
  addInput:  { flex:1, fontSize:'13px', border:'none', outline:'none',
               background:'transparent', color:'#1A2E22', fontFamily:'inherit' },
  addBtn:    { fontSize:'12px', background:'#2D6A4F', color:'white',
               border:'none', padding:'4px 10px', borderRadius:'6px', cursor:'pointer' },
  emptyCart: { textAlign:'center', padding:'2.5rem 1rem',
               color:'#8FAF9F', fontSize:'13px' },
  platCard:  { marginBottom:'12px', border:'0.5px solid rgba(45,106,79,0.15)',
               borderRadius:'12px', overflow:'hidden', background:'white' },
  platHead:  { display:'flex', alignItems:'center', gap:'10px', padding:'0.75rem 1rem',
               borderBottom:'0.5px solid rgba(45,106,79,0.08)' },
  platLogo:  { width:'32px', height:'32px', borderRadius:'8px', display:'flex',
               alignItems:'center', justifyContent:'center', fontSize:'15px' },
  platName:  { fontSize:'14px', fontWeight:'500', color:'#1A2E22' },
  platSub:   { fontSize:'12px', color:'#8FAF9F' },
  platTotal: { fontSize:'14px', fontWeight:'500', color:'#1A2E22' },
  cartItem:  { display:'flex', alignItems:'center', gap:'8px', padding:'0.6rem 1rem',
               borderBottom:'0.5px solid rgba(45,106,79,0.06)' },
  platFooter:{ padding:'0.75rem 1rem', display:'flex', alignItems:'center',
               justifyContent:'space-between', background:'#FDFAF5' },
  orderBtn:  { background:'#2D6A4F', color:'white', border:'none',
               fontSize:'13px', padding:'7px 14px', borderRadius:'8px', cursor:'pointer' },
  addRowText:  { fontSize:'13px', color:'#52B788' },
  catActionBtn:{ fontSize:'14px', color:'#8FAF9F', background:'none', border:'none',
                 padding:'2px 5px', cursor:'pointer', borderRadius:'4px',
                 lineHeight:1 },
  editBtn:     { fontSize:'12px', color:'#8FAF9F', background:'none', border:'none',
                 padding:'2px 5px', cursor:'pointer', borderRadius:'4px' },
  fab:         { position:'fixed', bottom:'24px', right:'20px',
                 width:'58px', height:'58px', borderRadius:'50%',
                 background:'#2D6A4F', color:'white', border:'none',
                 display:'flex', flexDirection:'column', alignItems:'center',
                 justifyContent:'center', cursor:'pointer', zIndex:40,
                 boxShadow:'0 4px 12px rgba(45,106,79,0.4)', fontFamily:'inherit' },
  newCatBtn:   { display:'none' },
  newCatBtn: { width:'100%', padding:'11px', background:'transparent',
               color:'#2D6A4F', border:'1px dashed rgba(45,106,79,0.3)',
               borderRadius:'12px', fontSize:'13px', cursor:'pointer',
               marginBottom:'8px', fontFamily:'inherit' },
  grandRow:  { display:'flex', alignItems:'center', justifyContent:'space-between',
               padding:'0.875rem 1rem', border:'0.5px solid rgba(45,106,79,0.15)',
               borderRadius:'12px', background:'#EAF3DE' },
}

const SS = {
  backdrop:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:50 },
  sheet:        { position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
                  width:'100%', maxWidth:'640px', background:'white',
                  borderRadius:'16px 16px 0 0', padding:'0 1.25rem 2.5rem',
                  maxHeight:'88vh', overflowY:'auto', zIndex:51 },
  handle:       { width:'36px', height:'4px', background:'rgba(45,106,79,0.2)',
                  borderRadius:'2px', margin:'12px auto 0' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'1rem 0 0.5rem' },
  title:        { fontSize:'18px', fontWeight:'500', color:'#1A2E22' },
  closeBtn:     { fontSize:'16px', color:'#8FAF9F', background:'none',
                  border:'none', cursor:'pointer', padding:'4px 8px' },
  section:      { paddingBottom:'1.25rem', marginBottom:'1.25rem',
                  borderBottom:'0.5px solid rgba(45,106,79,0.1)' },
  secTitle:     { fontSize:'11px', fontWeight:'600', color:'#8FAF9F',
                  textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' },
  memberRow:    { display:'flex', alignItems:'center', gap:'10px', padding:'6px 0' },
  avatar:       { width:'28px', height:'28px', borderRadius:'50%', display:'flex',
                  alignItems:'center', justifyContent:'center',
                  fontSize:'11px', fontWeight:'500', flexShrink:0 },
  roleBadge:    { fontSize:'10px', padding:'2px 8px', borderRadius:'999px', fontWeight:'500' },
  hint:         { fontSize:'12px', color:'#8FAF9F', lineHeight:'1.6', marginBottom:'12px' },
  roleLabel:    { fontSize:'12px', color:'#4A6357', fontWeight:'500', marginBottom:'8px' },
  roleGrid:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' },
  roleCard:     { padding:'12px', border:'1px solid rgba(45,106,79,0.15)',
                  borderRadius:'10px', cursor:'pointer' },
  roleActive:   { border:'1.5px solid #2D6A4F', background:'#EAF3DE' },
  roleCardTitle:{ fontSize:'13px', fontWeight:'500', color:'#1A2E22', marginBottom:'4px' },
  roleCardDesc: { fontSize:'11px', color:'#8FAF9F', lineHeight:'1.4' },
  error:        { fontSize:'12px', color:'#922B21', background:'#FCEBEB',
                  border:'1px solid #F09595', borderRadius:'8px',
                  padding:'8px 12px', marginBottom:'10px', lineHeight:'1.5' },
  btn:          { width:'100%', padding:'11px', background:'#2D6A4F', color:'white',
                  border:'none', borderRadius:'8px', fontSize:'14px',
                  fontWeight:'500', cursor:'pointer', marginBottom:'12px' },
  inviteBox:    { background:'#EAF3DE', borderRadius:'10px', padding:'12px', marginBottom:'8px' },
  inviteMeta:   { fontSize:'10px', color:'#52B788', textTransform:'uppercase',
                  letterSpacing:'0.05em', marginBottom:'6px' },
  inviteUrl:    { fontSize:'12px', color:'#27500A', wordBreak:'break-all',
                  lineHeight:'1.5', marginBottom:'10px' },
  inviteActions:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' },
  btnCopy:      { padding:'9px', background:'white', color:'#2D6A4F',
                  border:'1px solid #95D5B2', borderRadius:'8px',
                  fontSize:'12px', fontWeight:'500', cursor:'pointer' },
  btnWA:        { padding:'9px', background:'#25D366', color:'white',
                  border:'none', borderRadius:'8px', fontSize:'12px',
                  fontWeight:'500', cursor:'pointer' },
  signOut:      { width:'100%', padding:'11px', background:'transparent',
                  color:'#8FAF9F', border:'0.5px solid rgba(45,106,79,0.2)',
                  borderRadius:'8px', fontSize:'14px', cursor:'pointer' },
}

// ── Add Item Sheet ────────────────────────────────────────────
const CATEGORY_ICONS = ['🛒','🥛','🥦','🌶️','🍪','🧹','🧴','🪥','💊','🍳','👕','🐾','📋','📦','🏠','🎒','💄','🍺','🐕','🐈','🌿','⚡','🔧','📱']
const FREQUENCIES = [
  { value:'daily',          label:'Daily' },
  { value:'every_2_days',   label:'Every 2 days' },
  { value:'weekly',         label:'Weekly' },
  { value:'every_2_weeks',  label:'Every 2 weeks' },
  { value:'monthly',        label:'Monthly' },
  { value:'quarterly',      label:'Quarterly' },
  { value:'every_6_months', label:'Every 6 months' },
  { value:'yearly',         label:'Yearly' },
  { value:'one_time',       label:'One time' },
]
const SOURCES = ['Blinkit','Zepto','Amazon','Myntra','PharmEasy','D-Mart','Local store','Other']
const FOR_WHOM_OPTS = ['household','Himanshu','Kaveri','Kritvee','Oreo']

function AddItemSheet({ catId, catName, isParent, profile, editItem, onSave, onClose }) {
  const isEdit = !!editItem
  const [name, setName]       = useState(editItem?.name || '')
  const [qty, setQty]         = useState(editItem?.qty || '')
  const [brand, setBrand]     = useState(editItem?.brand || '')
  const [freq, setFreq]       = useState(editItem?.frequency || 'monthly')
  const [cost, setCost]       = useState(editItem?.cost_inr ? String(editItem.cost_inr) : '')
  const [source, setSource]   = useState(editItem?.source || 'Blinkit')
  const [forWhom, setForWhom] = useState(editItem?.for_whom || 'household')
  const [notes, setNotes]     = useState(editItem?.notes || '')
  const [showMore, setMore]   = useState(isEdit) // show all fields when editing
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Item name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(catId, {
        name:      name.trim(),
        qty:       qty.trim() || '1 unit',
        brand:     brand.trim(),
        frequency: freq,
        cost_inr:  cost ? parseInt(cost) : 0,
        source,
        for_whom:  forWhom,
        notes:     notes.trim(),
      })
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <>
      <div style={SH.backdrop} onClick={onClose}/>
      <div style={SH.sheet}>
        <div style={SH.handle}/>
        <div style={SH.header}>
          <div>
            <div style={SH.title}>{isParent ? 'Add item' : 'Request item'}</div>
            <div style={SH.subtitle}>to {catName}</div>
          </div>
          <button style={SH.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Item name — always visible */}
        <div style={SH.field}>
          <label style={SH.label}>Item name *</label>
          <input style={SH.input} placeholder="e.g. Amul Milk 1L"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !showMore && handleSave()}
            autoFocus/>
        </div>

        {/* Quick fields */}
        <div style={SH.row2}>
          <div style={SH.field}>
            <label style={SH.label}>Quantity</label>
            <input style={SH.input} placeholder="e.g. 1 litre"
              value={qty} onChange={e => setQty(e.target.value)}/>
          </div>
          <div style={SH.field}>
            <label style={SH.label}>Order from</label>
            <select style={SH.select} value={source}
              onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* More details toggle */}
        <button style={SH.moreToggle} onClick={() => setMore(!showMore)}>
          {showMore ? '▲ Less details' : '▼ More details (brand, cost, frequency)'}
        </button>

        {showMore && (
          <>
            <div style={SH.row2}>
              <div style={SH.field}>
                <label style={SH.label}>Brand</label>
                <input style={SH.input} placeholder="e.g. Amul"
                  value={brand} onChange={e => setBrand(e.target.value)}/>
              </div>
              <div style={SH.field}>
                <label style={SH.label}>Cost (₹)</label>
                <input style={SH.input} type="number" placeholder="0"
                  value={cost} onChange={e => setCost(e.target.value)}/>
              </div>
            </div>
            <div style={SH.row2}>
              <div style={SH.field}>
                <label style={SH.label}>Frequency</label>
                <select style={SH.select} value={freq}
                  onChange={e => setFreq(e.target.value)}>
                  {FREQUENCIES.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={SH.field}>
                <label style={SH.label}>For</label>
                <select style={SH.select} value={forWhom}
                  onChange={e => setForWhom(e.target.value)}>
                  {FOR_WHOM_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={SH.field}>
              <label style={SH.label}>Notes</label>
              <input style={SH.input} placeholder="e.g. Only buy 500ml, not 1L"
                value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
          </>
        )}

        {error && <div style={SH.error}>{error}</div>}

        <button style={{...SH.btn, opacity: (name.trim() && !saving) ? 1 : 0.5}}
          disabled={!name.trim() || saving} onClick={handleSave}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : isParent ? 'Add to list' : 'Send request'}
        </button>
      </div>
    </>
  )
}

// ── Add Category Sheet ────────────────────────────────────────
function AddCategorySheet({ editCat, onSave, onClose }) {
  const isEdit = !!editCat
  const [name, setName]     = useState(editCat?.name || '')
  const [icon, setIcon]     = useState(editCat?.icon || '📦')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Category name is required.'); return }
    setSaving(true)
    try {
      await onSave(name.trim(), icon)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <>
      <div style={SH.backdrop} onClick={onClose}/>
      <div style={SH.sheet}>
        <div style={SH.handle}/>
        <div style={SH.header}>
          <div style={SH.title}>{isEdit ? 'Edit category' : 'New category'}</div>
          <button style={SH.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={SH.field}>
          <label style={SH.label}>Category name *</label>
          <input style={SH.input} placeholder="e.g. Baby Supplies"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleSave()}
            autoFocus/>
        </div>

        <div style={SH.field}>
          <label style={SH.label}>Icon</label>
          <div style={SH.iconGrid}>
            {CATEGORY_ICONS.map(ic => (
              <div key={ic}
                style={{...SH.iconBtn, ...(icon===ic ? SH.iconActive : {})}}
                onClick={() => setIcon(ic)}>
                {ic}
              </div>
            ))}
          </div>
        </div>

        {error && <div style={SH.error}>{error}</div>}

        <button style={{...SH.btn, opacity: (name.trim() && !saving) ? 1 : 0.5}}
          disabled={!name.trim() || saving} onClick={handleSave}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create category'}
        </button>
      </div>
    </>
  )
}

// Shared sheet styles
const SH = {
  backdrop:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:50 },
  sheet:      { position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
                width:'100%', maxWidth:'640px', background:'white',
                borderRadius:'16px 16px 0 0', padding:'0 1.25rem 2.5rem',
                maxHeight:'88vh', overflowY:'auto', zIndex:51 },
  handle:     { width:'36px', height:'4px', background:'rgba(45,106,79,0.2)',
                borderRadius:'2px', margin:'12px auto 0' },
  header:     { display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                padding:'1rem 0 0.75rem' },
  title:      { fontSize:'17px', fontWeight:'500', color:'#1A2E22' },
  subtitle:   { fontSize:'12px', color:'#8FAF9F', marginTop:'2px' },
  closeBtn:   { fontSize:'16px', color:'#8FAF9F', background:'none',
                border:'none', cursor:'pointer', padding:'4px 8px', flexShrink:0 },
  field:      { marginBottom:'12px' },
  label:      { fontSize:'12px', color:'#4A6357', display:'block', marginBottom:'5px', fontWeight:'500' },
  input:      { width:'100%', padding:'10px 12px', border:'0.5px solid rgba(45,106,79,0.2)',
                borderRadius:'8px', fontSize:'14px', outline:'none',
                color:'#1A2E22', fontFamily:'inherit' },
  select:     { width:'100%', padding:'10px 12px', border:'0.5px solid rgba(45,106,79,0.2)',
                borderRadius:'8px', fontSize:'14px', outline:'none',
                color:'#1A2E22', background:'white', fontFamily:'inherit' },
  row2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'0' },
  moreToggle: { fontSize:'12px', color:'#52B788', background:'none', border:'none',
                cursor:'pointer', padding:'4px 0 12px', fontFamily:'inherit' },
  iconGrid:   { display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:'6px' },
  iconBtn:    { width:'36px', height:'36px', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:'18px', borderRadius:'8px',
                cursor:'pointer', border:'1px solid transparent' },
  iconActive: { border:'2px solid #2D6A4F', background:'#EAF3DE' },
  error:      { fontSize:'13px', color:'#922B21', background:'#FCEBEB',
                border:'1px solid #F09595', borderRadius:'8px',
                padding:'8px 12px', marginBottom:'12px' },
  btn:        { width:'100%', padding:'12px', background:'#2D6A4F', color:'white',
                border:'none', borderRadius:'8px', fontSize:'14px',
                fontWeight:'500', cursor:'pointer', fontFamily:'inherit' },
}
