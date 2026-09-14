import { useEffect, useState } from 'react'
import { CreditCard, TrendingUp, Receipt, Wallet, RefreshCw, Download, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  success: 'Réussi',
  pending: 'En attente',
  failed: 'Échoué',
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchPayments = async () => {
    try {
      const data = await api.payments.all()
      setPayments(data)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayments() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchPayments()
    setRefreshing(false)
  }

  const filtered = payments.filter(p => {
    const matchesFilter = filter === 'all' || p.status === filter
    const matchesSearch = !search ||
      p.user?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      p.method?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalSuccess = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0)
  const totalFailed = payments.filter(p => p.status === 'failed').reduce((sum, p) => sum + Number(p.amount), 0)

  const statusCounts = {
    all: payments.length,
    success: payments.filter(p => p.status === 'success').length,
    pending: payments.filter(p => p.status === 'pending').length,
    failed: payments.filter(p => p.status === 'failed').length,
  }

  const filters = [
    { key: 'all', label: 'Tous', icon: CreditCard },
    { key: 'success', label: 'Réussis', icon: CheckCircle2 },
    { key: 'pending', label: 'En attente', icon: Clock },
    { key: 'failed', label: 'Échoués', icon: XCircle },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Paiements</h1>
          <p className="text-muted text-sm mt-1">{payments.length} transactions</p>
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
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{formatFCFA(totalSuccess)}</p>
                <p className="text-sm text-white/80">Réussis</p>
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
                <p className="text-2xl font-bold font-heading">{formatFCFA(totalPending)}</p>
                <p className="text-sm text-white/80">En attente</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{formatFCFA(totalFailed)}</p>
                <p className="text-sm text-white/80">Échoués</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-heading">{payments.length}</p>
                <p className="text-sm text-white/80">Transactions</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
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
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 rounded-xl border-border focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Receipt className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucun paiement</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Mission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold text-foreground">{formatFCFA(p.amount)}</TableCell>
                    <TableCell>
                      <span className="capitalize text-sm text-muted">{p.method?.replace('_', ' ')}</span>
                    </TableCell>
                    <TableCell>
                      {p.user ? (
                        <span className="text-sm text-foreground">{p.user.firstName} {p.user.lastName || ''}</span>
                      ) : (
                        <span className="text-muted text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted text-sm">
                      {p.mission ? `${p.mission.serviceType} · ${p.mission.pickupAddress}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>
                        {STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted text-sm">{formatDate(p.createdAt)}</TableCell>
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
