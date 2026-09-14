import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  User,
  Calendar,
  Navigation,
  Phone,
  Mail,
  Star,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Receipt,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDate, formatFCFA } from '@/lib/utils'

const BACKEND_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')
const fileUrl = (path?: string) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_URL}${path}`
}

const statusOptions = [
  { value: 'searching', label: 'Recherche', color: 'bg-amber-500', icon: Clock },
  { value: 'assigned', label: 'Assignée', color: 'bg-blue-500', icon: CheckCircle2 },
  { value: 'driver_en_route', label: 'Chauffeur en route', color: 'bg-indigo-500', icon: Navigation },
  { value: 'driver_arrived', label: 'Arrivé', color: 'bg-violet-500', icon: MapPin },
  { value: 'in_progress', label: 'En course', color: 'bg-cyan-500', icon: Activity },
  { value: 'completed', label: 'Terminée', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Annulée', color: 'bg-rose-500', icon: AlertCircle },
]

const payoutLabels: Record<string, string> = {
  held: 'En séquestre',
  eligible: 'Éligible',
  paid_out: 'Reversé',
  cancelled: 'Annulé',
}

export function RideDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ride, setRide] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(false)

  useEffect(() => {
    api.rides
      .byId(id!)
      .then(setRide)
      .catch(() => setRide(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleCopyId = () => {
    if (!ride?.id) return
    navigator.clipboard.writeText(ride.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!ride) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <Navigation className="h-12 w-12 mb-2 opacity-40" />
        <p className="text-sm">Course introuvable</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/rides')}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>
    )
  }

  const currentStatus = statusOptions.find((s) => s.value === ride.status) || statusOptions[0]
  const StatusIcon = currentStatus.icon
  const VehicleIcon = ride.vehicleMode === 'voiture' ? Car : Bike
  const statusTimeline = statusOptions.slice(0, 6)
  const currentStatusIndex = statusTimeline.findIndex((s) => s.value === ride.status)
  const price = Number(ride.finalPrice ?? ride.estimatedPrice ?? 0)
  const driverName =
    ride.driverName ||
    [ride.driver?.firstName, ride.driver?.lastName].filter(Boolean).join(' ') ||
    null
  const passengerName = [ride.passenger?.firstName, ride.passenger?.lastName]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rides')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux courses
        </Button>
        <button
          onClick={handleCopyId}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
        >
          <span className="font-mono">#{ride.id.slice(0, 8)}</span>
          {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className={`h-2 ${currentStatus.color}`} />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex items-start gap-4 flex-1">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${currentStatus.color} text-white shadow-lg`}
              >
                <StatusIcon className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                    <VehicleIcon className="h-5 w-5" />
                    Course {ride.vehicleMode || '—'}
                  </h2>
                  <Badge
                    variant={
                      ride.status === 'completed'
                        ? 'success'
                        : ride.status === 'cancelled'
                          ? 'danger'
                          : ride.status === 'searching'
                            ? 'warning'
                            : 'info'
                    }
                  >
                    {currentStatus.label}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(ride.createdAt)}
                  </span>
                  {ride.estimatedDistanceKm != null && (
                    <span>{Number(ride.estimatedDistanceKm).toFixed(1)} km</span>
                  )}
                  {ride.estimatedDurationMin != null && (
                    <span>~{ride.estimatedDurationMin} min</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right lg:text-left">
              <p className="text-xs text-muted mb-1">Montant</p>
              <p className="text-3xl font-bold font-heading text-foreground">{formatFCFA(price)}</p>
              {ride.isPaid || ride.cashConfirmedAt ? (
                <Badge variant="success" className="mt-2">
                  {ride.cashConfirmedAt ? 'Cash confirmé' : 'Payé'}
                </Badge>
              ) : ride.status === 'completed' ? (
                <Badge variant="warning" className="mt-2">
                  Cash à confirmer
                </Badge>
              ) : null}
            </div>
          </div>

          {ride.status !== 'cancelled' && (
            <div className="mt-6 pt-6 border-t border-border hidden md:block">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
                <div
                  className="absolute top-5 left-0 h-0.5 bg-primary -z-10 transition-all"
                  style={{
                    width: `${Math.max(0, (currentStatusIndex / (statusTimeline.length - 1)) * 100)}%`,
                  }}
                />
                {statusTimeline.map((status, index) => {
                  const isCompleted = index <= currentStatusIndex
                  const isCurrent = index === currentStatusIndex
                  const Icon = status.icon
                  return (
                    <div key={status.value} className="flex flex-col items-center flex-1 max-w-[100px]">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all bg-white ${
                          isCompleted
                            ? `${status.color} border-transparent text-white`
                            : 'border-gray-200 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-offset-2 ring-primary/20 scale-110' : ''}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <p
                        className={`mt-2 text-xs text-center leading-tight ${
                          isCompleted ? 'text-foreground font-medium' : 'text-muted'
                        }`}
                      >
                        {status.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3 lg:grid-cols-1">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Trajet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="w-0.5 h-16 bg-gradient-to-b from-emerald-500 to-rose-500 my-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
                      Prise en charge
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">{ride.pickupAddress}</p>
                    {ride.pickupLat && ride.pickupLng && (
                      <a
                        href={`https://www.google.com/maps?q=${ride.pickupLat},${ride.pickupLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Voir sur la carte
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white">
                      <Navigation className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-rose-600 uppercase tracking-wide">
                      Destination
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">{ride.dropoffAddress}</p>
                    {ride.dropoffLat && ride.dropoffLng && (
                      <a
                        href={`https://www.google.com/maps?q=${ride.dropoffLat},${ride.dropoffLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Voir sur la carte
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {(ride.driverLat || ride.passengerLat) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ride.driverLat && ride.driverLng && (
                    <a
                      href={`https://www.google.com/maps?q=${ride.driverLat},${ride.driverLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                    >
                      <p className="text-xs text-muted">Position chauffeur</p>
                      <p className="text-sm font-medium text-primary mt-1 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Voir
                      </p>
                    </a>
                  )}
                  {ride.passengerLat && ride.passengerLng && (
                    <a
                      href={`https://www.google.com/maps?q=${ride.passengerLat},${ride.passengerLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                    >
                      <p className="text-xs text-muted">Position passager</p>
                      <p className="text-sm font-medium text-primary mt-1 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Voir
                      </p>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Paiement & reversement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-muted">Estimé</p>
                  <p className="text-sm font-semibold">{formatFCFA(Number(ride.estimatedPrice ?? 0))}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-muted">Final</p>
                  <p className="text-sm font-semibold">
                    {ride.finalPrice != null ? formatFCFA(Number(ride.finalPrice)) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-muted">Dû chauffeur</p>
                  <p className="text-sm font-semibold">
                    {ride.providerAmount != null ? formatFCFA(Number(ride.providerAmount)) : '—'}
                  </p>
                </div>
              </div>
              {ride.payoutStatus && (
                <p className="text-sm">
                  Reversement :{' '}
                  <span className="font-medium">
                    {payoutLabels[ride.payoutStatus] || ride.payoutStatus}
                  </span>
                  {ride.payoutEligibleAt && (
                    <span className="text-muted text-xs ml-2">
                      (éligible {formatDate(ride.payoutEligibleAt)})
                    </span>
                  )}
                </p>
              )}
              {Array.isArray(ride.payments) && ride.payments.length > 0 ? (
                <div className="space-y-2">
                  {ride.payments.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{formatFCFA(Number(p.amount))}</p>
                        <p className="text-xs text-muted">
                          {p.method || '—'} · {p.provider || '—'}
                        </p>
                      </div>
                      <Badge variant={p.status === 'success' ? 'success' : 'warning'}>
                        {p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Aucun paiement enregistré (espèces côté app)</p>
              )}
            </CardContent>
          </Card>

          {Array.isArray(ride.offers) && ride.offers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Offres matching</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ride.offers.map((o: any) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        #{o.rank}{' '}
                        {[o.driver?.firstName, o.driver?.lastName].filter(Boolean).join(' ') ||
                          'Chauffeur'}
                      </p>
                      <p className="text-xs text-muted">
                        {o.distanceKm != null ? `${Number(o.distanceKm).toFixed(1)} km` : '—'} ·{' '}
                        {o.status}
                      </p>
                    </div>
                    {o.driver?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/users/${o.driver.id}`)}
                      >
                        Voir
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Array.isArray(ride.ratings) && ride.ratings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ride.ratings.map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-1 font-medium">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      {r.score}/5
                    </div>
                    {r.comment && <p className="text-muted mt-1">{r.comment}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                Passager
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ride.passenger ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users/${ride.passenger.id}`)}
                >
                  {ride.passenger.avatarUrl ? (
                    <img
                      src={fileUrl(ride.passenger.avatarUrl)!}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white font-bold">
                      {ride.passenger.firstName?.[0]?.toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{passengerName || '—'}</p>
                    {ride.passenger.phone && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {ride.passenger.phone}
                      </p>
                    )}
                    {ride.passenger.email && (
                      <p className="text-xs text-muted flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" /> {ride.passenger.email}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted" />
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-4">Passager non disponible</p>
              )}
              {ride.passengerReadyAt && (
                <p className="text-xs text-muted mt-3">
                  Prêt à {formatDate(ride.passengerReadyAt)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bike className="h-4 w-4 text-emerald-500" />
                Chauffeur
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ride.driver || driverName ? (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg bg-emerald-50 transition-colors ${
                    ride.driver?.id ? 'hover:bg-emerald-100 cursor-pointer' : ''
                  }`}
                  onClick={() => ride.driver?.id && navigate(`/users/${ride.driver.id}`)}
                >
                  {ride.driver?.avatarUrl ? (
                    <img
                      src={fileUrl(ride.driver.avatarUrl)!}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
                      {driverName?.[0]?.toUpperCase() || 'C'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{driverName || '—'}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />{' '}
                      {ride.driverPhone || ride.driver?.phone || '—'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(ride.vehicleType || ride.driver?.vehicle?.type) && (
                        <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                          {ride.vehicleType || ride.driver?.vehicle?.type}
                        </span>
                      )}
                      {(ride.vehiclePlate || ride.driver?.vehicle?.plate) && (
                        <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded font-mono">
                          {ride.vehiclePlate || ride.driver?.vehicle?.plate}
                        </span>
                      )}
                      {(ride.driverRating || ride.driver?.rating) != null && (
                        <span className="text-xs flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {ride.driverRating ?? ride.driver?.rating}
                        </span>
                      )}
                    </div>
                    {(ride.vehicleBrand || ride.vehicleModel || ride.vehicleColor) && (
                      <p className="text-xs text-muted mt-1">
                        {[ride.vehicleColor, ride.vehicleBrand, ride.vehicleModel]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    )}
                  </div>
                  {ride.driver?.id && <ExternalLink className="h-4 w-4 text-muted" />}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted">Aucun chauffeur assigné</p>
                  <p className="text-xs text-muted mt-1">En recherche</p>
                </div>
              )}
              {ride.assignedAt && (
                <p className="text-xs text-muted mt-3">Assigné le {formatDate(ride.assignedAt)}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chronologie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted">Créée</span>
                <span>{formatDate(ride.createdAt)}</span>
              </div>
              {ride.assignedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Assignée</span>
                  <span>{formatDate(ride.assignedAt)}</span>
                </div>
              )}
              {ride.passengerReadyAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Passager prêt</span>
                  <span>{formatDate(ride.passengerReadyAt)}</span>
                </div>
              )}
              {ride.completedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Terminée</span>
                  <span>{formatDate(ride.completedAt)}</span>
                </div>
              )}
              {ride.cancelledAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Annulée</span>
                  <span>{formatDate(ride.cancelledAt)}</span>
                </div>
              )}
              {ride.cashConfirmedAt && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Cash confirmé</span>
                  <span>{formatDate(ride.cashConfirmedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
