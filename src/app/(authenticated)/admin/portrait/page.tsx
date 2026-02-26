import { createAdminClient } from '@/lib/supabase/admin'
import PortraitEditor from './PortraitEditor'

export default async function PortraitPage() {
  const supabase = createAdminClient()

  const { data: portraits, error } = await supabase
    .from('portraits')
    .select('id, slug, display_name, system_prompt, voice_enabled, voice_provider_id')
    .order('created_at', { ascending: true })

  if (error) {
    return (
      <div>
        <h2 className="font-display text-2xl text-ink mb-6 font-normal">Sona</h2>
        <p className="text-red-700 text-sm bg-red-50 rounded p-3">{error.message}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink mb-1 font-normal">Sona</h2>
      <p className="text-sm text-mist mb-6">
        {portraits && portraits.length > 0
          ? 'Edit a Sona\'s identity and system prompt.'
          : 'No Sonas yet. Create your first one below.'}
      </p>
      <PortraitEditor portraits={portraits ?? []} />
    </div>
  )
}
