import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Star, ShieldCheck, Calendar, UserCircle, Bike, CheckCircle2, FileText, AlertTriangle, MapPin, CreditCard, Users, Package, Clock, TrendingUp, ExternalLink, Copy, Check, Store, Leaf, ShoppingBasket, Wallet, KeyRound, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, getAdminRole } from '@/lib/api'
import { formatDate, formatFCFA } from '@/lib/utils'
import { canAdminWrite, canVerifyAccounts } from '@/lib/permissions'

const BACKEND_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')
const fileUrl = (path?: string) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_URL}${path}`
}

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

export function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canWrite = canAdminWrite(getAdminRole())
  const canVerify = canVerifyAccounts(getAdminRole())
  const [user, setUser] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [merchantOverview, setMerchantOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [markingRefund, setMarkingRefund] = useState(false)
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetOk, setResetOk] = useState('')

  useEffect(() => {
    setLoading(true)
    setMerchantOverview(null)
    Promise.all([
      api.users.byId(id!),
      api.missions.all().catch(() => []),
    ])
      .then(async ([userData, allMissions]) => {
        setUser(userData)
        const userMissions = allMissions.filter(
          (m: any) => m.clientId === id || m.providerId === id,
        )
        setMissions(userMissions)
        if (userData?.role === 'merchant') {
          try {
            const overview = await api.antiGaspi.adminMerchantOverview(id!)
            setMerchantOverview(overview)
          } catch {
            setMerchantOverview(null)
          }
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleCopyCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await api.users.verify(user.id)
      setUser({
        ...user,
        isVerified: true,
        kycRejectedAt: null,
        kycRejectReason: null,
        subscriptionRefundPending: false,
      })
    } catch {
      alert('Erreur lors de la validation')
    } finally {
      setVerifying(false)
    }
  }

  const handleReject = async () => {
    setRejecting(true)
    try {
      const updated = await api.users.rejectVerification(user.id, rejectReason.trim() || undefined)
      setUser({ ...user, ...updated, isVerified: false })
      setShowReject(false)
      setRejectReason('')
    } catch (e: any) {
      alert(e?.message || 'Erreur lors du refus')
    } finally {
      setRejecting(false)
    }
  }

  const handleMarkRefunded = async () => {
    setMarkingRefund(true)
    try {
      await api.users.markSubscriptionRefunded(user.id)
      setUser({ ...user, subscriptionRefundPending: false })
    } catch {
      alert('Erreur lors du marquage remboursement')
    } finally {
      setMarkingRefund(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetOk('')
    if (newPassword.length < 6) {
      setResetError('Minimum 6 caractères')
      return
    }
    setResetting(true)
    try {
      await api.users.resetPassword(user.id, newPassword)
      setResetOk('Mot de passe mis à jour')
      setNewPassword('')
      setTimeout(() => {
        setShowResetPwd(false)
        setResetOk('')
      }, 1200)
    } catch (err: any) {
      setResetError(err.message || 'Échec de la réinitialisation')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <UserCircle className="h-12 w-12 mb-2 opacity-40" />
        <p className="text-sm">Utilisateur introuvable</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>
    )
  }

  // Calculs des statistiques
  const completedMissions = missions.filter(m => ['delivered', 'returned_to_client'].includes(m.status)).length
  const activeMissions = missions.filter(m => ['pending', 'accepted', 'en_route', 'picked_up', 'in_progress'].includes(m.status)).length
  const totalRevenue = missions
    .filter(m => ['delivered', 'returned_to_client'].includes(m.status))
    .reduce((sum, m) => sum + (Number(m.price) || 0), 0)

  const roleConfig = {
    client: { label: 'Client', color: 'bg-blue-500', icon: Users },
    provider: { label: 'Prestataire', color: 'bg-emerald-500', icon: Bike },
    merchant: { label: 'Commerçant', color: 'bg-teal-600', icon: Store },
    admin: { label: 'Administrateur', color: 'bg-rose-500', icon: ShieldCheck },
  }
  const role = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.client

  return (
    <div className="space-y-6">
      {/* Header avec retour */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux utilisateurs
        </Button>
        <div className="flex items-center gap-2">
          {canWrite && user.role === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowResetPwd(true); setResetError(''); setResetOk(''); setNewPassword('') }}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Réinitialiser le mot de passe
            </Button>
          )}
          {canVerify && (user.role === 'provider' || user.role === 'merchant') && !user.isVerified && (
            <>
              {!user.kycRejectedAt && (
                <Button
                  variant="outline"
                  onClick={() => setShowReject(true)}
                  disabled={rejecting}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  Refuser le dossier
                </Button>
              )}
              <Button onClick={handleVerify} disabled={verifying} className="bg-success hover:bg-success/90">
                <ShieldCheck className="h-4 w-4 mr-2" />
                {verifying
                  ? 'Validation...'
                  : user.role === 'merchant'
                    ? 'Valider ce commerçant'
                    : 'Valider ce prestataire'}
              </Button>
            </>
          )}
          {canVerify && user.subscriptionRefundPending && (
            <Button variant="outline" onClick={handleMarkRefunded} disabled={markingRefund}>
              <Wallet className="h-4 w-4 mr-2" />
              {markingRefund ? '…' : 'Remboursement effectué'}
            </Button>
          )}
        </div>
      </div>

      {showResetPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Réinitialiser le mot de passe</h2>
                <p className="text-xs text-muted">{user.firstName} {user.lastName || ''} · {user.phone}</p>
              </div>
              <button type="button" onClick={() => setShowResetPwd(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              {resetError && <p className="text-sm text-rose-600">{resetError}</p>}
              {resetOk && <p className="text-sm text-emerald-600">{resetOk}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowResetPwd(false)}>Annuler</Button>
                <Button type="submit" disabled={resetting}>{resetting ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Refuser le dossier</h2>
                <p className="text-xs text-muted">
                  {user.firstName} {user.lastName || ''} · Si déjà payé → remboursement à traiter
                </p>
              </div>
              <button type="button" onClick={() => setShowReject(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Motif (optionnel)</label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Documents illisibles, identité non conforme…"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowReject(false)}>Annuler</Button>
                <Button
                  type="button"
                  disabled={rejecting}
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={handleReject}
                >
                  {rejecting ? 'Refus…' : 'Confirmer le refus'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerte vérification renforcée */}
      {user.subscriptionRefundPending && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-info/30 bg-sky-50 p-4">
          <Wallet className="h-5 w-5 text-sky-700 mt-0.5" />
          <div>
            <p className="font-semibold text-sky-900">Remboursement adhésion / abo à traiter</p>
            <p className="text-sm text-sky-800 mt-1">
              Dossier refusé après paiement. Remboursez via Wave / Orange Money puis cliquez « Remboursement effectué ».
            </p>
          </div>
        </div>
      )}

      {user.kycRejectedAt && !user.isVerified && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-800">Dossier refusé le {formatDate(user.kycRejectedAt)}</p>
            {user.kycRejectReason && (
              <p className="text-sm text-rose-700 mt-1">Motif : {user.kycRejectReason}</p>
            )}
          </div>
        </div>
      )}

      {user.role === 'provider' && user.serviceCategories?.includes('demarches_admin') && !user.isVerified && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-warning/30 bg-gradient-to-r from-warning/10 to-orange-500/10 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="font-semibold text-warning">⚠️ Vérification renforcée requise</p>
            <p className="text-sm text-muted mt-1">
              Ce prestataire souhaite traiter des <strong>démarches administratives</strong>. Vérifiez attentivement 
              son identité et ses documents avant validation (pièce d'identité, casier judiciaire, etc.).
            </p>
          </div>
        </div>
      )}

      {/* Rémunération chauffeur — visible dès la validation */}
      {user.role === 'provider' && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <Wallet className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-emerald-800">
              Rémunération · Payé par les clients
            </p>
            <p className="text-sm text-emerald-900/80 mt-1 leading-relaxed">
              <strong>Courses personnes :</strong> le client paie le chauffeur <strong>en espèces</strong> à la fin.
              Le chauffeur doit confirmer la réception dans l’app (sinon il ne reçoit pas de nouvelle course).
            </p>
            <p className="text-sm text-emerald-900/80 mt-1 leading-relaxed">
              <strong>Missions livraison :</strong> le client paie via Bag’up · reversement chauffeur <strong>J+2</strong>.
              Bag’up facture un abonnement (pas de commission au lancement).
            </p>
            {!user.isVerified && (
              <p className="text-xs font-medium text-emerald-800 mt-2">
                À rappeler au chauffeur lors de la validation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Profil principal */}
      <div className="grid gap-6 xl:grid-cols-3 lg:grid-cols-1">
        {/* Carte profil */}
        <Card className="xl:col-span-1 overflow-hidden">
          <div className={`h-24 ${role.color} relative`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          </div>
          <CardContent className="relative pt-0 pb-6 -mt-12">
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <div className="relative">
                {user.avatarUrl ? (
                  <img 
                    src={fileUrl(user.avatarUrl)!} 
                    alt="Avatar" 
                    className="h-24 w-24 rounded-2xl object-cover border-4 border-white shadow-xl"
                  />
                ) : (
                  <div className={`flex h-24 w-24 items-center justify-center rounded-2xl ${role.color} text-3xl font-bold text-white border-4 border-white shadow-xl`}>
                    {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()}
                  </div>
                )}
                {(user.role === 'provider' || user.role === 'merchant') && (
                  <span className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center ${user.isVerified ? 'bg-success' : 'bg-warning'}`}>
                    {user.isVerified ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-white" />
                    )}
                  </span>
                )}
              </div>

              {/* Nom et rôle */}
              <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
                {user.firstName} {user.lastName || ''}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'provider' ? 'info' : user.role === 'merchant' ? 'success' : 'neutral'} className="text-xs">
                  <role.icon className="h-3 w-3 mr-1" />
                  {role.label}
                </Badge>
                {user.role === 'merchant' && Array.isArray(user.merchantChannels) && user.merchantChannels.length > 0 && (
                  <Badge variant="neutral" className="text-xs">
                    {[
                      user.merchantChannels.includes('antigaspi') ? 'Anti-Gaspi' : null,
                      user.merchantChannels.includes('marketplace') ? 'Marketplace' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Badge>
                )}
                {user.role === 'merchant' && (!user.merchantChannels || user.merchantChannels.length === 0) && (
                  <Badge variant="neutral" className="text-xs">Anti-Gaspi · Marketplace</Badge>
                )}
                {(user.role === 'provider' || user.role === 'merchant') && (
                  <Badge variant={user.isVerified ? 'success' : 'warning'} className="text-xs">
                    {user.isVerified ? '✓ Vérifié' : '⏳ En attente'}
                  </Badge>
                )}
                {user.role === 'provider' && (
                  <Badge variant="success" className="text-xs bg-emerald-600 hover:bg-emerald-600">
                    Payé par les clients
                  </Badge>
                )}
              </div>

              {/* Code parrainage */}
              {user.referralCode && (
                <div className="mt-4 w-full">
                  <p className="text-xs text-muted text-center mb-1">Code parrainage</p>
                  <button 
                    onClick={handleCopyCode}
                    className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 px-3 transition-colors"
                  >
                    <span className="font-mono font-bold text-primary">{user.referralCode}</span>
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted" />
                    )}
                  </button>
                </div>
              )}

              {/* Infos contact */}
              <div className="mt-4 w-full space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted" />
                  <span className="text-foreground">{user.phone}</span>
                </div>
                {user.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted" />
                    <span className="text-foreground truncate">{user.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted" />
                  <span className="text-muted">Inscrit le {formatDate(user.createdAt)}</span>
                </div>
                {user.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted" />
                    <span className="text-foreground">{user.address}</span>
                  </div>
                )}
                {user.role === 'merchant' && user.businessName && (
                  <div className="flex items-center gap-3 text-sm">
                    <Store className="h-4 w-4 text-muted" />
                    <span className="text-foreground">{user.businessName}</span>
                  </div>
                )}
                {user.role === 'merchant' && user.businessAddress && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted" />
                    <span className="text-foreground">{user.businessAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques et infos */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats cards — missions (client/prestataire) ou Anti-Gaspi (commerçant) */}
          {user.role === 'merchant' ? (
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold font-heading">
                        {merchantOverview?.stats?.activeBaskets ?? '—'}
                      </p>
                      <p className="text-sm text-white/80">Paniers actifs</p>
                    </div>
                    <ShoppingBasket className="h-8 w-8 text-white/40" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold font-heading">
                        {merchantOverview?.stats?.basketsSold ?? '—'}
                      </p>
                      <p className="text-sm text-white/80">Vendus</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-white/40" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold font-heading">
                        {merchantOverview?.stats?.pendingPickups ?? '—'}
                      </p>
                      <p className="text-sm text-white/80">Retraits en cours</p>
                    </div>
                    <Clock className="h-8 w-8 text-white/40" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold font-heading">
                        {Number(merchantOverview?.stats?.revenueReceived || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-white/80">FCFA versés</p>
                    </div>
                    <Wallet className="h-8 w-8 text-white/40" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-heading">{missions.length}</p>
                    <p className="text-sm text-white/80">Missions totales</p>
                  </div>
                  <Package className="h-8 w-8 text-white/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-heading">{completedMissions}</p>
                    <p className="text-sm text-white/80">Terminées</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-white/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-heading">{activeMissions}</p>
                    <p className="text-sm text-white/80">En cours</p>
                  </div>
                  <Clock className="h-8 w-8 text-white/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold font-heading">{totalRevenue.toLocaleString()}</p>
                    <p className="text-sm text-white/80">FCFA {user.role === 'provider' ? 'gagnés' : 'dépensés'}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-white/40" />
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Informations détaillées */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informations détaillées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {user.role === 'provider' && (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Bike className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted">Véhicule</p>
                        <p className="font-medium text-foreground">{user.vehicleType || 'Non spécifié'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                        <MapPin className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs text-muted">Zone d'intervention</p>
                        <p className="font-medium text-foreground">{user.zone || 'Non spécifiée'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                        <FileText className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs text-muted">Services</p>
                        <p className="font-medium text-foreground text-sm">
                          {user.serviceCategories?.replace(/collecte_livraison/g, 'Collecte/Livraison').replace(/demarches_admin/g, 'Démarches admin').replace(/,/g, ', ') || 'Non spécifié'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <CreditCard className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Abonnement</p>
                    <p className="font-medium text-foreground capitalize">{user.subscriptionStatus || 'Aucun'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted">Note moyenne</p>
                    <p className="font-medium text-foreground">
                      {user.rating ? `${user.rating} ★` : 'Pas encore noté'} 
                      {user.totalRatings > 0 && <span className="text-muted text-sm ml-1">({user.totalRatings} avis)</span>}
                    </p>
                  </div>
                </div>
                {user.credit > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <CreditCard className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted">Crédit Bag'up</p>
                      <p className="font-medium text-foreground">{user.credit.toLocaleString()} FCFA</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents prestataire */}
          {user.role === 'provider' && (user.idCardUrl || user.idCardBackUrl || user.licenseUrl) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents d'identité
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  {user.idCardUrl && (
                    <a 
                      href={fileUrl(user.idCardUrl)!} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-primary transition-all"
                    >
                      <img src={fileUrl(user.idCardUrl)!} alt="CNI Recto" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium flex items-center gap-1">
                          <ExternalLink className="h-4 w-4" /> Voir CNI Recto
                        </span>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="warning" className="text-xs">CNI Recto</Badge>
                      </div>
                    </a>
                  )}
                  {user.idCardBackUrl && (
                    <a 
                      href={fileUrl(user.idCardBackUrl)!} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-primary transition-all"
                    >
                      <img src={fileUrl(user.idCardBackUrl)!} alt="CNI Verso" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium flex items-center gap-1">
                          <ExternalLink className="h-4 w-4" /> Voir CNI Verso
                        </span>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="warning" className="text-xs">CNI Verso</Badge>
                      </div>
                    </a>
                  )}
                  {user.licenseUrl && (
                    <a 
                      href={fileUrl(user.licenseUrl)!} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-primary transition-all"
                    >
                      <img src={fileUrl(user.licenseUrl)!} alt="Permis" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium flex items-center gap-1">
                          <ExternalLink className="h-4 w-4" /> Voir Permis
                        </span>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="success" className="text-xs">Permis</Badge>
                      </div>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anti-Gaspi — aperçu commerçant */}
          {user.role === 'merchant' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-teal-600" />
                  Activité Anti-Gaspi
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/anti-gaspi?merchantId=${user.id}&tab=baskets`)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Voir dans Anti-Gaspi
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingBasket className="h-4 w-4" />
                      Paniers récents
                    </span>
                    <Badge variant="neutral">
                      {merchantOverview?.stats?.basketsPublished ?? 0} publiés
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!merchantOverview?.baskets?.length ? (
                    <p className="text-sm text-muted py-4 text-center">Aucun panier publié</p>
                  ) : (
                    <div className="space-y-3">
                      {merchantOverview.baskets.map((b: any) => {
                        const st = BASKET_STATUS[b.status] || BASKET_STATUS.available
                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{b.title}</p>
                              <p className="text-xs text-muted">
                                {formatFCFA(b.price)} · net {formatFCFA(b.merchantAmount)} ·{' '}
                                {formatDate(b.createdAt)}
                              </p>
                            </div>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Dernières réservations
                    </span>
                    {(merchantOverview?.stats?.pendingPickups ?? 0) > 0 && (
                      <Badge variant="warning">
                        {merchantOverview.stats.pendingPickups} en cours
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!merchantOverview?.reservations?.length ? (
                    <p className="text-sm text-muted py-4 text-center">Aucune réservation</p>
                  ) : (
                    <div className="space-y-3">
                      {merchantOverview.reservations.map((r: any) => {
                        const st = RESA_STATUS[r.status] || RESA_STATUS.paid
                        const clientName = [r.client?.firstName, r.client?.lastName]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {r.basket?.title || 'Panier'}
                              </p>
                              <p className="text-xs text-muted">
                                {clientName || 'Client'}
                                {r.client?.phone ? ` · ${r.client.phone}` : ''} ·{' '}
                                {formatDate(r.createdAt)}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {formatFCFA(r.merchantAmount)}
                              </p>
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Dernières missions */}
          {user.role !== 'merchant' && missions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Dernières missions
                  </span>
                  <Badge variant="neutral">{missions.length} au total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {missions.slice(0, 5).map((mission) => (
                    <div 
                      key={mission.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => navigate(`/missions`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          ['delivered', 'returned_to_client'].includes(mission.status) ? 'bg-success' :
                          mission.status === 'cancelled' ? 'bg-danger' : 'bg-warning'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{mission.serviceType || 'Mission'}</p>
                          <p className="text-xs text-muted">{formatDate(mission.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{Number(mission.price || 0).toLocaleString()} FCFA</p>
                        <Badge 
                          variant={
                            ['delivered', 'returned_to_client'].includes(mission.status) ? 'success' :
                            mission.status === 'cancelled' ? 'danger' : 'warning'
                          }
                          className="text-xs"
                        >
                          {mission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
