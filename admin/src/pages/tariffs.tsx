import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatFCFA, formatDate } from '@/lib/utils'
import { Settings, Shield, Save, CheckCircle2, History } from 'lucide-react'

export function TariffsPage() {
  const [tariffs, setTariffs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingInsurance, setSavingInsurance] = useState(false)

  const [form, setForm] = useState({
    baseFare: 500,
    perKm: 200,
    expressMultiplier: 1.5,
    groupeMultiplier: 0.8,
    prioritaireMultiplier: 1.25,
    programmeMultiplier: 0.9,
    roundingFactor: 50,
  })

  const [insuranceForm, setInsuranceForm] = useState({
    partnerName: '',
    partnerContact: '',
    coveragePlafond: 0,
    eligibilityMonths: 4,
    sinistreProcedure: '',
  })

  useEffect(() => {
    Promise.all([
      api.tariffs.all().catch(() => []),
      api.tariffs.active().catch(() => null),
      api.tariffs.insurance().catch(() => null),
    ]).then(([t, a, i]) => {
      setTariffs(t)
      if (a) {
        setForm({
          baseFare: a.baseFare,
          perKm: a.perKm,
          expressMultiplier: a.expressMultiplier,
          groupeMultiplier: a.groupeMultiplier ?? 0.8,
          prioritaireMultiplier: a.prioritaireMultiplier ?? 1.25,
          programmeMultiplier: a.programmeMultiplier,
          roundingFactor: a.roundingFactor,
        })
      }
      if (i) {
        setInsuranceForm({
          partnerName: i.partnerName || '',
          partnerContact: i.partnerContact || '',
          coveragePlafond: i.coveragePlafond || 0,
          eligibilityMonths: i.eligibilityMonths || 4,
          sinistreProcedure: i.sinistreProcedure || '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleSaveTariff = async () => {
    setSaving(true)
    try {
      await api.tariffs.create(form)
      const [t] = await Promise.all([api.tariffs.all(), api.tariffs.active()])
      setTariffs(t)
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInsurance = async () => {
    setSavingInsurance(true)
    try {
      await api.tariffs.createInsurance(insuranceForm)
      await api.tariffs.insurance()
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSavingInsurance(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.tariffs.activate(id)
      const [t] = await Promise.all([api.tariffs.all(), api.tariffs.active()])
      setTariffs(t)
    } catch (e: any) {
      alert(e.message || 'Erreur')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration des tarifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configuration des tarifs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-primary-soft p-3 text-sm text-muted">
              <p>Les tarifs sont utilisés pour calculer le prix des missions selon la distance et l'urgence.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Tarif de base (FCFA)</label>
                <Input
                  type="number"
                  value={form.baseFare}
                  onChange={(e) => setForm({ ...form, baseFare: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Coût par km (FCFA)</label>
                <Input
                  type="number"
                  value={form.perKm}
                  onChange={(e) => setForm({ ...form, perKm: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Multiplicateur Express</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.expressMultiplier}
                  onChange={(e) => setForm({ ...form, expressMultiplier: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Multiplicateur Groupé (−20 %)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.groupeMultiplier}
                  onChange={(e) => setForm({ ...form, groupeMultiplier: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Multiplicateur Programmé</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.programmeMultiplier}
                  onChange={(e) => setForm({ ...form, programmeMultiplier: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Arrondi (FCFA)</label>
                <Input
                  type="number"
                  value={form.roundingFactor}
                  onChange={(e) => setForm({ ...form, roundingFactor: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Aperçu */}
            <div className="rounded-lg border border-border p-4 bg-gray-50">
              <p className="text-xs text-muted mb-2">Aperçu du calcul</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Standard · 10 km</span>
                  <span className="font-semibold">{formatFCFA(Math.round((form.baseFare + 10 * form.perKm) / form.roundingFactor) * form.roundingFactor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Express · 10 km</span>
                  <span className="font-semibold">{formatFCFA(Math.round((form.baseFare + 10 * form.perKm) * form.expressMultiplier / form.roundingFactor) * form.roundingFactor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Groupé · 10 km</span>
                  <span className="font-semibold">{formatFCFA(Math.round((form.baseFare + 10 * form.perKm) * form.groupeMultiplier / form.roundingFactor) * form.roundingFactor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Programmé · 10 km</span>
                  <span className="font-semibold">{formatFCFA(Math.round((form.baseFare + 10 * form.perKm) * form.programmeMultiplier / form.roundingFactor) * form.roundingFactor)}</span>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveTariff} disabled={saving} className="w-full">
              <Save className="h-4 w-4" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder les tarifs'}
            </Button>
          </CardContent>
        </Card>

        {/* Configuration assurance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configuration assurance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-success-soft p-3 text-sm text-muted">
              <p>L'assurance est offerte après {insuranceForm.eligibilityMonths} mois d'abonnement continu.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Nom du partenaire assureur</label>
              <Input
                value={insuranceForm.partnerName}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, partnerName: e.target.value })}
                placeholder="Ex: NSIA Assurance"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contact assureur</label>
              <Input
                value={insuranceForm.partnerContact}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, partnerContact: e.target.value })}
                placeholder="Téléphone / email"
                className="mt-1"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">Plafond de garantie (FCFA)</label>
                <Input
                  type="number"
                  value={insuranceForm.coveragePlafond}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, coveragePlafond: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Mois d'éligibilité</label>
                <Input
                  type="number"
                  value={insuranceForm.eligibilityMonths}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, eligibilityMonths: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Procédure de déclaration de sinistre</label>
              <textarea
                value={insuranceForm.sinistreProcedure}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, sinistreProcedure: e.target.value })}
                placeholder="Décrivez la procédure à suivre en cas de sinistre..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                rows={3}
              />
            </div>

            <Button onClick={handleSaveInsurance} disabled={savingInsurance} className="w-full">
              <Save className="h-4 w-4" />
              {savingInsurance ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Historique des tarifs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historique des configurations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tariffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Settings className="h-12 w-12 mb-2 opacity-40" />
              <p className="text-sm">Aucune configuration enregistrée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statut</TableHead>
                  <TableHead>Tarif de base</TableHead>
                  <TableHead>Coût/km</TableHead>
                  <TableHead>Express</TableHead>
                  <TableHead>Groupé</TableHead>
                  <TableHead>Programmé</TableHead>
                  <TableHead>Arrondi</TableHead>
                  <TableHead>Modifié le</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tariffs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.isActive ? (
                        <Badge variant="success">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Actif</span>
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatFCFA(t.baseFare)}</TableCell>
                    <TableCell>{formatFCFA(t.perKm)}</TableCell>
                    <TableCell>×{t.expressMultiplier}</TableCell>
                    <TableCell>×{t.groupeMultiplier ?? 0.8}</TableCell>
                    <TableCell>×{t.programmeMultiplier}</TableCell>
                    <TableCell>{t.roundingFactor} FCFA</TableCell>
                    <TableCell className="text-muted text-sm">{formatDate(t.updatedAt)}</TableCell>
                    <TableCell>
                      {!t.isActive && (
                        <Button size="sm" variant="secondary" onClick={() => handleActivate(t.id)}>
                          Activer
                        </Button>
                      )}
                    </TableCell>
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
