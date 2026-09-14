import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, PackageSearch, ChevronRight, ChevronLeft, RefreshCw, Download, Clock, CheckCircle2, XCircle, Activity, TrendingUp, FileText, ShoppingBag, Truck, Search, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api, getAdminRole } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'
import { canManagerWrite } from '@/lib/permissions'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  in_progress: 'En cours',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

const SERVICE_ICONS: Record<string, any> = {
  colis: Package,
  documents: FileText,
  courses: ShoppingBag,
  depot_administratif: FileText,
  default: Truck,
}

const serviceTypeLabels: Record<string, string> = {
  colis: 'Livraison de colis',
  documents: 'Livraison de documents',
  courses: 'Courses',
  marchandises: 'Transport de marchandises',
  objets_personnels: 'Objets personnels',
  depot_administratif: 'Démarches administratives',
  livraison_entreprise: 'Livraison entreprise',
  collecte_marchandises: 'Collecte de marchandises',
}

const serviceDetailLabels: Record<string, string> = {
  recipientName: 'Destinataire',
  packageType: 'Type de colis',
  packageSize: 'Taille',
  documentType: 'Document',
  procedureType: 'Démarche',
  administrationName: 'Administration',
  merchantName: 'Commerce',
  storeName: 'Boutique',
  shoppingList: 'Courses',
  instructions: 'Instructions',
  fragile: 'Fragile',
  requiresSignature: 'Signature',
  itemCount: 'Articles',
  weight: 'Poids',
}

function formatServiceDetailLabel(key: string) {
  return serviceDetailLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function formatServiceDetailValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  return ''
}

function getMissionHighlights(mission: any) {
  const details = mission.serviceDetails && typeof mission.serviceDetails === 'object'
    ? mission.serviceDetails as Record<string, unknown>
    : {}

  const priorityKeys = [
    'recipientName',
    'packageType',
    'packageSize',
    'documentType',
    'procedureType',
    'administrationName',
    'merchantName',
    'storeName',
    'itemCount',
    'weight',
    'fragile',
    'requiresSignature',
  ]

  const picked = priorityKeys
    .map((key) => {
      const raw = details[key]
      const value = formatServiceDetailValue(raw)
      return value ? { key, label: formatServiceDetailLabel(key), value } : null
    })
    .filter(Boolean)
    .slice(0, 2) as Array<{ key: string; label: string; value: string }>

  if (!picked.length && typeof details.instructions === 'string' && details.instructions.trim()) {
    return [{ key: 'instructions', label: 'Instructions', value: details.instructions.trim() }]
  }

  return picked
}

