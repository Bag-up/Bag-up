import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, RefreshCw, Bike, Package, ExternalLink, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api, getAdminRole } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'
import { canManagerWrite } from '@/lib/permissions'

const ORDER_STATUS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  pending_payment: { label: 'À payer', variant: 'warning' },
  awaiting_preparation: { label: 'En préparation', variant: 'info' },
  collection_scheduled: { label: 'Collecte', variant: 'info' },
  collected: { label: 'Collecté', variant: 'info' },
  in_transit: { label: 'En livraison', variant: 'info' },
  delivered: { label: 'Livré', variant: 'success' },
  cancelled: { label: 'Annulé', variant: 'danger' },
}

const FILTERS = [
  { key: '', label: 'Toutes' },
  { key: 'awaiting_preparation', label: 'Préparation' },
  { key: 'collection_scheduled', label: 'Sans livreur / collecte' },
  { key: 'in_transit', label: 'En livraison' },
  { key: 'delivered', label: 'Livrées' },
]

export function MarketplacePage() {
  const navigate = useNavigate()
  const canWrite = canManagerWrite(getAdminRole())
  const [tab, setTab] = useState<'orders' | 'payouts'>('orders')
  const [orders, setOrders] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [providerPick, setProviderPick] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'payouts') {
        const data = await api.marketplace.adminPayouts().catch(() => [])
        setPayouts(Array.isArray(data) ? data : [])
      } else {
        const [o, p] = await Promise.all([
          api.marketplace.adminOrders(statusFilter || undefined),
          api.users.providers().catch(() => []),
        ])
        setOrders(Array.isArray(o) ? o : [])
        const list = Array.isArray(p) ? p : []
        setProviders(
          list.filter(
            (u: any) =>
              u.isVerified &&
              u.isActive !== false &&
              u.subscriptionStatus === 'active',
          ),
        )
      }
    } catch (e: any) {
      console.error(e)
      setOrders([])
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter, tab])

  const stats = useMemo(() => {
    const prep = orders.filter((o) => o.status === 'awaiting_preparation').length
    const needCourier = orders.filter(
      (o) =>
        ['collection_scheduled', 'awaiting_preparation'].includes(o.status) &&
        !o.mission?.providerId,
    ).length
    const transit = orders.filter(
      (o) =>
        ['collected', 'in_transit', 'collection_scheduled'].includes(o.status) && o.mission?.providerId,
    ).length
    return { total: orders.length, prep, needCourier, transit }
  }, [orders])

  const eligiblePayouts = payouts.filter((p) => p.payoutStatus === 'eligible')
  const eligibleTotal = eligiblePayouts.reduce(
    (sum, p) => sum + Number(p.merchantPayoutAmount ?? p.totalXof ?? 0),
    0,
  )

  const assign = async (orderId: string) => {
    const providerId = providerPick[orderId]
    if (!providerId) {
      alert('Choisissez un livreur')
      return
    }
    setAssigningId(orderId)
    try {
      await api.marketplace.adminAssign(orderId, providerId)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Assignation impossible')
    } finally {
      setAssigningId(null)
    }
  }

  const markPaidOut = async (orderId: string) => {
    setMarkingId(orderId)
    try {
      await api.marketplace.adminMarkPaidOut(orderId)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Impossible de marquer versé')
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" />
            Marketplace
          </h1>
          <p className="text-sm text-muted mt-1">
            Suivi des commandes · dispatch · reversements commerçants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'orders' ? 'bg-primary text-white' : 'text-muted'}`}
            >
              Commandes
            </button>
            <button
              type="button"
              onClick={() => setTab('payouts')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${tab === 'payouts' ? 'bg-primary text-white' : 'text-muted'}`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Reversements
              {eligiblePayouts.length > 0 && (
                <span
                  className={`text-xs px-1.5 rounded ${tab === 'payouts' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}
                >
                  {eligiblePayouts.length}
                </span>
              )}
            </button>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {tab === 'payouts' ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Reversements commerçants · {formatFCFA(eligibleTotal)} à verser
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted py-8 text-center">Chargement…</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucun reversement</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Commerçant</TableHead>
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
                        <div className="font-medium">{p.orderNumber}</div>
                        <div className="text-xs text-muted">{formatDate(p.createdAt)}</div>
                      </TableCell>
                      <TableCell>{p.shop?.name || '—'}</TableCell>
                      <TableCell>
                        {p.shop?.owner
                          ? `${p.shop.owner.firstName || ''} ${p.shop.owner.lastName || ''}`.trim()
                          : '—'}
                        <div className="text-xs text-muted">{p.shop?.owner?.phone}</div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatFCFA(Number(p.merchantPayoutAmount ?? p.totalXof ?? 0))}
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
                            onClick={() => markPaidOut(p.id)}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted uppercase">Commandes (filtre)</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted uppercase">En préparation</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{stats.prep}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted uppercase">Sans livreur</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{stats.needCourier}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted uppercase">Avec livreur</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.transit}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  statusFilter === f.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Commandes
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <p className="text-sm text-muted py-8 text-center">Chargement…</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">Aucune commande</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Boutique</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Livreur</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => {
                      const st = ORDER_STATUS[o.status] || { label: o.status, variant: 'neutral' as const }
                      const canAssign =
                        canWrite &&
                        !o.mission?.providerId &&
                        o.missionId &&
                        !['pending_payment', 'delivered', 'cancelled'].includes(o.status)
                      return (
                        <TableRow key={o.id}>
                          <TableCell>
                            <div className="font-medium">{o.orderNumber}</div>
                            <div className="text-xs text-muted">{formatDate(o.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div>{o.shop?.name || '—'}</div>
                            <div className="text-xs text-muted">{o.shop?.city || ''}</div>
                          </TableCell>
                          <TableCell>
                            {o.buyer
                              ? `${o.buyer.firstName || ''} ${o.buyer.lastName || ''}`.trim()
                              : '—'}
                            <div className="text-xs text-muted">{o.buyer?.phone}</div>
                            {o.recipientName && o.deliverToSelf === false ? (
                              <div className="text-xs text-amber-700 mt-1">
                                → {o.recipientName} · {o.recipientPhone}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {o.mission?.provider ? (
                              <span className="text-sm">
                                {o.mission.provider.firstName} {o.mission.provider.lastName}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600">Non assigné</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatFCFA(Number(o.totalXof ?? o.totalAmount ?? 0))}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2 min-w-[180px]">
                              {o.missionId ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/missions/${o.missionId}`)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Mission
                                </Button>
                              ) : null}
                              {canAssign ? (
                                <div className="flex flex-col gap-1.5">
                                  <select
                                    className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                    value={providerPick[o.id] || ''}
                                    onChange={(e) =>
                                      setProviderPick((prev) => ({ ...prev, [o.id]: e.target.value }))
                                    }
                                  >
                                    <option value="">Livreur…</option>
                                    {providers.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.firstName} {p.lastName} · {p.phone}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    disabled={assigningId === o.id}
                                    onClick={() => assign(o.id)}
                                  >
                                    <Bike className="h-3.5 w-3.5 mr-1" />
                                    {assigningId === o.id ? '…' : 'Assigner'}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
