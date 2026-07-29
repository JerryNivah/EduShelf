import { BookOpen, Moon, ShieldCheck, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useThemeStore } from '../store/useThemeStore.js'

const navItems = [
  { to: '/', label: 'Customer' },
  { to: '/admin', label: 'Admin' },
  { to: '/login', label: 'Sign in' },
]

function navLinkClass({ isActive }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-emerald-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  ].join(' ')
}

export function AppLayout() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-emerald-900 text-white">
              <BookOpen size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-semibold leading-tight">EduShelf</span>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                School bookstore system
              </span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:flex">
              <ShieldCheck size={16} aria-hidden="true" />
              Module 1
            </span>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              <ThemeIcon size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
