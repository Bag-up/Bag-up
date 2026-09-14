import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Package, UserPlus, KeyRound, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api, getAdminRole, getAdminUser } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { roleLabelFr } from '@/lib/permissions'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Utilisateurs',
  '/missions': 'Missions',
  '/payments': 'Paiements',
  '/subscriptions': 'Abonnements',
  '/anti-gaspi': 'Anti-Gaspi',
  '/disputes': 'Litiges',
  '/referrals': 'Parrainage',
  '/loyalty': 'Fidélité',
  '/tariffs': 'Tarifs & Assurance',
  '/procedures': 'Démarches admin',
  '/profile': 'Mon profil',
}

interface Notif {
  id: string
  type: 'mission' | 'user'
  label: string
  sub: string
  date: string
  route: string
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>(localStorage.getItem('admin_last_notif') || new Date(0).toISOString())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState('')

  const title = titles[location.pathname] ||
    (location.pathname.startsWith('/users/') ? 'Détail utilisateur' :
    location.pathname.startsWith('/missions/') ? 'Détail mission' : 'Bag\'up Admin')
  const role = getAdminRole()
  const adminUser = getAdminUser()

  useEffect(() => {
    const checkNotifs = async () => {
      try {
        const [missions, users] = await Promise.all([
          api.missions.all().catch(() => []),
          api.users.all().catch(() => []),
        ])
        const newNotifs: Notif[] = []
        const lastDate = new Date(lastCheck)

        missions.slice(0, 10).forEach((m: any) => {
          if (new Date(m.createdAt) > lastDate) {
            newNotifs.push({
              id: `m-${m.id}`,
              type: 'mission',
              label: `Nouvelle mission: ${m.serviceType}`,
              sub: `${m.pickupAddress} → ${m.deliveryAddress}`,
              date: m.createdAt,
              route: `/missions/${m.id}`,
            })
          }
        })

        // Comptes presta/commerçant en attente de validation (prioritaires)
        ;(users as any[])
          .filter(
            (u) =>
              !u.isVerified &&
              (u.role === 'provider' || u.role === 'merchant') &&
              u.isActive !== false,
          )
          .slice(0, 10)
          .forEach((u: any) => {
            const roleFr = u.role === 'merchant' ? 'commerçant' : 'prestataire'
            newNotifs.push({
              id: `pending-${u.id}`,
              type: 'user',
              label: `À valider · ${roleFr}: ${u.firstName || ''} ${u.lastName || ''}`.trim(),
              sub: u.phone,
              date: u.createdAt,
              route: `/users/${u.id}`,
            })
          })

        users.slice(0, 10).forEach((u: any) => {
          if (new Date(u.createdAt) > lastDate) {
            // Éviter le doublon avec « À valider »
            if (
              !u.isVerified &&
              (u.role === 'provider' || u.role === 'merchant')
            ) {
              return
            }
            newNotifs.push({
              id: `u-${u.id}`,
              type: 'user',
              label: `Nouvel utilisateur: ${u.firstName} ${u.lastName || ''}`,
              sub: u.phone,
              date: u.createdAt,
              route: `/users/${u.id}`,
            })
          }
        })

        // Dédupliquer par id, prioriser les « À valider »
        const seen = new Set<string>()
        const unique = newNotifs.filter((n) => {
          if (seen.has(n.id) || seen.has(n.route)) return false
          seen.add(n.id)
          seen.add(n.route)
          return true
        })
        unique.sort((a, b) => {
          const aPending = a.id.startsWith('pending-') ? 1 : 0
          const bPending = b.id.startsWith('pending-') ? 1 : 0
          if (aPending !== bPending) return bPending - aPending
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        })
        setNotifs(unique.slice(0, 8))
      } catch {}
    }

    checkNotifs()
    const interval = setInterval(checkNotifs, 30000)
    return () => clearInterval(interval)
  }, [lastCheck])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = () => {
    const now = new Date().toISOString()
    localStorage.setItem('admin_last_notif', now)
    setLastCheck(now)
    setNotifs([])
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdOk('')
    if (newPassword.length < 6) {
      setPwdError('Le nouveau mot de passe doit contenir au moins 6 caractères')
      return
    }
    setPwdBusy(true)
    try {
      await api.users.changeMyPassword(currentPassword, newPassword)
      setPwdOk('Mot de passe mis à jour')
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => {
        setShowPwd(false)
        setPwdOk('')
      }, 1200)
    } catch (err: any) {
      setPwdError(err.message || 'Échec du changement')
    } finally {
      setPwdBusy(false)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
      <div className="min-w-0 ml-12 lg:ml-0">
        <h1 className="font-heading text-base sm:text-xl font-bold text-foreground truncate">{title}</h1>
        {role && (
          <p className="text-xs text-muted truncate">
            {roleLabelFr(role)}
            {adminUser?.firstName ? ` · ${adminUser.firstName}` : ''}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 lg:w-64 pl-9"
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            className="relative rounded-lg p-2 hover:bg-gray-100 transition-colors"
            onClick={() => setOpen(!open)}
          >
            <Bell className="h-5 w-5 text-muted" />
            {notifs.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {notifs.length}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-semibold text-sm text-foreground">Notifications</span>
                {notifs.length > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">Aucune nouvelle notification</p>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { navigate(n.route); setOpen(false) }}
                      className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.type === 'mission' ? 'bg-primary-soft' : 'bg-info-soft'}`}>
                        {n.type === 'mission' ? <Package className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-info" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{n.label}</p>
                        <p className="text-xs text-muted truncate">{n.sub}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(n.date)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          title="Changer mon mot de passe"
          onClick={() => { setShowPwd(true); setPwdError(''); setPwdOk(''); setCurrentPassword(''); setNewPassword('') }}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-gray-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Mot de passe
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-semibold text-white shadow-sm">
          AD
        </div>
      </div>

      {showPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-heading text-lg font-bold">Changer mon mot de passe</h2>
              <button type="button" onClick={() => setShowPwd(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Mot de passe actuel</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              </div>
              {pwdError && <p className="text-sm text-rose-600">{pwdError}</p>}
              {pwdOk && <p className="text-sm text-emerald-600">{pwdOk}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPwd(false)}>Annuler</Button>
                <Button type="submit" disabled={pwdBusy}>{pwdBusy ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
