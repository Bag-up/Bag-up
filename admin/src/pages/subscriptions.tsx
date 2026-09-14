import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Users, Wallet, Calendar, AlertTriangle, Clock, CheckCircle2, XCircle, RefreshCw, Download, Search, Shield, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'

function gatewayStatusLabel(status?: string | null) {
  if (!status) return null
  const map: Record<string, string> = {
    aborted: 'Abandonné',
    cancelled: 'Annulé',
    canceled: 'Annulé',
    failed: 'Échoué',
    succeeded: 'Réussi',
    authorized: 'Autorisé',
    pending: 'En attente',
    processing: 'En cours',
    reversed: 'Annulé (reverse)',
  }
  return map[status] || status
}

function gatewayBadgeVariant(status?: string | null): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'succeeded' || status === 'authorized') return 'success'
  if (status === 'aborted' || status === 'cancelled' || status === 'canceled' || status === 'failed' || status === 'reversed') {
    return 'danger'
  }
  if (status === 'pending' || status === 'processing') return 'warning'
  return 'neutral'
}

export function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [activeSubs, setActiveSubs] = useState<any[]>([])
  const [unpaidVerified, setUnpaidVerified] = useState<any[]>([])
  const [stats, setStats] = useState({ totalRevenue: 0, totalSubscriptions: 0, activeProviders: 0, unpaidVerifiedCount: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    const [s, st, as, uv] = await Promise.all([
      api.subscriptions.all().catch(() => []),
      api.subscriptions.stats().catch(() => ({ totalRevenue: 0, totalSubscriptions: 0, activeProviders: 0, unpaidVerifiedCount: 0 })),
      api.subscriptions.active().catch(() => []),
      api.subscriptions.unpaidVerified().catch(() => []),
    ])
    setSubs(s)
    setStats(st)
    setActiveSubs(as)
    setUnpaidVerified(Array.isArray(uv) ? uv : [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const expiringSoon = activeSubs.filter(s => {
    const daysLeft = Math.ceil((new Date(s.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysLeft <= 7 && daysLeft > 0
  }).length

  const expired = activeSubs.filter(s => {
    const daysLeft = Math.ceil((new Date(s.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysLeft <= 0
  }).length

  const withInsurance = activeSubs.filter(s => s.hasInsurance).length

  const filters = [
    { key: 'all', label: 'Tous', icon: Users },
    { key: 'expiring', label: 'Expire bientôt', icon: AlertTriangle },
    { key: 'expired', label: 'Expirés', icon: XCircle },
    { key: 'insured', label: 'Avec assurance', icon: Shield },
  ]

  const filteredSubs = activeSubs.filter(s => {
    const expiry = s.subscriptionExpiry || s.subscriptionEndDate
    const daysLeft = expiry
      ? Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : (typeof s.daysLeft === 'number' ? s.daysLeft : null)
    const insured = Boolean(s.hasInsurance || s.insuranceEligible)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'expiring' && daysLeft !== null && daysLeft <= 7 && daysLeft > 0) ||
      (filter === 'expired' && (s.isExpired || (daysLeft !== null && daysLeft <= 0))) ||
      (filter === 'insured' && insured)
    const matchesSearch = !search ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
    return matchesFilter && matchesSearch
  })

  const statusCounts = {
    all: activeSubs.length,
    expiring: expiringSoon,
    expired: expired,
    insured: withInsurance,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Abonnements</h1>
          <p className="text-muted text-sm mt-1">{stats.activeProviders} prestataires abonnés</p>
        </div>
        <div className="flex items-center gap-2">
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

      {unpaidVerified.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900">
              {unpaidVerified.length} compte{unpaidVerified.length > 1 ? 's' : ''} validé
              {unpaidVerified.length > 1 ? 's' : ''} sans paiement
            </p>
            <p className="text-sm text-amber-800 mt-1">
              Validés côté admin mais aucun frais d’adhésion / abonnement boutique encaissé.
              Relance-les pour qu’ils paient dans l’app.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{formatFCFA(stats.totalRevenue)}</p>
                <p className="text-sm text-white/80">Revenus totaux</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{stats.activeProviders}</p>
                <p className="text-sm text-white/80">Abonnés actifs</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{unpaidVerified.length || stats.unpaidVerifiedCount || 0}</p>
                <p className="text-sm text-white/80">Validés sans paiement</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{expiringSoon}</p>
                <p className="text-sm text-white/80">Expire bientôt</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{withInsurance}</p>
                <p className="text-sm text-white/80">Assurés (≥4 mois)</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {unpaidVerified.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Validés sans paiement — à relancer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Attendu</TableHead>
                  <TableHead>Statut abo</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidVerified.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {u.firstName} {u.lastName || ''}
                      </span>
                      {u.businessName && (
                        <p className="text-xs text-muted mt-0.5">{u.businessName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'merchant' ? 'info' : 'neutral'}>
                        {u.role === 'merchant' ? 'Commerçant' : 'Prestataire'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted">{u.phone}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-semibold text-foreground">{formatFCFA(u.expectedFee)}</span>
                      <p className="text-xs text-muted">{u.expectedLabel}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">{u.subscriptionStatus || 'none'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <Link
                        to={`/users/${u.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Fiche <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-white border border-border text-muted hover:bg-gray-50 hover:text-foreground hover:border-primary/30'
              }`}
            >
              <f.icon className="h-4 w-4" />
              {f.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-xs ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                {statusCounts[f.key as keyof typeof statusCounts] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un prestataire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl border-border focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Abonnements actifs & suivi d'expiration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Users className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucun abonnement actif</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestataire</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Jours restants</TableHead>
                  <TableHead>Assurance (4 mois continus)</TableHead>
                  <TableHead>Alerte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-medium text-foreground">{s.firstName} {s.lastName || ''}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted">{s.phone}</TableCell>
                    <TableCell className="text-sm text-muted">{s.zone || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={s.isExpired || s.subscriptionStatus !== 'active' ? 'danger' : 'success'}>
                        {s.isExpired || s.subscriptionStatus !== 'active' ? (
                          <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Expiré</span>
                        ) : (
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Actif</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted">
                      {s.subscriptionExpiry ? formatDate(s.subscriptionExpiry) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {s.daysLeft !== null ? (
                        <span className={`font-semibold ${s.daysLeft <= 0 ? 'text-accent' : s.daysLeft <= 7 ? 'text-warning' : 'text-foreground'}`}>
                          {s.daysLeft > 0 ? `${s.daysLeft} jour${s.daysLeft > 1 ? 's' : ''}` : 'Expiré'}
                        </span>
                      ) : (
                        <span className="text-muted text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">
                          {s.consecutiveMonths || 0}/4 mois payés
                        </span>
                        {s.insuranceEligible ? (
                          <Badge variant="success">
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Assuré</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted">
                            Encore {Math.max(0, 4 - (s.consecutiveMonths || 0))} mois d&apos;abonnement pour l&apos;assurance
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.isExpired ? (
                        <Badge variant="danger">
                          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Expiré</span>
                        </Badge>
                      ) : s.isExpiringSoon ? (
                        <Badge variant="warning">
                          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Bientôt expiré</span>
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK</span>
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des abonnements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Calendar className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucun abonnement</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Passerelle</TableHead>
                  <TableHead>Réf. transaction</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => {
                  const gatewayLabel = gatewayStatusLabel(s.gatewayStatus)
                  const ref = s.transactionId || s.providerRef
                  return (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.user ? (
                        <div>
                          <span className="font-medium text-foreground">{s.user.firstName} {s.user.lastName || ''}</span>
                          {s.user.phone ? (
                            <p className="text-xs text-muted mt-0.5">{s.user.phone}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <Star className="h-4 w-4 text-warning" />
                        {s.type === 'registration'
                          ? 'Inscription'
                          : s.type === 'merchant_monthly'
                            ? 'Boutique'
                            : 'Mensuel'}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{formatFCFA(s.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'success' ? 'success' : s.status === 'failed' ? 'danger' : 'warning'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {gatewayLabel || s.provider ? (
                        <div className="space-y-1">
                          {gatewayLabel ? (
                            <Badge variant={gatewayBadgeVariant(s.gatewayStatus)}>
                              {gatewayLabel}
                            </Badge>
                          ) : null}
                          <p className="text-xs text-muted">
                            {[s.provider, s.pspName, s.paymentChannel].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted text-sm font-mono text-xs" title={ref || undefined}>
                      {ref ? `${String(ref).slice(0, 14)}…` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted text-sm">{formatDate(s.createdAt)}</TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
