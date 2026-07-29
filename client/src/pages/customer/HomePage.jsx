import { motion } from 'framer-motion'
import { Boxes, Route, ServerCog } from 'lucide-react'

const setupItems = [
  {
    title: 'Client',
    detail: 'React 19, Vite, TailwindCSS, Router, Zustand, and React Query are wired.',
    icon: Route,
  },
  {
    title: 'API',
    detail: 'Vercel Serverless Function folders are ready under the root api directory.',
    icon: ServerCog,
  },
  {
    title: 'Structure',
    detail: 'Customer, admin, shared component, store, service, and docs folders are in place.',
    icon: Boxes,
  },
]

export function HomePage() {
  return (
    <section className="grid gap-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <p className="mb-3 text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-300">
          EduShelf
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-5xl">
          Module 1 foundation is ready.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
          The application shell is intentionally limited to setup concerns so later modules can add authentication,
          catalog, checkout, payment, and admin workflows without replacing the foundation.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {setupItems.map((item) => {
          const Icon = item.icon

          return (
            <article
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              key={item.title}
            >
              <div className="mb-5 grid size-11 place-items-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
