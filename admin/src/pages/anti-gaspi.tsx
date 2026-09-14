import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Leaf, RefreshCw, Save, ShoppingBasket, Receipt, Wallet, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api, getAdminRole } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'
import { canAdminWrite } from '@/lib/permissions'

type Tab = 'overview' | 'settings' | 'baskets' | 'reservations' | 'payouts'

const BASKET_STATUS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  available: { label: 'Disponible', variant: 'success' },
  reserved: { label: 'Réservé', variant: 'info' },
  sold: { label: 'Vendu', variant: 'neutral' },
  expired: { label: 'Expiré', variant: 'warning' },
  cancelled: { label: 'Annulé', variant: 'danger' },
}

const RESA_STATUS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  pending_payment: { label: 'À payer', variant: 'warning' },
  paid: { label: 'Payé', variant: 'info' },
  merchant_confirmed: { label: 'Commerçant OK', variant: 'info' },
  client_confirmed: { label: 'Client OK', variant: 'info' },
  completed: { label: 'Terminé', variant: 'success' },
  cancelled: { label: 'Annulé', variant: 'danger' },
  expired: { label: 'Expiré', variant: 'warning' },
  refunded: { label: 'Remboursé', variant: 'neutral' },
}

export function AntiGaspiPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const canWrite = canAdminWrite(getAdminRole())
  const merchantId = searchParams.get('merchantId') || ''
  const tabParam = searchParams.get('tab') as Tab | null

  const [tab, setTab] = useState<Tab>(
    tabParam && ['overview', 'settings', 'baskets', 'reservations', 'payouts'].includes(tabParam)
      ? tabParam
      : 'overview',
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [stats, setStats] = useState<any>(null)
  const [settings, setSettings] = useState({
    commissionRate: 0.15,
    basketExpiryMinutes: 2880,
    paymentTimeoutMinutes: 15,
    maxActiveBaskets: 3,
    refundPolicy: '',
  })
  const [baskets, setBaskets] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])

  const load = async () => {
    try {
      const [s, set, b, r, p] = await Promise.all([
        api.antiGaspi.adminStats().catch(() => null),
        api.antiGaspi.settings().catch(() => null),
        api.antiGaspi.adminBaskets().catch(() => []),
        api.antiGaspi.adminReservations().catch(() => []),
        api.antiGaspi.adminPayouts().catch(() => []),
      ])
      setStats(s)
      if (set) {
        setSettings({
          commissionRate: set.commissionRate ?? 0.15,
          basketExpiryMinutes: set.basketExpiryMinutes ?? 2880,
          paymentTimeoutMinutes: set.paymentTimeoutMinutes ?? 15,
          maxActiveBaskets: set.maxActiveBaskets ?? 3,
          refundPolicy: set.refundPolicy || '',
        })
      }
      setBaskets(Array.isArray(b) ? b : [])
      setReservations(Array.isArray(r) ? r : [])
      setPayouts(Array.isArray(p) ? p : [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (tabParam && ['overview', 'settings', 'baskets', 'reservations', 'payouts'].includes(tabParam)) {
      setTab(tabParam)
    }
  }, [tabParam])

  const filteredBaskets = useMemo(
    () => (merchantId ? baskets.filter((b) => b.merchantId === merchantId || b.merchant?.id === merchantId) : baskets),
    [baskets, merchantId],
  )
  const filteredReservations = useMemo(
    () =>
      merchantId
        ? reservations.filter(
            (r) => r.basket?.merchantId === merchantId || r.basket?.merchant?.id === merchantId,
          )
        : reservations,
    [reservations, merchantId],
  )
  const filteredPayouts = useMemo(
    () => (merchantId ? payouts.filter((p) => p.merchantId === merchantId) : payouts),
    [payouts, merchantId],
  )

  const merchantLabel = useMemo(() => {
    if (!merchantId) return null
    const fromBasket = baskets.find((b) => b.merchantId === merchantId || b.merchant?.id === merchantId)?.merchant
    if (fromBasket) {
      return fromBasket.businessName || `${fromBasket.firstName || ''} ${fromBasket.lastName || ''}`.trim() || merchantId.slice(0, 8)
    }
    return merchantId.slice(0, 8) + '…'
  }, [merchantId, baskets])

  const clearMerchantFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('merchantId')
    setSearchParams(next)
  }

  const selectTab = (t: Tab) => {
    setTab(t)
    const next = new URLSearchParams(searchParams)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setSearchParams(next)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.antiGaspi.updateSettings({
        commissionRate: Number(settings.commissionRate),
        basketExpiryMinutes: Number(settings.basketExpiryMinutes),
        paymentTimeoutMinutes: Number(settings.paymentTimeoutMinutes),
        maxActiveBaskets: Number(settings.maxActiveBaskets),
        refundPolicy: settings.refundPolicy || undefined,
      })
      setSettings({
        commissionRate: updated.commissionRate,
        basketExpiryMinutes: updated.basketExpiryMinutes,
        paymentTimeoutMinutes: updated.paymentTimeoutMinutes,
        maxActiveBaskets: updated.maxActiveBaskets ?? 3,
        refundPolicy: updated.refundPolicy || '',
      })
      alert('Paramètres Anti-Gaspi enregistrés')
    } catch (e: any) {
      alert(e.message || 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof Leaf }[] = [
    { key: 'overview', label: 'Vue d’ensemble', icon: Leaf },
    { key: 'settings', label: 'Paramètres', icon: Save },
    { key: 'baskets', label: 'Paniers', icon: ShoppingBasket },
    { key: 'reservations', label: 'Réservations', icon: Receipt },
    { key: 'payouts', label: 'Reversements', icon: Wallet },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Leaf className="h-6 w-6 text-emerald-600" />
            Anti-Gaspi
          </h1>
          <p className="text-sm text-muted mt-1">Supervision paniers, réservations et commission Bag’up</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setRefreshing(true)
            load()
          }}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'bg-white border border-border text-muted hover:bg-gray-50 hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {merchantId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-sm text-teal-900">
            Filtre commerçant : <span className="font-semibold">{merchantLabel}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={clearMerchantFilter} className="text-teal-800">
            <X className="h-4 w-4 mr-1" />
            Retirer
          </Button>
        </div>
      )}

      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Paniers publiés', value: stats?.basketsPublished ?? 0, color: 'from-emerald-500 to-teal-500' },
            { label: 'Vendus', value: stats?.basketsSold ?? 0, color: 'from-primary to-cyan-500' },
            { label: 'Expirés', value: stats?.basketsExpired ?? 0, color: 'from-amber-500 to-orange-500' },
            { label: 'Commission', value: formatFCFA(stats?.commissionGenerated ?? 0), color: 'from-violet-500 to-purple-500' },
            { label: 'Reversements', value: stats?.payoutsDone ?? 0, color: 'from-rose-500 to-pink-500' },
          ].map((kpi) => (
            <Card key={kpi.label} className={`bg-gradient-to-br ${kpi.color} text-white border-0`}>
              <CardContent className="pt-5 pb-4">
                <p className="text-sm text-white/80">{kpi.label}</p>
                <p className="text-2xl font-bold font-heading mt-1">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Paramètres Anti-Gaspi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <div>
              <label className="text-sm font-medium text-foreground">Commission Bag’up (ex: 0.15 = 15 %)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={settings.commissionRate}
                onChange={(e) => setSettings({ ...settings, commissionRate: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-xs text-muted mt-1">
                Appliquée à la publication du panier (déduite du prix, jamais ajoutée).
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Expiration panier non réservé (minutes)</label>
              <Input
                type="number"
                min="5"
                value={settings.basketExpiryMinutes}
                onChange={(e) => setSettings({ ...settings, basketExpiryMinutes: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-xs text-muted mt-1">
                Défaut produit : 2880 min (48 h). Le panier expire aussi à la fin du créneau de retrait si elle arrive avant.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Délai paiement après réservation (minutes)</label>
              <Input
                type="number"
                min="5"
                value={settings.paymentTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, paymentTimeoutMinutes: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Max articles actifs par commerçant</label>
              <Input
                type="number"
                min="1"
                value={settings.maxActiveBaskets}
                onChange={(e) => setSettings({ ...settings, maxActiveBaskets: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-xs text-muted mt-1">
                Paniers disponibles + réservés. Pour en publier un nouveau, le commerçant doit en retirer un.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Politique de remboursement</label>
              <textarea
                className="mt-1 w-full min-h-[100px] rounded-xl border border-border bg-white px-3 py-2 text-sm"
                value={settings.refundPolicy}
                onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })}
                placeholder="Texte affiché / règles internes…"
              />
            </div>
            <Button onClick={handleSave} disabled={saving || !canWrite}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement…' : canWrite ? 'Enregistrer' : 'Lecture seule'}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'baskets' && (
        <Card>
          <CardHeader>
            <CardTitle>Paniers ({filteredBaskets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredBaskets.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucun panier</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Commerçant</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBaskets.map((b) => {
                    const st = BASKET_STATUS[b.status] || BASKET_STATUS.available
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.title}</TableCell>
                        <TableCell>
                          {b.merchant?.businessName || `${b.merchant?.firstName || ''} ${b.merchant?.lastName || ''}`.trim() || '—'}
                          <p className="text-xs text-muted">{b.merchant?.phone}</p>
                        </TableCell>
                        <TableCell>{formatFCFA(b.price)}</TableCell>
                        <TableCell>{formatFCFA(b.commissionAmount)}</TableCell>
                        <TableCell>{formatFCFA(b.merchantAmount)}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted">{formatDate(b.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'reservations' && (
        <Card>
          <CardHeader>
            <CardTitle>Réservations ({filteredReservations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReservations.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucune réservation</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panier</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Commerçant</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Confirmations</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((r) => {
                    const st = RESA_STATUS[r.status] || RESA_STATUS.pending_payment
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.basket?.title || '—'}</TableCell>
                        <TableCell>
                          {r.client?.firstName} {r.client?.lastName}
                          <p className="text-xs text-muted">{r.client?.phone}</p>
                        </TableCell>
                        <TableCell>
                          {r.basket?.merchant?.businessName ||
                            `${r.basket?.merchant?.firstName || ''} ${r.basket?.merchant?.lastName || ''}`.trim() ||
                            '—'}
                        </TableCell>
                        <TableCell>{formatFCFA(r.price)}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted">
                          C: {r.merchantConfirmedAt ? '✓' : '—'} / Cl: {r.clientConfirmedAt ? '✓' : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted">{formatDate(r.createdAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'payouts' && (
        <Card>
          <CardHeader>
            <CardTitle>Reversements ({filteredPayouts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPayouts.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aucun reversement</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panier</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant net</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Payé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.reservation?.basket?.title || '—'}</TableCell>
                      <TableCell>
                        {p.reservation?.client?.firstName} {p.reservation?.client?.lastName}
                      </TableCell>
                      <TableCell>{formatFCFA(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted">{p.provider || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {p.paidAt ? formatDate(p.paidAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
