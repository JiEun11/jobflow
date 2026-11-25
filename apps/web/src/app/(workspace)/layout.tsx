import Link from 'next/link'
import { LogoutButton } from '../../features/session/forms'

export default function Workspace({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[224px_minmax(0,1fr)]">
    <aside className="border-b border-line bg-white px-5 py-5 lg:border-r lg:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3 lg:items-start">
        <Link className="text-xl font-semibold tracking-tight" href="/">Jobflow</Link>
        <nav aria-label="Workspace" className="order-3 flex w-full flex-wrap gap-x-5 gap-y-2 lg:order-none lg:grid lg:my-6">
          <Link className="text-link" href="/">Today</Link>
          <Link className="text-link" href="/profile">Career profile</Link>
        </nav>
        <LogoutButton />
      </div>
    </aside>
    <main className="min-w-0 p-4 sm:p-8 lg:p-10">{children}</main>
  </div>
}
