// lib/supabase.js — complete, clean version
// Replace src/lib/supabase.js with this file entirely
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Auth ──────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── Profile ───────────────────────────────────────────────────

export async function getMyProfile() {
  const session = await getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('users')
    .select('*, households(name)')
    .eq('id', session.user.id)
    .single()
  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data
}

// ── Household setup (new household) ──────────────────────────

export async function setupHousehold({ householdName, userName, role }) {
  const { data, error } = await supabase.rpc('setup_household', {
    p_household_name: householdName,
    p_user_name:      userName,
    p_role:           role,
  })
  if (error) throw error
  return data
}

// ── Household members ─────────────────────────────────────────

export async function getHouseholdMembers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, initials, role, color, text_color')
  if (error) throw error
  return data
}

// ── Categories + Items ────────────────────────────────────────

export async function loadCategoriesWithItems() {
  const { data, error } = await supabase
    .from('categories')
    .select(`
      id, name, icon, sort_order,
      items (
        id, name, qty, brand, frequency,
        cost_inr, for_whom, source, notes,
        stock_status, in_cart, added_by,
        last_purchased_at, next_purchase_at
      )
    `)
    .order('sort_order')
  if (error) throw error
  return data
}

// ── Item mutations ────────────────────────────────────────────

export async function addItem(categoryId, itemData) {
  const session = await getSession()
  const profile = await getMyProfile()
  const { data, error } = await supabase
    .from('items')
    .insert({
      ...itemData,
      category_id:  categoryId,
      household_id: profile.household_id,
      added_by:     session.user.id,
      stock_status: 'stocked',
      in_cart:      profile.role === 'parent',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleCart(itemId, inCart) {
  const { error } = await supabase
    .from('items')
    .update({ in_cart: inCart })
    .eq('id', itemId)
  if (error) throw error
}

export async function markPurchased(itemId, frequency) {
  const freqDays = {
    daily: 1, every_2_days: 2, weekly: 7, every_2_weeks: 14,
    monthly: 30, quarterly: 90, every_6_months: 180, yearly: 365,
  }
  const today = new Date().toISOString().split('T')[0]
  const days  = freqDays[frequency] || 30
  const next  = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
  const { error } = await supabase
    .from('items')
    .update({
      last_purchased_at: today,
      next_purchase_at:  next,
      stock_status:      'stocked',
      in_cart:           false,
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function deleteItem(itemId) {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}

export async function updateStockStatus(itemId, status) {
  const { error } = await supabase
    .from('items')
    .update({ stock_status: status })
    .eq('id', itemId)
  if (error) throw error
}



export async function updateItem(itemId, updates) {
  const { error } = await supabase
    .from('items')
    .update({
      name:      updates.name,
      qty:       updates.qty,
      brand:     updates.brand,
      frequency: updates.frequency,
      cost_inr:  updates.cost_inr,
      source:    updates.source,
      for_whom:  updates.for_whom,
      notes:     updates.notes,
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function updateCategory(categoryId, updates) {
  const { error } = await supabase
    .from('categories')
    .update({ name: updates.name, icon: updates.icon })
    .eq('id', categoryId)
  if (error) throw error
}
// ── Category mutations ────────────────────────────────────────

export async function addCategory(name, icon, sortOrder) {
  const profile = await getMyProfile()
  const { data, error } = await supabase
    .from('categories')
    .insert({
      id:           `${profile.household_id}_custom_${Date.now()}`,
      household_id: profile.household_id,
      name,
      icon:         icon || '📦',
      sort_order:   sortOrder || 99,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(categoryId) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
  if (error) throw error
}
// ── Real-time sync ────────────────────────────────────────────

export function subscribeToItems(householdId, onAnyChange) {
  const channel = supabase
    .channel('items-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items',
        filter: `household_id=eq.${householdId}` },
      () => onAnyChange()
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ── Invites ───────────────────────────────────────────────────

export async function validateInvite(inviteId) {
  const { data, error } = await supabase.rpc('validate_invite', {
    p_invite_id: inviteId,
  })
  if (error) throw error
  return data
}

export async function createInvite({ role = 'member', hours = 48 } = {}) {
  const { data, error } = await supabase.rpc('create_invite', {
    p_role:  role,
    p_hours: hours,
  })
  if (error) throw error
  return data
}

export async function joinHousehold({ inviteId, userName }) {
  const { data, error } = await supabase.rpc('join_household', {
    p_invite_id: inviteId,
    p_user_name: userName,
  })
  if (error) throw error
  return data
}

// ── Coming soon signups ───────────────────────────────────────

export async function saveSignup(email) {
  const { error } = await supabase.from('signups').insert({ email })
  if (error && !error.message?.includes('duplicate')) throw error
}
