import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateSonaSettings } from './actions'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

export default async function DashboardSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('tagline, bio, category, monthly_price_cents')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) redirect('/dashboard/create')

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-8">Sona settings</h1>
      <form action={updateSonaSettings} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
          <input name="tagline" defaultValue={portrait.tagline ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea name="bio" rows={5} defaultValue={portrait.bio ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select name="category" defaultValue={portrait.category ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit"
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
          Save changes
        </button>
      </form>

      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-1">Pricing</h2>
        <p className="text-sm text-gray-500 mb-1">
          {portrait.monthly_price_cents
            ? `$${(portrait.monthly_price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/month`
            : 'Free'}
        </p>
        <p className="text-xs text-gray-400">Contact support to change your pricing after launch.</p>
      </div>
    </div>
  )
}
