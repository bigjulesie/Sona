export async function hasActiveSubscription(
  supabase: any,
  userId: string,
  portraitId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', userId)
    .eq('portrait_id', portraitId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return !!data
}
