import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Package, User, Calendar, PackageSearch, ChevronDown, Phone, Receipt, CheckCircle2, Clock, Bike, Mail, Star, Navigation, MessageSquare, ExternalLink, Copy, Check, AlertCircle, FileText, Image } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, getAdminRole } from '@/lib/api'
import { formatDate, formatFCFA } from '@/lib/utils'
import { canManagerWrite } from '@/lib/permissions'

const BACKEND_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')
const fileUrl = (path?: string) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_URL}${path}`
}

const statusOptions = [
  { value: 'pending', label: 'En attente', color: 'bg-amber-500', icon: Clock },
  { value: 'accepted', label: 'Acceptée', color: 'bg-blue-500', icon: CheckCircle2 },
  { value: 'en_route', label: 'En route', color: 'bg-indigo-500', icon: Navigation },
  { value: 'picked_up', label: 'Récupérée', color: 'bg-violet-500', icon: Package },
  { value: 'in_progress', label: 'En cours', color: 'bg-cyan-500', icon: Bike },
  { value: 'delivered', label: 'Terminée', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Annulée', color: 'bg-rose-500', icon: AlertCircle },
  { value: 'dossier_deposed', label: 'Dossier déposé', color: 'bg-blue-500', icon: FileText },
  { value: 'admin_processing', label: 'En traitement admin', color: 'bg-amber-500', icon: Clock },
  { value: 'document_ready', label: 'Document prêt', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'document_collected', label: 'Document retiré', color: 'bg-violet-500', icon: Package },
  { value: 'returned_to_client', label: 'Restitué au client', color: 'bg-emerald-500', icon: CheckCircle2 },
]

const serviceTypeLabels: Record<string, string> = {
  colis: 'Livraison de colis',
  documents: 'Livraison de documents',
  courses: 'Courses',
  marchandises: 'Transport de marchandises',
  objets_personnels: 'Colis & Objets (legacy)',
  depot_administratif: 'Démarches administratives',
  livraison_entreprise: 'Livraison entreprise',
  collecte_marchandises: 'Collecte de marchandises',
}

const urgencyConfig: Record<string, { label: string; color: string; icon: string }> = {
  groupe: { label: 'Groupé', color: 'bg-emerald-500', icon: '📦' },
  standard: { label: 'Standard', color: 'bg-gray-500', icon: '🕐' },
  express: { label: 'Express', color: 'bg-rose-500', icon: '⚡' },
  programme: { label: 'Programmé', color: 'bg-blue-500', icon: '📅' },
  prioritaire: { label: 'Standard (legacy)', color: 'bg-gray-400', icon: '🕐' },
}

const serviceDetailLabels: Record<string, string> = {
  recipientName: 'Destinataire',
  recipientPhone: 'Téléphone destinataire',
  recipientRelation: 'Lien avec le destinataire',
  pickupContactName: 'Contact récupération',
  pickupContactPhone: 'Tél. récupération',
  pickupContactPhone2: 'Tél. récupération 2',
  deliveryContactName: 'Contact livraison',
  deliveryContactPhone: 'Tél. livraison',
  deliveryContactPhone2: 'Tél. livraison 2',
  pickupAccessInstructions: 'Accès récupération',
  deliveryAccessInstructions: 'Accès livraison',
  pickupFloor: 'Repère / étage',
  packageContent: 'Contenu du colis',
  packageNature: 'Nature',
  packageType: 'Type de colis',
  packageSize: 'Taille',
  documentType: 'Document',
  documentCount: 'Nb documents',
  procedureType: 'Démarche',
  administrationName: 'Administration',
  organism: 'Organisme',
  merchantName: 'Commerce',
  storeName: 'Boutique',
  shoppingList: 'Courses',
  productList: 'Produits',
  instructions: 'Instructions',
  fragile: 'Fragile',
  isFragile: 'Fragile',
  requiresSignature: 'Signature',
  itemCount: 'Articles',
  weight: 'Poids',
  dimensions: 'Dimensions',
  estimatedValue: 'Valeur estimée',
  timingMode: 'Timing',
  urgencyLevel: 'Formule',
  businessName: 'Entreprise',
  managerName: 'Responsable',
  objectToCollect: 'À collecter',
}

function formatServiceDetailLabel(key: string) {
  return serviceDetailLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function formatServiceDetailValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (value == null) return '—'
  return JSON.stringify(value)
}

export function MissionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canWrite = canManagerWrite(getAdminRole())
  const [mission, setMission] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [reimbursing, setReimbursing] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const handleCopyId = () => {
    navigator.clipboard.writeText(mission.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleReimburse = async () => {
    setReimbursing(true)
    try {
      await api.missions.reimburseAdminFee(id!)
      setMission({ ...mission, adminFeeReimbursed: true })
    } catch (e: any) {
      alert(e.message || 'Erreur lors du remboursement')
    } finally {
      setReimbursing(false)
    }
  }

  useEffect(() => {
    api.missions.byId(id!)
      .then(setMission)
      .catch(() => setMission(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    setStatusOpen(false)
    try {
      await api.missions.updateStatus(id!, newStatus)
      setMission({ ...mission, status: newStatus })
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la mise à jour')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <PackageSearch className="h-12 w-12 mb-2 opacity-40" />
        <p className="text-sm">Mission introuvable</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/missions')}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>
    )
  }

  const currentStatus = statusOptions.find(s => s.value === mission.status) || statusOptions[0]
  const urgency = urgencyConfig[mission.urgency] || urgencyConfig.standard
  const StatusIcon = currentStatus.icon

  // Timeline des statuts
  const statusTimeline = statusOptions.slice(0, 6) // Statuts principaux pour la timeline
  const currentStatusIndex = statusTimeline.findIndex(s => s.value === mission.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/missions')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux missions
        </Button>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopyId}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors"
          >
            <span className="font-mono">#{mission.id.slice(0, 8)}</span>
            {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Carte principale */}
      <Card className="overflow-hidden">
        <div className={`h-2 ${currentStatus.color}`} />
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Icône et infos principales */}
            <div className="flex items-start gap-4 flex-1">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${currentStatus.color} text-white shadow-lg`}>
                <StatusIcon className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-heading text-xl font-bold text-foreground">
                    {serviceTypeLabels[mission.serviceType] || mission.serviceType}
                  </h2>
                  <Badge variant={mission.status === 'delivered' || mission.status === 'returned_to_client' ? 'success' : mission.status === 'cancelled' ? 'danger' : mission.status === 'pending' ? 'warning' : 'info'}>
                    {currentStatus.label}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(mission.createdAt)}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${urgency.color}`}>
                    {urgency.icon} {urgency.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Prix */}
            <div className="text-right lg:text-left">
              <p className="text-xs text-muted mb-1">Montant</p>
              <p className="text-3xl font-bold font-heading text-foreground">{formatFCFA(mission.price)}</p>
            </div>
          </div>

          {/* Timeline de statut - masquée sur mobile, visible sur tablette+ */}
          {mission.status !== 'cancelled' && (
            <div className="mt-6 pt-6 border-t border-border hidden md:block">
              <div className="flex items-center justify-between relative">
                {/* Ligne de connexion */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
                <div 
                  className="absolute top-5 left-0 h-0.5 bg-primary -z-10 transition-all" 
                  style={{ width: `${Math.max(0, (currentStatusIndex / (statusTimeline.length - 1)) * 100)}%` }} 
                />
                
                {statusTimeline.map((status, index) => {
                  const isCompleted = index <= currentStatusIndex
                  const isCurrent = index === currentStatusIndex
                  const Icon = status.icon
                  return (
                    <div key={status.value} className="flex flex-col items-center flex-1 max-w-[100px]">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all bg-white ${
                        isCompleted 
                          ? `${status.color} border-transparent text-white` 
                          : 'border-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-offset-2 ring-primary/20 scale-110' : ''}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className={`mt-2 text-xs text-center leading-tight ${isCompleted ? 'text-foreground font-medium' : 'text-muted'}`}>
                        {status.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Timeline mobile - version simplifiée */}
          {mission.status !== 'cancelled' && (
            <div className="mt-6 pt-6 border-t border-border md:hidden">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {statusTimeline.map((status, index) => {
                  const isCompleted = index <= currentStatusIndex
                  const isCurrent = index === currentStatusIndex
                  return (
                    <div 
                      key={status.value} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                        isCurrent 
                          ? `${status.color} text-white font-medium` 
                          : isCompleted 
                            ? 'bg-gray-200 text-foreground' 
                            : 'bg-gray-100 text-muted'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-white' : 'bg-gray-300'}`} />
                      {status.label}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3 lg:grid-cols-1">
        {/* Colonne gauche - Itinéraire et description */}
        <div className="xl:col-span-2 space-y-6">
          {/* Itinéraire */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Itinéraire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Point de départ */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="w-0.5 h-16 bg-gradient-to-b from-emerald-500 to-rose-500 my-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Point de collecte</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{mission.pickupAddress}</p>
                    {mission.pickupLat && mission.pickupLng && (
                      <a 
                        href={`https://www.google.com/maps?q=${mission.pickupLat},${mission.pickupLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Voir sur la carte
                      </a>
                    )}
                  </div>
                </div>

                {/* Destination */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white">
                      <Navigation className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-rose-600 uppercase tracking-wide">Destination</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{mission.deliveryAddress}</p>
                    {mission.deliveryLat && mission.deliveryLng && (
                      <a 
                        href={`https://www.google.com/maps?q=${mission.deliveryLat},${mission.deliveryLng}`}
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

              {/* Remise à tiers */}
              {mission.recipientName && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-2">📦 Remise à un tiers</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground font-medium">{mission.recipientName}</p>
                    {mission.recipientPhone && (
                      <p className="text-muted flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {mission.recipientPhone}
                      </p>
                    )}
                    {mission.recipientRelation && (
                      <p className="text-muted">Lien: {mission.recipientRelation}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {mission.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{mission.description}</p>
              </CardContent>
            </Card>
          )}

          {(mission.scheduledAt || (mission.serviceDetails && Object.keys(mission.serviceDetails).length > 0)) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Details de la demande
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mission.scheduledAt && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Intervention programmee</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(mission.scheduledAt)}</p>
                  </div>
                )}

                {mission.serviceDetails && Object.keys(mission.serviceDetails).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(mission.serviceDetails as Record<string, unknown>)
                      .filter(([, value]) => value !== null && value !== undefined && value !== '')
                      .map(([key, value]) => (
                        <div key={key} className="rounded-lg border border-border bg-gray-50 p-3">
                          <p className="text-xs text-muted">{formatServiceDetailLabel(key)}</p>
                          <p className="mt-1 text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                            {formatServiceDetailValue(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photos de la mission */}
          {mission.photoUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a href={fileUrl(mission.photoUrl)!} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={fileUrl(mission.photoUrl)!} 
                    alt="Photo mission" 
                    className="rounded-lg max-h-64 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              </CardContent>
            </Card>
          )}

          {/* Frais administratifs */}
          {(mission.adminFeeEstimated != null || mission.adminFeeActual != null || mission.adminFeeReceiptUrl) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Frais administratifs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-muted mb-1">Frais estimés</p>
                    <p className="text-lg font-bold text-foreground">
                      {mission.adminFeeEstimated != null ? formatFCFA(mission.adminFeeEstimated) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50">
                    <p className="text-xs text-muted mb-1">Frais réels avancés</p>
                    <p className="text-lg font-bold text-foreground">
                      {mission.adminFeeActual != null ? formatFCFA(mission.adminFeeActual) : 'En attente'}
                    </p>
                  </div>
                </div>
                
                {mission.adminFeeReceiptUrl && (
                  <a 
                    href={fileUrl(mission.adminFeeReceiptUrl)!} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Receipt className="h-4 w-4" /> Voir le justificatif
                  </a>
                )}
                
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  {mission.adminFeeReimbursed ? (
                    <Badge variant="success" className="text-sm py-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Remboursé au prestataire
                    </Badge>
                  ) : canWrite ? (
                    <Button 
                      size="sm" 
                      disabled={!mission.adminFeeReceiptUrl || reimbursing} 
                      onClick={handleReimburse}
                      className="bg-success hover:bg-success/90"
                    >
                      {reimbursing ? 'Validation...' : '✓ Marquer comme remboursé'}
                    </Button>
                  ) : (
                    <Badge variant="warning" className="text-sm py-1">En attente de remboursement</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite - Acteurs et actions */}
        <div className="space-y-6">
          {/* Client */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mission.client ? (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users/${mission.client.id}`)}
                >
                  {mission.client.avatarUrl ? (
                    <img src={fileUrl(mission.client.avatarUrl)!} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white font-bold">
                      {mission.client.firstName?.[0]?.toUpperCase() || 'C'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {mission.client.firstName} {mission.client.lastName || ''}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {mission.client.phone}
                    </p>
                    {mission.client.email && (
                      <p className="text-xs text-muted flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" /> {mission.client.email}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted" />
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-4">Client non disponible</p>
              )}
            </CardContent>
          </Card>

          {/* Prestataire */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bike className="h-4 w-4 text-emerald-500" />
                Prestataire
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mission.provider ? (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/users/${mission.provider.id}`)}
                >
                  {mission.provider.avatarUrl ? (
                    <img src={fileUrl(mission.provider.avatarUrl)!} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
                      {mission.provider.firstName?.[0]?.toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {mission.provider.firstName} {mission.provider.lastName || ''}
                      </p>
                      {mission.provider.isVerified && (
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {mission.provider.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {mission.provider.vehicleType && (
                        <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                          🚗 {mission.provider.vehicleType}
                        </span>
                      )}
                      {mission.provider.rating && (
                        <span className="text-xs flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {mission.provider.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted" />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted">Aucun prestataire assigné</p>
                  <p className="text-xs text-muted mt-1">En attente d'acceptation</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statut actuel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Statut actuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Affichage du statut en lecture seule */}
              <div className={`flex items-center gap-3 p-4 rounded-xl ${currentStatus.color} bg-opacity-10`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${currentStatus.color} text-white`}>
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{currentStatus.label}</p>
                  <p className="text-xs text-muted">Mis à jour automatiquement par l'application</p>
                </div>
              </div>

              {mission.status === 'cancelled' && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <p className="text-xs font-medium text-rose-700">Mission annulée</p>
                  {mission.cancelReason && (
                    <p className="text-sm text-rose-600 mt-1">{mission.cancelReason}</p>
                  )}
                </div>
              )}

              {/* Note explicative */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>ℹ️ Information :</strong> Le statut est mis à jour automatiquement par le client et le prestataire via l'application mobile.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions admin (litige uniquement) */}
          {canWrite && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Actions admin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted">
                Modifier le statut uniquement en cas de litige ou situation exceptionnelle.
              </p>
              
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-between border-warning/50 text-warning hover:bg-warning/10"
                  disabled={updating}
                  onClick={() => setStatusOpen(!statusOpen)}
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {updating ? 'Mise à jour...' : 'Forcer un changement de statut'}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                </Button>
                {statusOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-border bg-white shadow-xl max-h-64 overflow-y-auto">
                    <div className="p-2 bg-warning/10 border-b border-warning/20">
                      <p className="text-xs text-warning font-medium">⚠️ Action réservée aux litiges</p>
                    </div>
                    {statusOptions.map((s) => {
                      const Icon = s.icon
                      return (
                        <button
                          key={s.value}
                          onClick={() => {
                            if (confirm(`Êtes-vous sûr de vouloir forcer le statut "${s.label}" ?\n\nCette action est réservée aux cas de litige.`)) {
                              handleStatusChange(s.value)
                            } else {
                              setStatusOpen(false)
                            }
                          }}
                          className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                            s.value === mission.status ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full ${s.color}`} />
                          <Icon className="h-4 w-4" />
                          {s.label}
                          {s.value === mission.status && <Check className="h-4 w-4 ml-auto" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Infos supplémentaires */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted">Type de service</span>
                <span className="text-sm font-medium text-foreground capitalize">{mission.serviceType}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted">Urgence</span>
                <Badge variant={mission.urgency === 'express' ? 'danger' : mission.urgency === 'programme' ? 'info' : 'neutral'}>
                  {urgency.icon} {urgency.label}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted">Créée le</span>
                <span className="text-sm font-medium text-foreground">{formatDate(mission.createdAt)}</span>
              </div>
              {mission.scheduledAt && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted">Date programmee</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(mission.scheduledAt)}</span>
                </div>
              )}
              {mission.updatedAt && mission.updatedAt !== mission.createdAt && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted">Mise à jour</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(mission.updatedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
