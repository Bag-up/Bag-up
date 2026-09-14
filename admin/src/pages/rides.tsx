import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation, RefreshCw, Search, Bike, Car, CheckCircle2, Clock, XCircle, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  searching: 'Recherche',
  assigned: 'Assignée',
  driver_en_route: 'Chauffeur en route',
  driver_arrived: 'Arrivé',
  in_progress: 'En course',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  searching: 'warning',
  assigned: 'default',
  driver_en_route: 'info',
  driver_arrived: 'info',
  in_progress: 'default',
  completed: 'success',
  cancelled: 'danger',
}

export function RidesPage() {
  const navigate = useNavigate()
  const [rides, setRides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const fetchRides = async () => {
    try {
      const data = await api.rides.all()
      setRides(Array.isArray(data) ? data : [])
    } catch {
      setRides([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRides()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchRides()
    setRefreshing(false)
  }

  const filtered = rides.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      r.passenger?.firstName?.toLowerCase().includes(q) ||
      r.driverName?.toLowerCase().includes(q) ||
      r.driver?.firstName?.toLowerCase().includes(q) ||
      r.pickupAddress?.toLowerCase().includes(q) ||
      r.dropoffAddress?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    if (!matchesSearch) return false
    if (filter === 'all') return true
    if (filter === 'active') {
      return ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status)
    }
    return r.status === filter
  })

  const counts = {
    all: rides.length,
    searching: rides.filter((r) => r.status === 'searching').length,
    active: rides.filter((r) =>
      ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status),
    ).length,
    completed: rides.filter((r) => r.status === 'completed').length,
    cancelled: rides.filter((r) => r.status === 'cancelled').length,
  }

  const filters = [
    { key: 'all', label: 'Toutes', icon: Navigation, count: counts.all },
    { key: 'searching', label: 'Recherche', icon: Clock, count: counts.searching },
    { key: 'active', label: 'Actives', icon: Activity, count: counts.active },
    { key: 'completed', label: 'Terminées', icon: CheckCircle2, count: counts.completed },
    { key: 'cancelled', label: 'Annulées', icon: XCircle, count: counts.cancelled },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-heading">Courses personnes</h1>
          <p className="text-muted text-sm mt-1">{rides.length} courses</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.all}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">En recherche</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.searching}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Actives</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">Terminées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.completed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            className="pl-9"
            placeholder="Passager, chauffeur, adresse…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              <f.icon className="h-3.5 w-3.5 mr-1.5" />
              {f.label}
              <span className="ml-1.5 opacity-70">{f.count}</span>
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">Aucune course</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const VehicleIcon = r.vehicleMode === 'voiture' ? Car : Bike
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/rides/${r.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <VehicleIcon className="h-4 w-4 text-muted" />
                          <div>
                            <p className="font-medium text-sm capitalize">{r.vehicleMode || '—'}</p>
                            <p className="text-xs text-muted font-mono">{r.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="text-sm truncate">{r.pickupAddress}</p>
                        <p className="text-xs text-muted truncate">→ {r.dropoffAddress}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.passenger?.firstName || '—'}</p>
                        <p className="text-xs text-muted">{r.passenger?.phone}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.driverName || r.driver?.firstName || '—'}</p>
                        {r.vehiclePlate && <p className="text-xs text-muted">{r.vehiclePlate}</p>}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {formatFCFA(Number(r.finalPrice ?? r.estimatedPrice ?? 0))}
                        </p>
                        {r.isPaid || r.cashConfirmedAt ? (
                          <Badge variant="success" className="text-xs mt-1">
                            {r.cashConfirmedAt ? 'Cash client confirmé' : 'Payé'}
                          </Badge>
                        ) : r.status === 'completed' ? (
                          <Badge variant="warning" className="text-xs mt-1 animate-pulse">
                            Cash client à confirmer
                          </Badge>
                        ) : (
                          <p className="text-xs text-muted mt-0.5">Payé par le client (espèces)</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>
                          {STATUS_LABELS[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </TableCell>
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
