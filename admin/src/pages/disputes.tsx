import { useState, useEffect } from 'react'
import { api, getAdminRole } from '@/lib/api'
import { canHandleDisputes } from '@/lib/permissions'

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  under_review: 'En cours d\'examen',
  resolved: 'Résolu',
  rejected: 'Rejeté',
  compensated: 'Compensé',
}

const statusColors: Record<string, string> = {
  open: '#F04A3A',
  under_review: '#F7E300',
  resolved: '#0D8F8F',
  rejected: '#6b7280',
  compensated: '#0D8F8F',
}

const decisionLabels: Record<string, string> = {
  none: 'Aucune',
  warning: 'Avertissement',
  temporary_suspension: 'Suspension temporaire',
  permanent_deactivation: 'Désactivation définitive',
}

export function DisputesPage() {
  const canWrite = canHandleDisputes(getAdminRole())
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadDisputes()
  }, [])

  async function loadDisputes() {
    try {
      const data = await api.disputes.all()
      setDisputes(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function updateDispute(id: string, data: { status?: string; decision?: string; adminNotes?: string }) {
    try {
      await api.disputes.update(id, data)
      await loadDisputes()
      if (selected?.id === id) {
        setSelected({ ...selected, ...data })
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Litiges</h1>
        <p className="text-gray-500 mt-1">Gérez les réclamations et litiges</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : disputes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun litige en cours</div>
          ) : (
            disputes.map((d) => (
              <div
                key={d.id}
                onClick={() => { setSelected(d); setAdminNotes(d.adminNotes || '') }}
                className={`bg-white rounded-xl border p-5 cursor-pointer transition hover:shadow-md ${selected?.id === d.id ? 'border-[#0D8F8F] ring-1 ring-[#0D8F8F]' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{d.reason}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Par {d.raisedBy?.firstName} {d.raisedBy?.lastName} — {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                    {d.description && <p className="text-sm text-gray-600 mt-2">{d.description}</p>}
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: statusColors[d.status] || '#6b7280' }}
                  >
                    {statusLabels[d.status] || d.status}
                  </span>
                </div>
                {d.mission && (
                  <div className="mt-3 text-xs text-gray-400">
                    Mission: {d.mission.pickupAddress} → {d.mission.deliveryAddress}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 sticky top-6">
              <h3 className="font-semibold text-gray-900">Détails du litige</h3>
              <div>
                <label className="text-xs font-medium text-gray-500">Statut</label>
                <select
                  value={selected.status}
                  disabled={!canWrite}
                  onChange={(e) => {
                    setSelected({ ...selected, status: e.target.value })
                    updateDispute(selected.id, { status: e.target.value })
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
                >
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Décision / Sanction</label>
                <select
                  value={selected.decision || 'none'}
                  disabled={!canWrite}
                  onChange={(e) => {
                    setSelected({ ...selected, decision: e.target.value })
                    updateDispute(selected.id, { decision: e.target.value })
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
                >
                  {Object.entries(decisionLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Notes admin</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
                  placeholder="Notes internes..."
                />
                {canWrite && (
                <button
                  onClick={() => updateDispute(selected.id, { adminNotes })}
                  className="mt-2 px-4 py-2 bg-[#0D8F8F] text-white rounded-lg text-sm font-medium hover:bg-[#0a7a7a]"
                >
                  Enregistrer les notes
                </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-gray-400 text-sm">
              Sélectionnez un litige pour voir les détails
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