export function MissionsPage() {
  const navigate = useNavigate()
  const canWrite = canManagerWrite(getAdminRole())
  const [tab, setTab] = useState<'list' | 'payouts'>('list')
  const [missions, setMissions] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const fetchMissions = async () => {
    try {
      const data = await api.missions.all()
      setMissions(data)
    } catch {
      setMissions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPayouts = async () => {
    try {
      const data = await api.missions.adminPayouts()
      setPayouts(data)
    } catch {
      setPayouts([])
    }
  }

  useEffect(() => {
    fetchMissions()
    fetchPayouts()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchMissions(), fetchPayouts()])
    setRefreshing(false)
  }

  const handleMarkPaidOut = async (id: string) => {
    setMarkingId(id)
    try {
      await api.missions.adminMarkPaidOut(id)
      await fetchPayouts()
    } catch (e: any) {
      alert(e?.message || 'Échec du marquage')
    } finally {
      setMarkingId(null)
    }
  }

  const filtered = missions.filter(m => {
    const matchesFilter = filter === 'all' || m.status === filter
    const matchesSearch = !search ||
      m.serviceType?.toLowerCase().includes(search.toLowerCase()) ||
      m.pickupAddress?.toLowerCase().includes(search.toLowerCase()) ||
      m.deliveryAddress?.toLowerCase().includes(search.toLowerCase()) ||
      m.client?.firstName?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedMissions = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search])

  const statusCounts = missions.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalRevenue = missions.filter(m => m.status === 'delivered').reduce((sum, m) => sum + (Number(m.price) || 0), 0)
  const activeMissions = (statusCounts['pending'] || 0) + (statusCounts['accepted'] || 0) + (statusCounts['in_progress'] || 0)
  const eligiblePayouts = payouts.filter((p) => p.payoutStatus === 'eligible')
  const eligibleTotal = eligiblePayouts.reduce((sum, p) => sum + Number(p.providerAmount || p.price || 0), 0)

  const filters = [
    { key: 'all', label: 'Toutes', icon: Package, color: 'bg-gray-500' },
    { key: 'pending', label: 'En attente', icon: Clock, color: 'bg-amber-500' },
    { key: 'accepted', label: 'Acceptées', icon: CheckCircle2, color: 'bg-blue-500' },
    { key: 'in_progress', label: 'En cours', icon: Activity, color: 'bg-indigo-500' },
    { key: 'delivered', label: 'Livrées', icon: CheckCircle2, color: 'bg-emerald-500' },
    { key: 'cancelled', label: 'Annulées', icon: XCircle, color: 'bg-rose-500' },
  ]

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground font-heading">Missions</h1>
          <p className="text-muted text-sm mt-1">{missions.length} missions au total</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-xl border border-border bg-white p-1">
            <button
              onClick={() => setTab('list')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'list' ? 'bg-primary text-white' : 'text-muted'}`}
            >
              Liste
            </button>
            <button
              onClick={() => setTab('payouts')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${tab === 'payouts' ? 'bg-primary text-white' : 'text-muted'}`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Reversements
              {eligiblePayouts.length > 0 && (
                <span className={`text-xs px-1.5 rounded ${tab === 'payouts' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                  {eligiblePayouts.length}
                </span>
              )}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {tab === 'payouts' ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Reversements prestataires · {formatFCFA(eligibleTotal)} à verser
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucun reversement</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mission</TableHead>
                    <TableHead>Prestataire</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Éligible le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <button
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/missions/${p.id}`)}
                        >
                          {serviceTypeLabels[p.serviceType] || p.serviceType}
                        </button>
                        <p className="text-xs text-muted truncate max-w-[200px]">{p.deliveryAddress}</p>
                      </TableCell>
                      <TableCell>
                        {p.provider?.firstName} {p.provider?.lastName}
                      </TableCell>
                      <TableCell className="text-sm">{p.provider?.phone || '—'}</TableCell>
                      <TableCell className="font-semibold">
                        {formatFCFA(Number(p.providerAmount || p.price || 0))}
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {p.payoutEligibleAt ? formatDate(p.payoutEligibleAt) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.payoutStatus === 'paid_out' ? 'success' : 'warning'}>
                          {p.payoutStatus === 'paid_out' ? 'Versé' : 'À verser'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canWrite && p.payoutStatus === 'eligible' && (
                          <Button
                            size="sm"
                            disabled={markingId === p.id}
                            onClick={() => handleMarkPaidOut(p.id)}
                          >
                            {markingId === p.id ? '…' : 'Marquer versé'}
                          </Button>
                        )}
                        {p.payoutStatus === 'paid_out' && p.paidOutAt && (
                          <span className="text-xs text-muted">{formatDate(p.paidOutAt)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-primary to-primary/80 text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold font-heading">{missions.length}</p>
                <p className="text-sm text-white/80">Total missions</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold font-heading">{activeMissions}</p>
                <p className="text-sm text-white/80">En cours</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold font-heading">{statusCounts['delivered'] || 0}</p>
                <p className="text-sm text-white/80">Livrées</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold font-heading truncate">{formatFCFA(totalRevenue)}</p>
                <p className="text-sm text-white/80">Revenus</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                filter === f.key
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-white border border-border text-muted hover:bg-gray-50 hover:text-foreground hover:border-primary/30'
              }`}
            >
              <f.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{f.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                {f.key === 'all' ? missions.length : statusCounts[f.key] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une mission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl border-border focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Missions ({filtered.length})</CardTitle>
          {totalPages > 1 && (
            <p className="text-sm text-muted">
              Page {currentPage} sur {totalPages}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <PackageSearch className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucune mission trouvée</p>
            </div>
          ) : (
            <>
              {/* Vue Desktop - Tableau */}
              <div className="hidden lg:block">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Type</TableHead>
                      <TableHead className="w-[220px]">Itinéraire</TableHead>
                      <TableHead className="w-[140px]">Client</TableHead>
                      <TableHead className="w-[140px]">Prestataire</TableHead>
                      <TableHead className="w-[90px]">Urgence</TableHead>
                      <TableHead className="w-[100px]">Prix</TableHead>
                      <TableHead className="w-[100px]">Statut</TableHead>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMissions.map((m) => (
                      <TableRow key={m.id} className="cursor-pointer transition-colors hover:bg-gray-50/80" onClick={() => navigate(`/missions/${m.id}`)}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-sm truncate block">
                                {serviceTypeLabels[m.serviceType] || m.serviceType}
                              </span>
                              {getMissionHighlights(m).map((item) => (
                                <p key={item.key} className="text-[11px] text-muted truncate mt-0.5">
                                  <span className="font-medium">{item.label}:</span> {item.value}
                                </p>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted flex items-center gap-1 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="truncate">{m.pickupAddress || '—'}</span>
                            </p>
                            <p className="text-xs text-muted flex items-center gap-1 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                              <span className="truncate">{m.deliveryAddress || '—'}</span>
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {m.client ? (
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{m.client.firstName} {m.client.lastName || ''}</p>
                              <p className="text-xs text-muted truncate">{m.client.phone}</p>
                            </div>
                          ) : (
                            <span className="text-muted text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.provider ? (
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{m.provider.firstName} {m.provider.lastName || ''}</p>
                              <p className="text-xs text-muted truncate">{m.provider.phone}</p>
                            </div>
                          ) : (
                            <span className="text-muted text-sm italic">Non assigné</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.urgency === 'express' ? 'danger' : m.urgency === 'programme' ? 'info' : 'neutral'} className="text-xs">
                            {m.urgency}
                          </Badge>
                          {m.scheduledAt && (
                            <p className="mt-1 text-[11px] font-medium text-blue-600">Prévue {formatDate(m.scheduledAt)}</p>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground text-sm">{formatFCFA(m.price)}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === 'delivered' ? 'success' : m.status === 'cancelled' ? 'danger' : m.status === 'pending' ? 'warning' : 'info'} className="text-xs">
                            {STATUS_LABELS[m.status] || m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted text-xs">{formatDate(m.createdAt)}</TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vue Mobile - Cartes */}
              <div className="lg:hidden space-y-3">
                {paginatedMissions.map((m) => {
                  const ServiceIcon = SERVICE_ICONS[m.serviceType] || SERVICE_ICONS.default
                  const highlights = getMissionHighlights(m)
                  return (
                    <div
                      key={m.id}
                      onClick={() => navigate(`/missions/${m.id}`)}
                      className="p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer bg-white"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <ServiceIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{serviceTypeLabels[m.serviceType] || m.serviceType}</p>
                            <p className="text-xs text-muted">{formatDate(m.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{formatFCFA(m.price)}</p>
                          <Badge variant={m.urgency === 'express' ? 'danger' : m.urgency === 'programme' ? 'info' : 'neutral'} className="mt-1">
                            {m.urgency}
                          </Badge>
                          {m.scheduledAt && (
                            <p className="mt-1 text-[11px] font-medium text-blue-600">Prévue {formatDate(m.scheduledAt)}</p>
                          )}
                        </div>
                      </div>

                      {/* Itinéraire */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <p className="text-sm text-foreground line-clamp-1">{m.pickupAddress || 'Adresse de retrait'}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                          <p className="text-sm text-foreground line-clamp-1">{m.deliveryAddress || 'Adresse de livraison'}</p>
                        </div>
                      </div>

                      {/* Client & Prestataire */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-muted mb-1">Client</p>
                          {m.client ? (
                            <p className="text-sm font-medium text-foreground">{m.client.firstName} {m.client.lastName || ''}</p>
                          ) : (
                            <p className="text-sm text-muted">N/A</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted mb-1">Prestataire</p>
                          {m.provider ? (
                            <p className="text-sm font-medium text-foreground">{m.provider.firstName} {m.provider.lastName || ''}</p>
                          ) : (
                            <p className="text-sm text-muted italic">Non assigné</p>
                          )}
                        </div>
                      </div>

                      {highlights.length > 0 && (
                        <div className="mb-3 rounded-lg bg-blue-50 p-3">
                          {highlights.map((item) => (
                            <p key={item.key} className="text-xs text-foreground">
                              <span className="font-medium">{item.label}:</span> {item.value}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <Badge variant={m.status === 'delivered' ? 'success' : m.status === 'cancelled' ? 'danger' : m.status === 'pending' ? 'warning' : 'info'}>
                          {STATUS_LABELS[m.status] || m.status}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-primary font-medium">
                          Voir détails
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

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
      </>
      )}
    </div>
  )
}
