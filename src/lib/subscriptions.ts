export async function hasActiveSubscription(
  supabase: any,
  userId: string,
  portraitId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', userId)
    .eq('portrait_id', portraitId)
    .eq('status', 'active')
    .maybeSingle()
  return !!data
}
