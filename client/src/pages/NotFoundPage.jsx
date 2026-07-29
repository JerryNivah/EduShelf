import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-300">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">Page not found</h1>
      <Link
        className="mt-5 inline-flex rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        to="/"
      >
        Return home
      </Link>
    </section>
  )
}
