import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { Image as ImageIcon, Megaphone, Plus, Save, Trash2, Pencil, X, CheckCircle2 } from 'lucide-react'

type TabKey = 'promos' | 'banners'

interface Promo {
  id: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  ctaLabel: string
  linkType: string
  linkTarget?: string | null
  sortOrder: number
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
}

interface Banner {
  id: string
  badge?: string | null
  headline: string
  subtitle?: string | null
  imageUrl?: string | null
  ctaLabel: string
  linkType: string
  linkTarget?: string | null
  sortOrder: number
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
}

const promoEmpty = {
  title: '',
  subtitle: '',
  imageUrl: '',
  ctaLabel: 'Découvrir',
  linkType: 'none',
  linkTarget: '',
  sortOrder: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
}

const bannerEmpty = {
  badge: 'Anti-Gaspi',
  headline: '',
  subtitle: '',
  imageUrl: '',
  ctaLabel: 'Voir les offres',
  linkType: 'antigaspi',
  linkTarget: '',
  sortOrder: 0,
  isActive: true,
  startsAt: '',
  endsAt: '',
}

const promoLinkOptions = [
  { value: 'none', label: 'Aucune action (message bientôt)' },
  { value: 'market_home', label: 'Catalogue marketplace' },
  { value: 'shop', label: 'Boutique (ID)' },
  { value: 'product', label: 'Produit (ID)' },
  { value: 'url', label: 'URL externe' },
]

const bannerLinkOptions = [
  { value: 'antigaspi', label: 'Anti-Gaspi' },
  { value: 'market', label: 'Marketplace' },
  { value: 'url', label: 'URL externe' },
  { value: 'none', label: 'Aucune action' },
]

function toDateInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

