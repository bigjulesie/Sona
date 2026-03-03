import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateInterviewStatus, publishSona } from './actions'

export default async function AdminInterviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const { data: requests } = await supabase
    .from('interview_requests')
    .select(`
      id, whatsapp_number, notes, status, created_at,
      portraits(id, display_name, is_public, slug),
      profiles!creator_id(email, full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Interview Requests</h1>
      {requests && requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map(req => {
            const portrait = req.portraits as any
            const creator = req.profiles as any
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{portrait?.display_name}</p>
                    <p className="text-sm text-gray-500">{creator?.full_name ?? creator?.email}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      WhatsApp: <span className="font-mono">{req.whatsapp_number}</span>
                    </p>
                    {req.notes && <p className="text-sm text-gray-400 mt-0.5">Notes: {req.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      req.status === 'completed' ? 'bg-green-50 text-green-600' :
                      req.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{req.status}</span>
                    <div className="flex gap-2">
                      {req.status === 'pending' && (
                        <form action={updateInterviewStatus.bind(null, req.id, 'scheduled')}>
                          <button className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">
                            Mark scheduled
                          </button>
                        </form>
                      )}
                      {req.status === 'scheduled' && (
                        <form action={updateInterviewStatus.bind(null, req.id, 'completed')}>
                          <button className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">
                            Mark complete
                          </button>
                        </form>
                      )}
                      {req.status === 'completed' && portrait && !portrait.is_public && (
                        <form action={publishSona.bind(null, portrait.id)}>
                          <button className="text-xs px-3 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                            Publish Sona
                          </button>
                        </form>
                      )}
                      {portrait?.is_public && (
                        <a href={`/sona/${portrait.slug}`} target="_blank"
                          className="text-xs text-green-600 hover:underline">&#10003; Live &#8599;</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-gray-400">No interview requests yet.</p>
      )}
    </div>
  )
}
