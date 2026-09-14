import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Phone, Mail, ArrowRight, Loader2, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { api, setToken, setAdminUser } from '@/lib/api'
import { PHONE_COUNTRIES, toE164 } from '@/lib/phone'

export function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [dial, setDial] = useState('+221')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.dial === dial) || PHONE_COUNTRIES[0],
    [dial],
  )
  const isEmail = identifier.includes('@')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const trimmed = identifier.trim()
      const result = trimmed.includes('@')
        ? await api.auth.loginWithEmail(trimmed, password)
        : await api.auth.login(toE164(trimmed, dial), password)
      const role = result.user?.role
      if (!role || !['admin', 'assistant', 'manager'].includes(role)) {
        throw new Error('Ce compte n’a pas accès au back-office')
      }
      setToken(result.accessToken)
      setAdminUser(result.user)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_32%),linear-gradient(135deg,#062d2d_0%,#0d8f8f_50%,#27b6b6_100%)] px-4">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-secondary/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md overflow-hidden border-white/20 bg-white/90 shadow-2xl backdrop-blur-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-white to-primary-light" />
        <div className="p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-18 w-18 items-center justify-center rounded-3xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
              <img src="/logo-sansfond.png" alt="Bag'up" className="h-full w-full object-contain p-2" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Bag'up Admin</h1>
            <p className="mt-2 max-w-xs text-sm text-muted">Connectez-vous pour piloter les utilisateurs, missions et paiements depuis un seul espace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Téléphone ou Email</label>
              <div className="relative">
                {isEmail ? (
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                ) : (
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <Input
                  type="text"
                  placeholder={isEmail ? 'admin@bagup.sn' : 'Numéro local ou email'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-12 rounded-xl border-white/60 bg-white/80 pl-10 shadow-sm"
                  required
                />
              </div>

              {!isEmail && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={dial}
                      onChange={(e) => setDial(e.target.value)}
                      className="h-11 appearance-none rounded-xl border border-white/60 bg-white/80 pl-3 pr-8 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {PHONE_COUNTRIES.map((c) => (
                        <option key={`${c.code}-${c.dial}`} value={c.dial}>
                          {c.flag} {c.dial} · {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted">
                    {selected.flag} {selected.name} — tapez juste le numéro local
                  </p>
                </div>
              )}
              <p className="text-xs text-muted">
                Admin hors Sénégal : choisissez l&apos;indicatif, ou connectez-vous directement avec l&apos;email.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-white/60 bg-white/80 pl-10 pr-12 shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
                {error}
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl text-base shadow-lg" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
