'use client'

import { useState } from 'react'
import { updateUserTier, inviteUser } from './actions'

interface User {
  id: string
  email: string
  full_name: string | null
  access_tier: string
  created_at: string | null
}

interface Portrait {
  id: string
  display_name: string
}

export function UserTable({ users, portraits }: { users: User[]; portraits: Portrait[] }) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteTier, setInviteTier] = useState('public')
  const [invitePortrait, setInvitePortrait] = useState(portraits[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const result = await inviteUser(inviteEmail, inviteTier, invitePortrait)
    if (result.error) {
      setMessage(`Error: ${result.error}`)
    } else {
      setMessage('Invitation sent!')
      setInviteEmail('')
    }
    setLoading(false)
  }

  async function handleTierChange(userId: string, tier: string) {
    await updateUserTier(userId, tier)
  }

  return (
    <>
      {/* Invite form */}
      <form onSubmit={handleInvite} className="bg-white border border-stone-200 rounded-lg p-4 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-stone-500 block mb-1">Email</label>
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            type="email"
            required
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Tier</label>
          <select
            value={inviteTier}
            onChange={e => setInviteTier(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded text-sm"
          >
            <option value="public">Public</option>
            <option value="acquaintance">Acquaintance</option>
            <option value="colleague">Colleague</option>
            <option value="family">Family</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Portrait</label>
          <select
            value={invitePortrait}
            onChange={e => setInvitePortrait(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded text-sm"
          >
            {portraits.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Invite'}
        </button>
      </form>
      {message && (
        <p className={`text-sm mb-4 ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
          {message}
        </p>
      )}

      {/* Users table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-xs">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Tier</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-stone-100">
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 text-stone-600">{user.full_name || '\u2014'}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={user.access_tier}
                    onChange={e => handleTierChange(user.id, e.target.value)}
                    className="px-2 py-1 border border-stone-200 rounded text-xs"
                  >
                    <option value="public">Public</option>
                    <option value="acquaintance">Acquaintance</option>
                    <option value="colleague">Colleague</option>
                    <option value="family">Family</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-stone-400 text-xs">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
