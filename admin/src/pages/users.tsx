import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Star, ShieldCheck, Search, UserCircle, ChevronRight, ChevronLeft, FileText, Users, UserCheck, UserX, Crown, RefreshCw, Download, Store, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api, getAdminRole } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PHONE_COUNTRIES, toE164 } from '@/lib/phone'
import { canAdminWrite, canVerifyAccounts } from '@/lib/permissions'

const emptyCreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneLocal: '',
  dial: '+221',
  password: '',
  role: 'admin' as 'admin' | 'client' | 'provider' | 'merchant',
}

export function UsersPage() {
  const navigate = useNavigate()
  const canWrite = canAdminWrite(getAdminRole())
  const canVerify = canVerifyAccounts(getAdminRole())
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [verificationFilter, setVerificationFilter] = useState('all') // all, verified, pending
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({ ...emptyCreateForm })

  const fetchUsers = async () => {
    try {
      const data = await api.users.all()
      setUsers(data)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchUsers()
    setRefreshing(false)
  }

  const handleVerify = async (id: string) => {
    try {
      await api.users.verify(id)
      fetchUsers()
    } catch {
      alert('Erreur lors de la validation')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.phoneLocal.trim() || createForm.password.length < 6) {
      setCreateError('Prénom, nom, téléphone et mot de passe (6+ caractères) sont requis')
      return
    }
    setCreating(true)
    try {
      await api.users.create({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: toE164(createForm.phoneLocal.trim(), createForm.dial),
        password: createForm.password,
        role: createForm.role,
        email: createForm.email.trim() || undefined,
      })
      setShowCreate(false)
      setCreateForm({ ...emptyCreateForm })
      await fetchUsers()
    } catch (err: any) {
      setCreateError(err.message || 'Création impossible')
    } finally {
      setCreating(false)
    }
  }

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesVerification = verificationFilter === 'all' || 
      (verificationFilter === 'verified' && u.isVerified && (u.role === 'provider' || u.role === 'merchant')) ||
      (verificationFilter === 'pending' && !u.isVerified && (u.role === 'provider' || u.role === 'merchant'))
    const matchesSearch = !search ||
      `${u.firstName} ${u.lastName || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    return matchesRole && matchesSearch && matchesVerification
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedUsers = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, verificationFilter, search])

  const roleCounts = {
    all: users.length,
    client: users.filter(u => u.role === 'client').length,
    provider: users.filter(u => u.role === 'provider').length,
    merchant: users.filter(u => u.role === 'merchant').length,
    admin: users.filter(u => u.role === 'admin').length,
  }

  const verifiedProviders = users.filter(u => (u.role === 'provider' || u.role === 'merchant') && u.isVerified).length
  const pendingProviders = users.filter(u => (u.role === 'provider' || u.role === 'merchant') && !u.isVerified).length

  const getInitials = (firstName: string, lastName?: string) =>
    `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()

  const avatarColors = [
    'bg-gradient-to-br from-primary to-primary/70 text-white',
    'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
    'bg-gradient-to-br from-violet-500 to-violet-600 text-white',
    'bg-gradient-to-br from-amber-500 to-orange-500 text-white',
    'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
    'bg-gradient-to-br from-rose-500 to-rose-600 text-white',
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Utilisateurs</h1>
          <p className="text-muted text-sm mt-1">{users.length} utilisateurs inscrits</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => { setCreateError(''); setShowCreate(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {canWrite && showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Nouvel utilisateur</h2>
                <p className="text-xs text-muted">Créer un admin, client, prestataire ou commerçant</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Prénom</label>
                  <Input value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Nom</label>
                  <Input value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email (optionnel)</label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="admin@bagup.app" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Téléphone</label>
                <div className="flex gap-2">
                  <select
                    className="h-10 rounded-md border border-input bg-white px-2 text-sm"
                    value={createForm.dial}
                    onChange={(e) => setCreateForm({ ...createForm, dial: e.target.value })}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={`${c.code}-${c.dial}`} value={c.dial}>{c.flag} {c.dial}</option>
                    ))}
                  </select>
                  <Input
                    value={createForm.phoneLocal}
                    onChange={(e) => setCreateForm({ ...createForm, phoneLocal: e.target.value })}
                    placeholder="77 000 00 00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rôle</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as typeof createForm.role })}
                >
                  <option value="admin">Administrateur</option>
                  <option value="client">Client</option>
                  <option value="provider">Prestataire</option>
                  <option value="merchant">Commerçant</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mot de passe temporaire</label>
                <Input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  minLength={6}
                  required
                />
              </div>
              {createError && <p className="text-sm text-rose-600">{createError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={creating}>{creating ? 'Création…' : 'Créer'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{roleCounts.client}</p>
                <p className="text-sm text-white/80">Clients</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{roleCounts.provider}</p>
                <p className="text-sm text-white/80">Prestataires</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <UserCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{verifiedProviders}</p>
                <p className="text-sm text-white/80">Vérifiés</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{pendingProviders}</p>
                <p className="text-sm text-white/80">En attente</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <UserX className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Tous', icon: Users },
              { key: 'client', label: 'Clients', icon: Users },
              { key: 'provider', label: 'Prestataires', icon: UserCheck },
              { key: 'merchant', label: 'Commerçants', icon: Store },
              { key: 'admin', label: 'Admins', icon: Crown },
            ].map((r) => (
              <button
                key={r.key}
                onClick={() => setRoleFilter(r.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  roleFilter === r.key
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'bg-white border border-border text-muted hover:bg-gray-50 hover:text-foreground hover:border-primary/30'
                }`}
              >
                <r.icon className="h-4 w-4" />
                {r.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-xs ${roleFilter === r.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {roleCounts[r.key as keyof typeof roleCounts] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Filtre par statut de vérification (prestataires) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Tous statuts', count: users.length },
              { key: 'verified', label: '✓ Vérifiés', count: verifiedProviders },
              { key: 'pending', label: '⏳ En attente', count: pendingProviders },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setVerificationFilter(s.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  verificationFilter === s.key
                    ? s.key === 'verified' ? 'bg-success text-white' : s.key === 'pending' ? 'bg-warning text-white' : 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-muted hover:bg-gray-200'
                }`}
              >
                {s.label}
                <span className={`px-1.5 py-0.5 rounded text-xs ${verificationFilter === s.key ? 'bg-white/20' : 'bg-white'}`}>
                  {s.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, téléphone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-xl border-border focus:border-primary focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Utilisateurs ({filtered.length})</CardTitle>
          {totalPages > 1 && (
            <p className="text-sm text-muted">Page {currentPage} sur {totalPages}</p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <UserCircle className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Abonnement</TableHead>
                  <TableHead>Code parrainage</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u, i) => (
                  <TableRow key={u.id} className="cursor-pointer transition-colors hover:bg-gray-50/80" onClick={() => navigate(`/users/${u.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl.startsWith('http') ? u.avatarUrl : `${(import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')}${u.avatarUrl}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${avatarColors[i % avatarColors.length]}`}>
                              {getInitials(u.firstName, u.lastName)}
                            </div>
                          )}
                          {/* Indicateur visuel pour prestataires / commerçants */}
                          {(u.role === 'provider' || u.role === 'merchant') && (
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${u.isVerified ? 'bg-success' : 'bg-warning animate-pulse'}`} title={u.isVerified ? 'Vérifié' : 'En attente de validation'} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{u.firstName} {u.lastName || ''}</p>
                            {(u.role === 'provider' || u.role === 'merchant') && !u.isVerified && (
                              <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">À valider</span>
                            )}
                            {u.role === 'provider' && (
                              <span
                                className="text-xs bg-emerald-500/15 text-emerald-800 px-1.5 py-0.5 rounded font-medium"
                                title="Courses : payées en espèces par le client au chauffeur"
                              >
                                Payé clients
                              </span>
                            )}
                          </div>
                          {u.businessName && <p className="text-xs text-muted">{u.businessName}</p>}
                          {u.email && <p className="text-xs text-muted">{u.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted">
                        <Phone className="h-3.5 w-3.5" />
                        {u.phone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'danger' : u.role === 'provider' ? 'info' : u.role === 'merchant' ? 'success' : 'neutral'}>
                        {u.role === 'merchant'
                          ? (() => {
                              const ch = Array.isArray(u.merchantChannels) ? u.merchantChannels : []
                              if (ch.length === 0) return 'commerçant'
                              const parts = [
                                ch.includes('antigaspi') ? 'AG' : null,
                                ch.includes('marketplace') ? 'Market' : null,
                              ].filter(Boolean)
                              return parts.length ? `commerçant · ${parts.join('+')}` : 'commerçant'
                            })()
                          : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.rating ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                          <span className="font-medium">{u.rating}</span>
                          <span className="text-xs text-muted">({u.totalRatings || 0})</span>
                        </span>
                      ) : (
                        <span className="text-muted text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(u.role === 'provider' || u.role === 'merchant') ? (
                        u.isVerified ? (
                          <Badge variant="success">Vérifié</Badge>
                        ) : (
                          <Badge variant="warning">En attente</Badge>
                        )
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.subscriptionStatus === 'active' ? 'success' : u.subscriptionStatus === 'expired' ? 'danger' : 'neutral'}>
                        {u.subscriptionStatus || 'none'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.referralCode ? (
                        <span className="font-mono text-xs font-semibold text-accent">{u.referralCode}</span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted text-sm">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!u.isVerified && (u.role === 'provider' || u.role === 'merchant') && (
                          <>
                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}`) }}>
                              <FileText className="h-4 w-4" />
                              Documents
                            </Button>
                            {canVerify && (
                              <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleVerify(u.id) }}>
                                <ShieldCheck className="h-4 w-4" />
                                Valider
                              </Button>
                            )}
                          </>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <p className="text-sm text-muted">
                  Affichage {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filtered.length)} sur {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-100 text-muted'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
