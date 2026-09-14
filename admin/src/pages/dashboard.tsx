import { useEffect, useState } from 'react'
import { Package, TrendingUp, Star, ArrowRight, MapPin, Gift, Users, Clock, CheckCircle2, XCircle, Activity, Zap, Eye, RefreshCw, Truck, FileText, ShoppingBag, ArrowUpRight, MoreVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatFCFA } from '@/lib/utils'

interface SubStats {
  totalRevenue: number
  totalSubscriptions: number
  activeProviders: number
}

interface MissionStats {
  statusCounts: Record<string, number>
  totalRevenue: number
  monthly: { month: string; missions: number; revenue: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#6366F1',
  in_progress: '#0EA5E9',
  delivered: '#10B981',
  cancelled: '#F04A3A',
}

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

export function DashboardPage() {
  const [subStats, setSubStats] = useState<SubStats>({ totalRevenue: 0, totalSubscriptions: 0, activeProviders: 0 })
  const [missionStats, setMissionStats] = useState<MissionStats>({ statusCounts: {}, totalRevenue: 0, monthly: [] })
  const [missions, setMissions] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [zoneStats, setZoneStats] = useState<any[]>([])
  const [referralStats, setReferralStats] = useState({ total: 0, pending: 0, rewarded: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    const [s, ms, m, users, zs, refs] = await Promise.all([
      api.subscriptions.stats().catch(() => ({ totalRevenue: 0, totalSubscriptions: 0, activeProviders: 0 })),
      api.missions.stats().catch(() => ({ statusCounts: {}, totalRevenue: 0, monthly: [] })),
      api.missions.all().catch(() => []),
      api.users.all().catch(() => []),
      api.users.zoneStats().catch(() => []),
      api.users.referrals().catch(() => []),
    ])
    setSubStats(s)
    setMissionStats(ms)
    setMissions(m)
    setAllUsers(users)
    setZoneStats(zs)
    setReferralStats({
      total: refs.length,
      pending: refs.filter((r: any) => r.rewardStatus === 'pending').length,
      rewarded: refs.filter((r: any) => r.rewardStatus === 'rewarded').length,
    })
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Calculs des stats
  const totalMissions = Object.values(missionStats.statusCounts).reduce((a, b) => a + b, 0)
  const activeMissions = (missionStats.statusCounts['pending'] || 0) + (missionStats.statusCounts['accepted'] || 0) + (missionStats.statusCounts['in_progress'] || 0)
  const completedMissions = missionStats.statusCounts['delivered'] || 0
  const cancelledMissions = missionStats.statusCounts['cancelled'] || 0
  const totalClients = allUsers.filter((u: any) => u.role === 'client').length
  const totalProviders = allUsers.filter((u: any) => u.role === 'provider').length

  // Date du jour
  const today = new Date()
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const pieData = Object.entries(missionStats.statusCounts).map(([name, value]) => ({ name, value, label: STATUS_LABELS[name] || name }))

  // Top prestataires (données réelles)
  const providerMissionCounts = missions.reduce((acc: Record<string, number>, m: any) => {
    if (!m.providerId) return acc
    if (!['delivered', 'returned_to_client'].includes(m.status)) return acc
    acc[m.providerId] = (acc[m.providerId] || 0) + 1
    return acc
  }, {})
  const topProviders = allUsers
    .filter((u: any) => u.role === 'provider' && u.isVerified)
    .map((p: any) => ({
      ...p,
      missions: providerMissionCounts[p.id] || 0,
      rating: p.rating != null ? Number(p.rating).toFixed(1) : '—',
    }))
    .sort((a: any, b: any) => b.missions - a.missions || Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 5)

  const pendingValidations = allUsers.filter(
    (u: any) => !u.isVerified && (u.role === 'provider' || u.role === 'merchant') && u.isActive !== false,
  ).length
  // Activité récente
  const recentMissions = missions.slice(0, 5)

  // Revenu total calculé proprement
  const totalRevenue = Number(missionStats.totalRevenue || 0) + Number(subStats.totalRevenue || 0)

  return (
    <div className="space-y-6 min-w-0">
      {/* Header avec salutation et actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground font-heading">{greeting} 👋</h1>
          <p className="text-muted text-sm mt-1 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingValidations > 0 && (
            <Link to="/users">
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100">
                <Clock className="h-4 w-4 mr-2" />
                {pendingValidations} à valider
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Link to="/missions">
            <Button size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Voir les missions
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Revenus totaux */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 lg:p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight className="h-3 w-3" />
                +12%
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-bold font-heading truncate">{formatFCFA(totalRevenue)}</p>
            <p className="text-sm text-white/80 mt-1">Revenus totaux</p>
          </CardContent>
        </Card>

        {/* Missions actives */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 lg:p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                Live
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-bold font-heading">{activeMissions}</p>
            <p className="text-sm text-white/80 mt-1">Missions en cours</p>
          </CardContent>
        </Card>

        {/* Utilisateurs */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 lg:p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <ArrowUpRight className="h-3 w-3" />
                +8%
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-bold font-heading">{totalClients + totalProviders}</p>
            <p className="text-sm text-white/80 mt-1">{totalClients} clients · {totalProviders} prestataires</p>
          </CardContent>
        </Card>

        {/* Taux de réussite */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-4 lg:p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <Zap className="h-3 w-3" />
                Excellent
              </div>
            </div>
            <p className="text-xl lg:text-2xl font-bold font-heading">{totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0}%</p>
            <p className="text-sm text-white/80 mt-1">Taux de livraison</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats secondaires */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Package className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl lg:text-2xl font-bold text-foreground font-heading">{totalMissions}</p>
              <p className="text-sm text-muted">Total missions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-success/10 shrink-0">
              <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xl lg:text-2xl font-bold text-foreground font-heading">{completedMissions}</p>
              <p className="text-sm text-muted">Livrées</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-warning/10 shrink-0">
              <Star className="h-5 w-5 lg:h-6 lg:w-6 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xl lg:text-2xl font-bold text-foreground font-heading">{subStats.activeProviders}</p>
              <p className="text-sm text-muted">Abonnés actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <XCircle className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xl lg:text-2xl font-bold text-foreground font-heading">{cancelledMissions}</p>
              <p className="text-sm text-muted">Annulées</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Area Chart - Évolution */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Évolution des missions</CardTitle>
              <p className="text-sm text-muted mt-1">6 derniers mois</p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={missionStats.monthly}>
                  <defs>
                    <linearGradient id="colorMissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D8F8F" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0D8F8F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.875rem' }}
                  />
                  <Area type="monotone" dataKey="missions" stroke="#0D8F8F" strokeWidth={2} fillOpacity={1} fill="url(#colorMissions)" name="Missions" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart - Répartition */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Répartition par statut</CardTitle>
            <p className="text-sm text-muted mt-1">Toutes les missions</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : pieData.length === 0 ? (
              <p className="text-center text-muted text-sm py-16">Aucune donnée</p>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.875rem' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold text-foreground">{totalMissions}</p>
                  <p className="text-xs text-muted">Total</p>
                </div>
              </div>
            )}
            {/* Légende */}
            <div className="mt-4 space-y-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] || '#94A3B8' }} />
                    <span className="text-muted">{entry.label}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missions récentes + Top prestataires */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Missions récentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Missions récentes</CardTitle>
            <Link to="/missions">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : recentMissions.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">Aucune mission récente</p>
            ) : (
              recentMissions.map((m) => {
                const ServiceIcon = SERVICE_ICONS[m.serviceType] || SERVICE_ICONS.default
                return (
                  <Link key={m.id} to={`/missions/${m.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <ServiceIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground capitalize truncate">{m.serviceType}</p>
                        <p className="text-xs text-muted truncate">{m.pickupAddress} → {m.deliveryAddress}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-foreground">{formatFCFA(Number(m.price) || 0)}</p>
                        <Badge variant={m.status === 'delivered' ? 'success' : m.status === 'cancelled' ? 'danger' : m.status === 'pending' ? 'warning' : 'info'} className="text-xs">
                          {STATUS_LABELS[m.status] || m.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Top prestataires */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top prestataires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProviders.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">Aucun prestataire vérifié</p>
            ) : (
              topProviders.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-white text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{p.firstName} {p.lastName || ''}</p>
                    <p className="text-xs text-muted">{p.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                      {p.rating}
                    </p>
                    <p className="text-xs text-muted">{p.missions} missions</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zones géographiques + Parrainage */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Zones d'intervention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {zoneStats.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">Aucune donnée de zone</p>
            ) : (
              <div className="space-y-3">
                {zoneStats.slice(0, 5).map((z, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{z.zone || z.name || 'Zone'}</span>
                        <span className="text-sm text-muted">{z.count || z.users || 0} utilisateurs</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                          style={{ width: `${Math.min(100, ((z.count || z.users || 0) / Math.max(...zoneStats.map((z: any) => z.count || z.users || 1))) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parrainage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Programme de parrainage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <p className="text-2xl font-bold text-primary font-heading">{referralStats.total}</p>
                <p className="text-xs text-muted mt-1">Total</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <p className="text-2xl font-bold text-amber-500 font-heading">{referralStats.pending}</p>
                <p className="text-xs text-muted mt-1">En attente</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
                <p className="text-2xl font-bold text-emerald-500 font-heading">{referralStats.rewarded}</p>
                <p className="text-xs text-muted mt-1">Récompensés</p>
              </div>
            </div>
            <Link to="/referrals">
              <Button variant="outline" size="sm" className="w-full mt-4">
                Gérer les parrainages
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
