'use client'

import { useState } from 'react'
import { updateUserTier, updateUserAdmin, inviteUser } from './actions'

interface User {
  id: string
  email: string
  full_name: string | null
  access_tier: string
  is_admin: boolean
  created_at: string | null
}

interface Portrait {
  id: string
  display_name: string
}

const inputClass = 'w-full bg-transparent border-b border-brass/30 py-1.5 text-ink text-sm focus:outline-none focus:border-brass placeholder:text-mist/50 transition-colors'
const selectClass = 'bg-parchment border border-brass/20 rounded px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brass transition-colors'

export function UserTable({ users, portraits }: { users: User[]; portraits: Portrait[] }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteTier, setInviteTier] = useState('public')
  const [invitePortrait, setInvitePortrait] = useState(portraits[0]?.id ?? '')
  const [inviteAdmin, setInviteAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const result = await inviteUser(inviteEmail, inviteTier, invitePortrait, inviteAdmin)
    if (result.error) {
      setMessage(`Error: ${result.error}`)
    } else {
      setMessage('Invitation sent.')
      setInviteEmail('')
      setInviteAdmin(false)
    }
    setLoading(false)
  }

  async function handleTierChange(userId: string, tier: string) {
    await updateUserTier(userId, tier)
  }

  async function handleAdminToggle(userId: string, isAdmin: boolean) {
    await updateUserAdmin(userId, isAdmin)
  }

  return (
    <>
      {/* Invite form */}
      <form onSubmit={handleInvite} className="bg-vellum border border-brass/20 rounded p-5 mb-6 flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs tracking-widest uppercase text-mist mb-2">Email</label>
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            type="email"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs tracking-widest uppercase text-mist mb-2">Access Tier</label>
          <select value={inviteTier} onChange={e => setInviteTier(e.target.value)} className={selectClass}>
            <option value="public">Public</option>
            <option value="acquaintance">Acquaintance</option>
            <option value="colleague">Colleague</option>
            <option value="family">Family</option>
          </select>
        </div>
        <div>
          <label className="block text-xs tracking-widest uppercase text-mist mb-2">Portrait</label>
          <select value={invitePortrait} onChange={e => setInvitePortrait(e.target.value)} className={selectClass}>
            {portraits.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="block text-xs tracking-widest uppercase text-mist">Admin</label>
          <label className="flex items-center gap-2 cursor-pointer pb-1.5">
            <input
              type="checkbox"
              checked={inviteAdmin}
              onChange={e => setInviteAdmin(e.target.checked)}
              className="accent-ink w-4 h-4"
            />
            <span className="text-xs text-mist">Platform admin</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-ink text-parchment text-xs tracking-widest uppercase hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending…' : 'Invite'}
        </button>
      </form>

      {message && (
        <p className={`text-sm mb-4 ${message.startsWith('Error') ? 'text-red-700' : 'text-brass'}`}>
          {message}
        </p>
      )}

      {/* Users table */}
      <div className="bg-vellum border border-brass/20 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-brass/20">
            <tr>
              {['Email', 'Name', 'Access Tier', 'Admin', 'Joined'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs tracking-widest uppercase text-mist font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-brass/10">
                <td className="px-4 py-3 text-ink">{user.email}</td>
                <td className="px-4 py-3 text-mist">{user.full_name || '—'}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={user.access_tier}
                    onChange={e => handleTierChange(user.id, e.target.value)}
                    className="bg-parchment border border-brass/20 rounded px-2 py-1 text-xs text-ink focus:outline-none focus:border-brass"
                  >
                    <option value="public">Public</option>
                    <option value="acquaintance">Acquaintance</option>
                    <option value="colleague">Colleague</option>
                    <option value="family">Family</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    defaultChecked={user.is_admin}
                    onChange={e => handleAdminToggle(user.id, e.target.checked)}
                    className="accent-ink w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-mist text-xs">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
