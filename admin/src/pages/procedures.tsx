import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatFCFA } from '@/lib/utils'
import { Building2, Save, Plus, Trash2, Pencil, X, CheckCircle2 } from 'lucide-react'

interface Procedure {
  id: string
  name: string
  category: string
  organism: string
  intervention: string
  estimatedFee: number
  estimatedDelay: string
  isActive: boolean
}

const emptyForm = {
  name: '',
  category: '',
  organism: '',
  intervention: '',
  estimatedFee: 0,
  estimatedDelay: '',
  isActive: true,
}

export function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const load = () => {
    setLoading(true)
    api.adminProcedures
      .all()
      .then((data: Procedure[]) => setProcedures(Array.isArray(data) ? data : []))
      .catch(() => setProcedures([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm({ ...emptyForm })
    setEditingId(null)
  }

  const handleEdit = (p: Procedure) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      category: p.category,
      organism: p.organism,
      intervention: p.intervention,
      estimatedFee: p.estimatedFee,
      estimatedDelay: p.estimatedDelay,
      isActive: p.isActive,
    })
  }

  const handleSave = async () => {
    if (!form.name || !form.category || !form.organism) {
      alert('Nom, catégorie et organisme sont requis')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await api.adminProcedures.update(editingId, form)
      } else {
        await api.adminProcedures.create(form)
      }
      resetForm()
      load()
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette démarche ?')) return
    try {
      await api.adminProcedures.remove(id)
      load()
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la suppression')
    }
  }

  const handleToggleActive = async (p: Procedure) => {
    try {
      await api.adminProcedures.update(p.id, { isActive: !p.isActive })
      load()
    } catch (e: any) {
      alert(e.message || 'Erreur')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulaire création / édition */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingId ? 'Modifier la démarche' : 'Nouvelle démarche'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nom de la démarche</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Obtention NINEA"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Catégorie</label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex: Entreprise, État civil..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Organisme</label>
              <Input
                value={form.organism}
                onChange={(e) => setForm({ ...form, organism: e.target.value })}
                placeholder="Ex: APIX, Mairie..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Intervention</label>
              <textarea
                value={form.intervention}
                onChange={(e) => setForm({ ...form, intervention: e.target.value })}
                placeholder="Description de l'intervention..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Frais à avancer (FCFA)</label>
                <Input
                  type="number"
                  value={form.estimatedFee}
                  onChange={(e) => setForm({ ...form, estimatedFee: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Délai estimé</label>
                <Input
                  value={form.estimatedDelay}
                  onChange={(e) => setForm({ ...form, estimatedDelay: e.target.value })}
                  placeholder="Ex: 3-5 jours"
                  className="mt-1"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Démarche active
            </label>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Sauvegarde...' : editingId ? 'Enregistrer' : 'Ajouter'}
              </Button>
              {editingId && (
                <Button variant="secondary" onClick={resetForm} disabled={saving}>
                  <X className="h-4 w-4" />
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Liste des démarches */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Démarches administratives ({procedures.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : procedures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted">
                <Building2 className="h-12 w-12 mb-2 opacity-40" />
                <p className="text-sm">Aucune démarche enregistrée</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Organisme</TableHead>
                    <TableHead>Frais</TableHead>
                    <TableHead>Délai</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procedures.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.organism}</TableCell>
                      <TableCell>{formatFCFA(p.estimatedFee)}</TableCell>
                      <TableCell className="text-muted text-sm">{p.estimatedDelay || '-'}</TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleActive(p)}>
                          {p.isActive ? (
                            <Badge variant="success">
                              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Active</span>
                            </Badge>
                          ) : (
                            <Badge variant="neutral">Inactive</Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-accent" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
