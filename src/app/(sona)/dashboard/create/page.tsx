import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSonaIdentity } from './actions'
import { InterviewStep } from './InterviewStep'
import { PricingStep } from './PricingStep'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

const STEPS = ['Identity', 'Interview', 'Content', 'Pricing']

interface PageProps {
  searchParams: Promise<{ step?: string; portrait_id?: string }>
}

export default async function CreateSonaPage({ searchParams }: PageProps) {
  const { step = '1', portrait_id } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (existing && step === '1') redirect('/dashboard')

  return (
    <div className="max-w-lg mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 text-sm">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i + 1 <= parseInt(step) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
            }`}>{i + 1}</div>
            <span className={i + 1 === parseInt(step) ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {step === '1' && (
        <form action={createSonaIdentity} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your full name</label>
            <input name="display_name" required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
            <input name="tagline" placeholder="One sentence about you"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea name="bio" rows={4} placeholder="Tell people about yourself"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="category"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input name="tags" placeholder="e.g. startups, investing, leadership"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <button type="submit"
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
            Continue
          </button>
        </form>
      )}

      {step === '2' && portrait_id && <InterviewStep portraitId={portrait_id} />}

      {step === '3' && portrait_id && (
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Add content (optional)</h2>
          <p className="text-gray-500 text-sm mb-6">Upload documents or writings to enrich your Sona. You can always do this later.</p>
          <div className="flex gap-3 justify-center">
            <a href={`/dashboard/content?portrait_id=${portrait_id}`}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-colors">
              Add content
            </a>
            <a href={`/dashboard/create?step=4&portrait_id=${encodeURIComponent(portrait_id)}`}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
              Skip for now
            </a>
          </div>
        </div>
      )}

      {step === '4' && portrait_id && <PricingStep portraitId={portrait_id} />}
    </div>
  )
}
