import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Eye, EyeOff, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api, getAdminUser, setAdminUser } from '@/lib/api'
import { PHONE_COUNTRIES, splitE164, toE164 } from '@/lib/phone'
import { roleLabelFr } from '@/lib/permissions'

export function ProfilePage() {
  const cached = getAdminUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pwdBusy, setPwdBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [dial, setDial] = useState('+221')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [country, setCountry] = useState('SN')
  const [address, setAddress] = useState('')
  const [role, setRole] = useState(cached?.role || '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const selected = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.dial === dial) || PHONE_COUNTRIES[0],
    [dial],
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const me = await api.users.me()
        setFirstName(me.firstName || '')
        setLastName(me.lastName || '')
        setEmail(me.email || '')
        setAddress(me.address || '')
        setRole(me.role || '')
        const split = splitE164(me.phone)
        setDial(split.dial)
        setPhoneLocal(split.local)
        const countryFromDial = PHONE_COUNTRIES.find((c) => c.dial === split.dial)?.code
        setCountry(me.country || countryFromDial || 'SN')
        setAdminUser({
          id: me.id,
          phone: me.phone,
          email: me.email,
          firstName: me.firstName,
          lastName: me.lastName,
          role: me.role,
        })
      } catch (e: any) {
        setError(e.message || 'Impossible de charger le profil')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setOk('')
    try {
      if (!firstName.trim()) throw new Error('Le prénom est requis')
      if (!phoneLocal.trim()) throw new Error('Le numéro de téléphone est requis')
      const phone = toE164(phoneLocal.trim(), dial)
      const updated = await api.users.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone,
        country,
        address: address.trim() || undefined,
      })
      setAdminUser({
        id: updated.id,
        phone: updated.phone,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
      })
      setOk('Profil mis à jour')
    } catch (err: any) {
      setError(err.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdBusy(true)
    setPwdError('')
    setPwdOk('')
    try {
      if (newPassword.length < 6) throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères')
      await api.users.changeMyPassword(currentPassword, newPassword)
      setPwdOk('Mot de passe mis à jour')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: any) {
      setPwdError(err.message || 'Échec du changement')
    } finally {
      setPwdBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du profil…
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Mon profil</h1>
          <p className="text-sm text-muted mt-1">
            Complétez vos informations de contact (téléphone, email, adresse).
          </p>
        </div>
        <Badge variant="info">{roleLabelFr(role)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Prénom</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nom</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@bagup-services.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Téléphone</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={dial}
                  onChange={(e) => {
                    setDial(e.target.value)
                    const match = PHONE_COUNTRIES.find((c) => c.dial === e.target.value)
                    if (match) setCountry(match.code)
                  }}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={`${c.code}-${c.dial}`} value={c.dial}>
                      {c.flag} {c.dial} · {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                  placeholder="78 958 44 44"
                  required
                  className="flex-1"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {selected.flag} {selected.name} — numéro enregistré en format international
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Adresse</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Quartier, ville…"
              />
            </div>

            {error && <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">{error}</div>}
            {ok && <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">{ok}</div>}

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Mot de passe actuel</label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Masquer' : 'Afficher'}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Masquer' : 'Afficher'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {pwdError && <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">{pwdError}</div>}
            {pwdOk && <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">{pwdOk}</div>}
            <Button type="submit" variant="outline" disabled={pwdBusy}>
              {pwdBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
