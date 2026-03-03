import { signUpWithMagicLink } from './actions'

interface PageProps {
  searchParams: Promise<{ sent?: string }>
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const { sent } = await searchParams

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500">We sent you a magic link. Click it to continue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
        <p className="text-gray-500 mb-8">Join Sona — create your digital presence or explore others.</p>
        <form action={signUpWithMagicLink} className="space-y-4">
          <input type="email" name="email" placeholder="your@email.com" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit"
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
            Continue with email
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-gray-700 underline">Sign in</a>
        </p>
      </div>
    </main>
  )
}
