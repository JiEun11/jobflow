import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginForm } from '../../features/session/forms'
import { ownerId } from '../../server/auth'

export const metadata = { title: 'Sign in' }

export default async function Login() {
  if (process.env.VERCEL_ENV === 'preview') {
    return <main className="panel mx-auto mt-12 max-w-md">Sign-in is disabled on preview deployments.</main>
  }
  if (await ownerId(await headers())) redirect('/')
  return <main className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-12">
    <div className="panel">
      <p className="mb-2 text-sm font-semibold text-accent">Jobflow</p>
      <h1>Sign in</h1>
      <LoginForm />
    </div>
  </main>
}
