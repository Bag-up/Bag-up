import { useEffect, useState } from 'react'
import { Award, Crown, Gift, RefreshCw, Search, Ticket, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const TIER_LABELS: Record<number, string> = {
  1: 'Ivoire',
  2: 'Élan',
  3: 'Genius',
  4: 'Silver',
  5: 'Gold',
}

export function LoyaltyPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    try {
      const res = await api.loyalty.admin()
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const clients = (data?.clients || []).filter((c: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.firstName?.toLowerCase().includes(q) ||
      c.lastName?.toLowerCase().includes(q) ||
      c.phone?.includes(search)
    )
  })

  const goldCount = data?.tierCounts?.[5] || 0
  const availableRewards = (data?.recentRewards || []).filter((r: any) => r.status === 'available').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Fidélité</h1>
          <p className="text-muted text-sm mt-1">Paliers Ivoire → Gold · bons fixes · paniers Anti-Gaspi offerts</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.tiers || []).slice(1).map((t: any) => (
          <Card key={t.key} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted uppercase tracking-wide">{t.name}</p>
              <p className="text-2xl font-bold font-heading mt-1">{data?.tierCounts?.[t.level] || 0}</p>
              <p className="text-xs text-muted mt-1">
                dès {t.minCompleted} activités
                {t.voucherAmount ? ` · ${t.voucherAmount.toLocaleString()} F` : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-heading">{goldCount}</p>
              <p className="text-sm text-white/80">Clients Gold</p>
            </div>
            <Crown className="h-8 w-8 opacity-80" />
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-heading">{availableRewards}</p>
              <p className="text-sm text-white/80">Récompenses actives (100 dern.)</p>
            </div>
            <Ticket className="h-8 w-8 opacity-80" />
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-heading">{data?.clients?.length || 0}</p>
              <p className="text-sm text-white/80">Clients suivis</p>
            </div>
            <Users className="h-8 w-8 opacity-80" />
          </CardContent>
        </Card>
      </div>

      <div className="relative sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10 pr-4 rounded-xl"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Activités</TableHead>
                  <TableHead>Mois Gold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.firstName} {c.lastName || ''}</p>
                      <p className="text-xs text-muted">{c.phone}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.loyaltyTier >= 5 ? 'success' : 'neutral'}>
                        {TIER_LABELS[c.loyaltyTier] || c.loyaltyTier}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.loyaltyCompletedCount}</TableCell>
                    <TableCell className="text-muted text-sm">{c.loyaltyGoldMonthKey || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Récompenses récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.recentRewards || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.user?.firstName} {r.user?.lastName || ''}
                    <p className="text-xs text-muted">{r.user?.phone}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      {r.type === 'antigaspi_gift' ? <Gift className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
                      {r.type === 'antigaspi_gift' ? 'Panier offert' : 'Bon'}
                    </span>
                  </TableCell>
                  <TableCell>{Number(r.amount).toLocaleString()} F</TableCell>
                  <TableCell className="text-sm text-muted">{r.source === 'gold_monthly' ? 'Gold mensuel' : `Niveau ${r.tier}`}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'available' ? 'success' : r.status === 'used' ? 'neutral' : 'warning'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted">{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