export function ContentPage() {
  const [tab, setTab] = useState<TabKey>('promos')
  const [promos, setPromos] = useState<Promo[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [promoForm, setPromoForm] = useState({ ...promoEmpty })
  const [bannerForm, setBannerForm] = useState({ ...bannerEmpty })

  const load = () => {
    setLoading(true)
    Promise.all([api.content.adminPromos(), api.content.adminHomeBanners()])
      .then(([p, b]) => {
        setPromos(Array.isArray(p) ? p : [])
        setBanners(Array.isArray(b) ? b : [])
      })
      .catch(() => {
        setPromos([])
        setBanners([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const resetPromoForm = () => {
    setPromoForm({ ...promoEmpty })
    setEditingPromoId(null)
  }

  const resetBannerForm = () => {
    setBannerForm({ ...bannerEmpty })
    setEditingBannerId(null)
  }

  const handleSavePromo = async () => {
    if (!promoForm.title.trim()) {
      alert('Le titre est requis')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...promoForm,
        subtitle: promoForm.subtitle || null,
        imageUrl: promoForm.imageUrl || null,
        linkTarget: promoForm.linkTarget || null,
        startsAt: promoForm.startsAt || null,
        endsAt: promoForm.endsAt || null,
        sortOrder: Number(promoForm.sortOrder) || 0,
      }
      if (editingPromoId) await api.content.updatePromo(editingPromoId, payload)
      else await api.content.createPromo(payload)
      resetPromoForm()
      load()
    } catch (e: any) {
      alert(e.message || 'Erreur sauvegarde promo')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBanner = async () => {
    if (!bannerForm.headline.trim()) {
      alert('Le titre est requis')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...bannerForm,
        badge: bannerForm.badge || null,
        subtitle: bannerForm.subtitle || null,
        imageUrl: bannerForm.imageUrl || null,
        linkTarget: bannerForm.linkTarget || null,
        startsAt: bannerForm.startsAt || null,
        endsAt: bannerForm.endsAt || null,
        sortOrder: Number(bannerForm.sortOrder) || 0,
      }
      if (editingBannerId) await api.content.updateHomeBanner(editingBannerId, payload)
      else await api.content.createHomeBanner(payload)
      resetBannerForm()
      load()
    } catch (e: any) {
      alert(e.message || 'Erreur sauvegarde bannière')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Contenu app</h1>
        <p className="text-sm text-muted mt-1">
          Gérez les promos Marketplace et les bannières « À la une » de l’accueil.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'promos' ? 'default' : 'secondary'} onClick={() => setTab('promos')}>
          <Megaphone className="h-4 w-4" />
          Promos Marketplace
        </Button>
        <Button variant={tab === 'banners' ? 'default' : 'secondary'} onClick={() => setTab('banners')}>
          <ImageIcon className="h-4 w-4" />
          À la une
        </Button>
      </div>

      {tab === 'promos' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingPromoId ? 'Modifier la promo' : 'Nouvelle promo'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Titre</label>
                <Input className="mt-1" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Sous-titre</label>
                <Input className="mt-1" value={promoForm.subtitle} onChange={(e) => setPromoForm({ ...promoForm, subtitle: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">URL image</label>
                <Input className="mt-1" value={promoForm.imageUrl} onChange={(e) => setPromoForm({ ...promoForm, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium">Label bouton</label>
                <Input className="mt-1" value={promoForm.ctaLabel} onChange={(e) => setPromoForm({ ...promoForm, ctaLabel: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Action au clic</label>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={promoForm.linkType}
                  onChange={(e) => setPromoForm({ ...promoForm, linkType: e.target.value })}
                >
                  {promoLinkOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {['shop', 'product', 'url'].includes(promoForm.linkType) && (
                <div>
                  <label className="text-sm font-medium">Cible (ID ou URL)</label>
                  <Input className="mt-1" value={promoForm.linkTarget} onChange={(e) => setPromoForm({ ...promoForm, linkTarget: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Ordre</label>
                  <Input type="number" className="mt-1" value={promoForm.sortOrder} onChange={(e) => setPromoForm({ ...promoForm, sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 text-sm pb-2">
                  <input type="checkbox" checked={promoForm.isActive} onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })} />
                  Active
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Début</label>
                  <Input type="datetime-local" className="mt-1" value={promoForm.startsAt} onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Fin</label>
                  <Input type="datetime-local" className="mt-1" value={promoForm.endsAt} onChange={(e) => setPromoForm({ ...promoForm, endsAt: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePromo} disabled={saving} className="flex-1">
                  {editingPromoId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saving ? '...' : editingPromoId ? 'Enregistrer' : 'Ajouter'}
                </Button>
                {editingPromoId && (
                  <Button variant="secondary" onClick={resetPromoForm}><X className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Promos ({promos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted">{p.subtitle}</div>
                        </TableCell>
                        <TableCell className="text-sm">{p.linkType}</TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? 'success' : 'danger'}>
                            {p.isActive ? 'Active' : 'Off'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingPromoId(p.id)
                              setPromoForm({
                                title: p.title,
                                subtitle: p.subtitle || '',
                                imageUrl: p.imageUrl || '',
                                ctaLabel: p.ctaLabel,
                                linkType: p.linkType,
                                linkTarget: p.linkTarget || '',
                                sortOrder: p.sortOrder,
                                isActive: p.isActive,
                                startsAt: toDateInput(p.startsAt),
                                endsAt: toDateInput(p.endsAt),
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              await api.content.updatePromo(p.id, { isActive: !p.isActive })
                              load()
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              if (!confirm('Supprimer cette promo ?')) return
                              await api.content.removePromo(p.id)
                              load()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{editingBannerId ? 'Modifier la bannière' : 'Nouvelle bannière'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Badge</label>
                <Input className="mt-1" value={bannerForm.badge} onChange={(e) => setBannerForm({ ...bannerForm, badge: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Titre</label>
                <Input className="mt-1" value={bannerForm.headline} onChange={(e) => setBannerForm({ ...bannerForm, headline: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Sous-titre</label>
                <Input className="mt-1" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">URL image</label>
                <Input className="mt-1" value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium">Label bouton</label>
                <Input className="mt-1" value={bannerForm.ctaLabel} onChange={(e) => setBannerForm({ ...bannerForm, ctaLabel: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Action au clic</label>
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={bannerForm.linkType}
                  onChange={(e) => setBannerForm({ ...bannerForm, linkType: e.target.value })}
                >
                  {bannerLinkOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {bannerForm.linkType === 'url' && (
                <div>
                  <label className="text-sm font-medium">URL</label>
                  <Input className="mt-1" value={bannerForm.linkTarget} onChange={(e) => setBannerForm({ ...bannerForm, linkTarget: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Ordre</label>
                  <Input type="number" className="mt-1" value={bannerForm.sortOrder} onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-end gap-2 text-sm pb-2">
                  <input type="checkbox" checked={bannerForm.isActive} onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })} />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveBanner} disabled={saving} className="flex-1">
                  {editingBannerId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saving ? '...' : editingBannerId ? 'Enregistrer' : 'Ajouter'}
                </Button>
                {editingBannerId && (
                  <Button variant="secondary" onClick={resetBannerForm}><X className="h-4 w-4" /></Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Bannières ({banners.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contenu</TableHead>
                      <TableHead>Lien</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banners.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="text-xs text-muted">{b.badge}</div>
                          <div className="font-medium">{b.headline}</div>
                          <div className="text-xs text-muted">{b.subtitle}</div>
                        </TableCell>
                        <TableCell className="text-sm">{b.linkType}</TableCell>
                        <TableCell>
                          <Badge variant={b.isActive ? 'success' : 'danger'}>
                            {b.isActive ? 'Active' : 'Off'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingBannerId(b.id)
                              setBannerForm({
                                badge: b.badge || '',
                                headline: b.headline,
                                subtitle: b.subtitle || '',
                                imageUrl: b.imageUrl || '',
                                ctaLabel: b.ctaLabel,
                                linkType: b.linkType,
                                linkTarget: b.linkTarget || '',
                                sortOrder: b.sortOrder,
                                isActive: b.isActive,
                                startsAt: toDateInput(b.startsAt),
                                endsAt: toDateInput(b.endsAt),
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              await api.content.updateHomeBanner(b.id, { isActive: !b.isActive })
                              load()
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              if (!confirm('Supprimer cette bannière ?')) return
                              await api.content.removeHomeBanner(b.id)
                              load()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
