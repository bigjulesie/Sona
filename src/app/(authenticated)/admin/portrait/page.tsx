import { createAdminClient } from '@/lib/supabase/admin'
import PortraitEditor from './PortraitEditor'

export default async function PortraitPage() {
  const supabase = createAdminClient()

  const { data: portraits, error } = await supabase
    .from('portraits')
    .select('id, slug, display_name, system_prompt')
    .order('created_at')

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-medium text-stone-900 mb-6">Portrait</h2>
        <p className="text-red-700 text-sm bg-red-50 rounded p-3">{error.message}</p>
      </div>
    )
  }

  if (!portraits || portraits.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-medium text-stone-900 mb-6">Portrait</h2>
        <p className="text-sm text-stone-500">No portraits found. Create one in the database first.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-stone-900 mb-6">Portrait</h2>
      <PortraitEditor portraits={portraits} />
    </div>
  )
}
