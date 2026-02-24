import { createAdminClient } from '@/lib/supabase/admin'
import { UserTable } from './UserTable'

export default async function UsersPage() {
  const supabase = createAdminClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, access_tier, is_admin, created_at')
    .order('created_at', { ascending: false })

  const { data: portraits } = await supabase
    .from('portraits')
    .select('id, display_name')

  return (
    <div>
      <h2 className="text-lg font-medium text-stone-900 mb-6">User Management</h2>
      <UserTable users={users ?? []} portraits={portraits ?? []} />
    </div>
  )
}
