import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Package, CreditCard, Star, LogOut, AlertTriangle, Gift, Settings, Building2, Menu, X, Leaf, Megaphone, Store, Navigation, Trophy, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearToken, getAdminRole, getAdminUser } from '@/lib/api'
import { canAccessPath, roleLabelFr } from '@/lib/permissions'
import { useMemo, useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Utilisateurs', icon: Users },
  { to: '/missions', label: 'Missions', icon: Package },
  { to: '/rides', label: 'Courses', icon: Navigation },
  { to: '/payments', label: 'Paiements', icon: CreditCard },
  { to: '/subscriptions', label: 'Abonnements', icon: Star },
  { to: '/anti-gaspi', label: 'Anti-Gaspi', icon: Leaf },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/content', label: 'Contenu app', icon: Megaphone },
  { to: '/disputes', label: 'Litiges', icon: AlertTriangle },
  { to: '/referrals', label: 'Parrainage', icon: Gift },
  { to: '/loyalty', label: 'Fidélité', icon: Trophy },
  { to: '/tariffs', label: 'Tarifs & Assurance', icon: Settings },
  { to: '/procedures', label: 'Démarches admin', icon: Building2 },
  { to: '/profile', label: 'Mon profil', icon: UserRound },
]

export function Sidebar() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const role = getAdminRole()
  const user = getAdminUser()
  const visibleItems = useMemo(
    () => navItems.filter((item) => canAccessPath(role, item.to)),
    [role],
  )

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const handleNavClick = () => {
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden shadow-md">
            <img src="/logo-sansfond.png" alt="Bag'up" className="h-full w-full object-contain p-0.5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold leading-tight text-foreground">Bag'up</p>
            <p className="text-xs text-muted">{roleLabelFr(role)}</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
        >
          <X className="h-5 w-5 text-muted" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-sidebar-muted hover:bg-gray-50 hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        {(user?.firstName || user?.email) && (
          <p className="px-3 text-xs text-muted truncate">
            {user.firstName || ''} {user.lastName || ''}
            {user.email ? ` · ${user.email}` : ''}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent-soft"
        >
          <LogOut className="h-5 w-5" />
          Déconnexion
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-white shadow-lg border border-border"
      >
        <Menu className="h-6 w-6 text-foreground" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar transform transition-transform duration-300 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>

      <aside className="hidden lg:flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  )
}
