import { useEffect, useState } from 'react'
import { Gift, Users, TrendingUp, Award, RefreshCw, Download, Search, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

export function ReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchReferrals = async () => {
    try {
      const data = await api.users.referrals()
      setReferrals(data)
    } catch {
      setReferrals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReferrals() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchReferrals()
    setRefreshing(false)
  }

  const filtered = referrals.filter(r => {
    const matchesFilter = filter === 'all' || r.rewardStatus === filter
    const matchesSearch = !search ||
      r.referrer?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      r.referred?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      r.code?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalReferrals = referrals.length
  const pendingCount = referrals.filter(r => r.rewardStatus === 'pending').length
  const rewardedCount = referrals.filter(r => r.rewardStatus === 'rewarded').length
  const uniqueReferrers = new Set(referrals.map(r => r.referrerId)).size
  const conversionRate = totalReferrals > 0 ? Math.round((rewardedCount / totalReferrals) * 100) : 0

  const filters = [
    { key: 'all', label: 'Tous', icon: Gift },
    { key: 'pending', label: 'En attente', icon: Clock },
    { key: 'rewarded', label: 'Récompensés', icon: CheckCircle2 },
  ]

  const statusCounts = {
    all: referrals.length,
    pending: pendingCount,
    rewarded: rewardedCount,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Parrainages</h1>
          <p className="text-muted text-sm mt-1">{totalReferrals} parrainages enregistrés</p>
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

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{totalReferrals}</p>
                <p className="text-sm text-white/80">Total filleuls</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{uniqueReferrers}</p>
                <p className="text-sm text-white/80">Parrains actifs</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{pendingCount}</p>
                <p className="text-sm text-white/80">En attente</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{conversionRate}%</p>
                <p className="text-sm text-white/80">Taux conversion</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Award className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Search */}
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
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl border-border focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parrainages ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Gift className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucun parrainage pour le moment</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parrain</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Filleul</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{r.referrer?.firstName} {r.referrer?.lastName || ''}</p>
                        <p className="text-xs text-muted">{r.referrer?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-accent">{r.code}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{r.referred?.firstName} {r.referred?.lastName || ''}</p>
                        <p className="text-xs text-muted">{r.referred?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{r.rewardType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.rewardStatus === 'rewarded' ? 'success' : 'warning'}>
                        {r.rewardStatus === 'rewarded' ? 'Récompensé' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted text-sm">{formatDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
