import React, { useEffect, useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import {
  COLIS_NEED_OPTIONS,
  PARTICULIER_NEED_OPTIONS,
  PRO_FLOW_OPTIONS,
  colisNeed,
  defaultNeedForAudience,
  missionAudience,
  proFlow,
  validationServiceType,
  type MissionAudience,
} from '../constants/serviceFlows';

export type ServiceDetails = Record<string, string | boolean | undefined>;

type AdminProcedure = {
  id: string;
  name: string;
  organism: string;
  intervention?: string;
  estimatedFee?: number;
  estimatedDelay?: string;
  category?: string;
};

type Props = {
  serviceType: string;
  details: ServiceDetails;
  onChange: (next: ServiceDetails) => void;
  /** Catalogue démarches */
  procedures?: AdminProcedure[];
  /** Multi-sélection de procédures */
  selectedProcedures?: AdminProcedure[];
  onChangeSelectedProcedures?: (next: AdminProcedure[]) => void;
  otherProcedureEnabled?: boolean;
  otherProcedureText?: string;
  onChangeOtherProcedure?: (enabled: boolean, text: string) => void;
  /** @deprecated mono-sélection — gardé pour compat */
  selectedProcedureId?: string | null;
  onSelectProcedure?: (procedure: AdminProcedure | null) => void;
  /** Scroll parent pour garder le champ visible au-dessus du clavier */
  onFieldFocus?: (target?: View | null) => void;
};

const FieldFocusContext = React.createContext<((target?: View | null) => void) | undefined>(undefined);

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  required?: boolean;
}) {
  const wrapRef = useRef<View>(null);
  const onFieldFocus = useContext(FieldFocusContext);
  return (
    <View ref={wrapRef} style={styles.field} collapsable={false}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={[styles.inputBox, multiline && styles.textArea]}>
        <TextInput
          style={multiline ? styles.textAreaInput : styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType}
          onFocus={() => onFieldFocus?.(wrapRef.current)}
        />
      </View>
    </View>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.chip, value === o.id && styles.chipActive]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, value === o.id && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.85}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? Colors.primary : Colors.gray400}
      />
      <Text style={styles.toggleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.disclosureWrap}>
      <TouchableOpacity style={styles.disclosureBtn} onPress={() => setOpen((v) => !v)} activeOpacity={0.85}>
        <Text style={styles.disclosureTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
      </TouchableOpacity>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

const set = (details: ServiceDetails, onChange: Props['onChange'], key: string, value: string | boolean) =>
  onChange({ ...details, [key]: value });

export const str = (details: ServiceDetails, key: string) => String(details[key] ?? '');

const req = (details: ServiceDetails, key: string, message: string) =>
  !str(details, key).trim() ? message : null;

/** Colis a ses propres champs poids/valeur — pas de checklist commune pour eviter les doublons. */
const COMMON_CHECKLIST_SERVICES = ['documents', 'courses', 'marchandises'];

function usesCommonChecklist(serviceType: string) {
  return COMMON_CHECKLIST_SERVICES.includes(serviceType);
}

const missionGoalOptions = [
  { id: 'deposer', label: 'Déposer' },
  { id: 'recuperer', label: 'Récupérer' },
  { id: 'suivre', label: 'Suivre' },
  { id: 'commissionnaire', label: 'Commissionnaire' },
  { id: 'autre', label: 'Autre' },
];

function parseWeightKg(value: string): number | null {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getRecommendedVehicle(weightKg: number | null): { id: string; label: string; hint: string } | null {
  if (weightKg == null) return null;
  if (weightKg <= 20) return { id: 'moto', label: 'Moto', hint: 'jusqu’à 20 kg' };
  if (weightKg <= 100) return { id: 'voiture', label: 'Voiture', hint: '21 à 100 kg' };
  if (weightKg <= 500) return { id: 'camionnette', label: 'Camionnette', hint: '101 à 500 kg' };
  return { id: 'camion', label: 'Camion', hint: 'plus de 500 kg' };
}

export function ServiceDetailsFields({
  serviceType,
  details,
  onChange,
  procedures = [],
  selectedProcedures = [],
  onChangeSelectedProcedures,
  otherProcedureEnabled = false,
  otherProcedureText = '',
  onChangeOtherProcedure,
  selectedProcedureId,
  onSelectProcedure,
  onFieldFocus,
}: Props) {
  if (!serviceType) return null;

  const body = <ServiceDetailsFieldsInner
    serviceType={serviceType}
    details={details}
    onChange={onChange}
    procedures={procedures}
    selectedProcedures={selectedProcedures}
    onChangeSelectedProcedures={onChangeSelectedProcedures}
    otherProcedureEnabled={otherProcedureEnabled}
    otherProcedureText={otherProcedureText}
    onChangeOtherProcedure={onChangeOtherProcedure}
    selectedProcedureId={selectedProcedureId}
    onSelectProcedure={onSelectProcedure}
  />;

  return (
    <FieldFocusContext.Provider value={onFieldFocus}>
      {body}
    </FieldFocusContext.Provider>
  );
}

function ServiceDetailsFieldsInner({
  serviceType,
  details,
  onChange,
  procedures = [],
  selectedProcedures = [],
  onChangeSelectedProcedures,
  otherProcedureEnabled = false,
  otherProcedureText = '',
  onChangeOtherProcedure,
  selectedProcedureId,
  onSelectProcedure,
}: Omit<Props, 'onFieldFocus'>) {
  const [procedureQuery, setProcedureQuery] = useState('');
  if (!serviceType) return null;

  const need = serviceType === 'colis' ? colisNeed(details) : null;
  const audience = serviceType === 'colis' ? missionAudience(details) : null;
  const activeProFlow = serviceType === 'colis' && audience === 'professionnel' ? proFlow(details) : null;

  const setAudience = (nextAudience: MissionAudience) => {
    onChange({ ...details, ...defaultNeedForAudience(nextAudience) });
  };

  const setColisNeed = (id: string) => {
    const next: ServiceDetails = { ...details, colisNeed: id };
    if (id === 'objet') next.shipmentKind = 'objet';
    if (id === 'colis') next.shipmentKind = 'colis';
    if (id === 'courses_list') next.courseMode = 'simple';
    if (id === 'bill_payment') next.courseMode = 'bill_payment';
    if (id === 'document_transport') next.documentFlow = 'have_document';
    onChange(next);
  };

  const marchandisesWeight = parseWeightKg(
    str(details, 'sharedWeight') || str(details, 'weight'),
  );
  const recommendedVehicle = getRecommendedVehicle(marchandisesWeight);

  const toggleProcedure = (p: AdminProcedure) => {
    if (onChangeSelectedProcedures) {
      const exists = selectedProcedures.some((x) => x.id === p.id);
      const next = exists
        ? selectedProcedures.filter((x) => x.id !== p.id)
        : [...selectedProcedures, p];
      onChangeSelectedProcedures(next);
      onChange({
        ...details,
        procedureType: next.map((x) => x.name).join(' | '),
        organism: [...new Set(next.map((x) => x.organism))].join(' · '),
        procedureId: next.map((x) => x.id).join(','),
      });
      return;
    }
    // Compat mono-sélection
    onSelectProcedure?.(p);
    onChange({
      ...details,
      procedureType: p.name,
      organism: p.organism,
      procedureId: p.id,
      intervention: p.intervention || '',
    });
  };

  const renderAdminProcedureForm = () => {
    const q = procedureQuery.trim().toLowerCase();
    const filtered = q
      ? procedures.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.organism || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q),
        )
      : procedures;
    const grouped = filtered.reduce((acc: Record<string, AdminProcedure[]>, p) => {
      const cat = p.category || 'Autres';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
    const multiMode = !!onChangeSelectedProcedures;
    const selectedIds = new Set(
      multiMode
        ? selectedProcedures.map((p) => p.id)
        : selectedProcedureId
          ? [selectedProcedureId]
          : [],
    );
    const selectedCount = selectedIds.size + (otherProcedureEnabled ? 1 : 0);
    const officialTotal = selectedProcedures.reduce(
      (sum, p) => sum + (Number(p.estimatedFee) || 0),
      0,
    );

    return (
      <>
        <View style={styles.docsHero}>
          <Text style={styles.docsHeroTitle}>Quels documents ?</Text>
          <Text style={styles.docsHeroSub}>
            Sélectionnez un ou plusieurs papiers. Les frais officiels estimés s’additionnent.
          </Text>
          {selectedCount > 0 ? (
            <View style={styles.docsCountPill}>
              <Ionicons name="documents-outline" size={14} color={Colors.primary} />
              <Text style={styles.docsCountText}>
                {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                {officialTotal > 0 ? ` · ~${officialTotal.toLocaleString('fr-FR')} FCFA frais` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {selectedProcedures.length > 0 ? (
          <View style={styles.chipWrap}>
            {selectedProcedures.map((p) => (
              <TouchableOpacity
                key={`chip-${p.id}`}
                style={styles.selChip}
                onPress={() => toggleProcedure(p)}
                activeOpacity={0.85}
              >
                <Text style={styles.selChipText} numberOfLines={1}>{p.name}</Text>
                <Ionicons name="close-circle" size={16} color={Colors.primary} />
              </TouchableOpacity>
            ))}
            {otherProcedureEnabled ? (
              <TouchableOpacity
                style={styles.selChip}
                onPress={() => onChangeOtherProcedure?.(false, otherProcedureText)}
                activeOpacity={0.85}
              >
                <Text style={styles.selChipText}>Autres</Text>
                <Ionicons name="close-circle" size={16} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={procedureQuery}
            onChangeText={setProcedureQuery}
            placeholder="Rechercher un document…"
            placeholderTextColor={Colors.gray400}
            autoCorrect={false}
          />
          {procedureQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setProcedureQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Documents *</Text>
          {procedures.length === 0 ? (
            <Text style={styles.hintMuted}>Chargement des démarches…</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.hintMuted}>Aucun document pour « {procedureQuery} ».</Text>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <View key={category} style={styles.procedureGroup}>
                <Text style={styles.procedureGroupTitle}>{category}</Text>
                {items.map((p) => {
                  const active = selectedIds.has(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.procedureChoice, active && styles.procedureChoiceOn]}
                      onPress={() => toggleProcedure(p)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.procedureCheck, active && styles.procedureCheckOn]}>
                        {active ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.procedureChoiceName, active && styles.procedureChoiceNameOn]}>
                          {p.name}
                        </Text>
                        <Text style={styles.procedureChoiceOrg}>{p.organism}</Text>
                        <View style={styles.procedureBadges}>
                          {Number(p.estimatedFee) > 0 ? (
                            <View style={styles.procedureBadge}>
                              <Ionicons name="cash-outline" size={12} color={Colors.warning} />
                              <Text style={styles.procedureBadgeText}>
                                ~{Number(p.estimatedFee).toLocaleString('fr-FR')} FCFA
                              </Text>
                            </View>
                          ) : null}
                          {p.estimatedDelay ? (
                            <View style={[styles.procedureBadge, styles.procedureBadgeDelay]}>
                              <Ionicons name="time-outline" size={12} color={Colors.info} />
                              <Text style={[styles.procedureBadgeText, { color: Colors.info }]}>
                                {p.estimatedDelay}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.procedureChoice, otherProcedureEnabled && styles.procedureChoiceOn]}
            onPress={() => onChangeOtherProcedure?.(!otherProcedureEnabled, otherProcedureText)}
            activeOpacity={0.85}
          >
            <View style={[styles.procedureCheck, otherProcedureEnabled && styles.procedureCheckOn]}>
              {otherProcedureEnabled ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.procedureChoiceName, otherProcedureEnabled && styles.procedureChoiceNameOn]}>
                Autres
              </Text>
              <Text style={styles.procedureChoiceOrg}>Document non listé — précisez ci-dessous</Text>
            </View>
          </TouchableOpacity>
          {otherProcedureEnabled ? (
            <Field
              label="Précisez le document *"
              value={otherProcedureText}
              onChangeText={(v) => onChangeOtherProcedure?.(true, v)}
              placeholder="Ex: Attestation de travail, certificat médical…"
              required
            />
          ) : null}
        </View>

        {selectedCount > 0 ? (
          <View style={styles.procedureSummary}>
            <Text style={styles.procedureSummaryLabel}>Récapitulatif</Text>
            <Text style={styles.procedureSummaryValue}>
              {[
                ...selectedProcedures.map((p) => p.name),
                otherProcedureEnabled && otherProcedureText.trim()
                  ? `Autre: ${otherProcedureText.trim()}`
                  : otherProcedureEnabled
                    ? 'Autre (à préciser)'
                    : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {officialTotal > 0 ? (
              <Text style={styles.procedureSummaryHint}>
                Frais officiels estimés : {officialTotal.toLocaleString('fr-FR')} FCFA (hors honoraires prestataire)
              </Text>
            ) : null}
          </View>
        ) : null}

        <ChipRow
          label="Mission"
          value={str(details, 'missionGoal')}
          onChange={(id) => set(details, onChange, 'missionGoal', id)}
          required
          options={missionGoalOptions}
        />
        {str(details, 'missionGoal') === 'commissionnaire' ? (
          <Text style={styles.hintMuted}>
            Le commissionnaire fait le rang pour vous (file d’attente, dépôt, retrait). Ajoutez les scans des documents.
          </Text>
        ) : null}
        {str(details, 'missionGoal') === 'autre' && (
          <Field
            label="Précision mission"
            value={str(details, 'missionGoalOther')}
            onChangeText={(v) => set(details, onChange, 'missionGoalOther', v)}
            placeholder="Ex: déposer le dossier puis récupérer le reçu"
            required
          />
        )}

        <Disclosure title="Précisions (optionnel)">
          <Field
            label="Documents remis"
            value={str(details, 'documentsGiven')}
            onChangeText={(v) => set(details, onChange, 'documentsGiven', v)}
            placeholder="Pièces fournies au prestataire"
            multiline
          />
          <Field
            label="Documents à récupérer"
            value={str(details, 'documentsToCollect')}
            onChangeText={(v) => set(details, onChange, 'documentsToCollect', v)}
            placeholder="Document final attendu"
            multiline
          />
          <Field
            label="Numéro de dossier"
            value={str(details, 'fileNumber')}
            onChangeText={(v) => set(details, onChange, 'fileNumber', v)}
            placeholder="Si déjà ouvert"
          />
          <Toggle
            label="Rendez-vous / créneau requis"
            value={!!details.appointmentRequired}
            onChange={(v) => set(details, onChange, 'appointmentRequired', v)}
          />
          <Field
            label="Autorisation / procuration"
            value={str(details, 'authorization')}
            onChangeText={(v) => set(details, onChange, 'authorization', v)}
            placeholder="Si nécessaire"
            multiline
          />
          <Field
            label="Instructions"
            value={str(details, 'instructions')}
            onChangeText={(v) => set(details, onChange, 'instructions', v)}
            placeholder="Consignes spécifiques"
            multiline
          />
        </Disclosure>
      </>
    );
  };

  useEffect(() => {
    const isMarchandises =
      serviceType === 'marchandises'
      || (serviceType === 'colis' && missionAudience(details) === 'professionnel' && proFlow(details) === 'marchandises');
    if (!isMarchandises) return;
    if (!recommendedVehicle) return;
    if (details.vehicleOverride) return;
    if (str(details, 'vehicleNeeded') !== recommendedVehicle.id) {
      onChange({ ...details, vehicleNeeded: recommendedVehicle.id });
    }
  }, [details, onChange, recommendedVehicle, serviceType]);

  return (
    <View style={styles.wrap}>
      {usesCommonChecklist(serviceType)
        && !(serviceType === 'documents' && str(details, 'documentFlow') === 'administrative_process')
        && (
        <View style={styles.commonCard}>
          <Text style={styles.commonTitle}>Checklist commune</Text>
          <Text style={styles.commonSubtitle}>
            Informations complémentaires pour documents, courses et marchandises.
          </Text>
          <Field
            label="Que faut-il transporter ?"
            value={str(details, 'sharedDescription')}
            onChangeText={(v) => set(details, onChange, 'sharedDescription', v)}
            placeholder="Ex: dossier, panier de courses, cartons, colis…"
          />
          <View style={styles.row2}>
            <View style={styles.rowCol}>
              <Field
                label="Poids estimé"
                value={str(details, 'sharedWeight')}
                onChangeText={(v) => set(details, onChange, 'sharedWeight', v)}
                placeholder="Ex: 2 kg"
              />
            </View>
            <View style={styles.rowCol}>
              <Field
                label="Valeur estimée (FCFA)"
                value={str(details, 'sharedEstimatedValue')}
                onChangeText={(v) => set(details, onChange, 'sharedEstimatedValue', v)}
                placeholder="Ex: 25000"
                keyboardType="numeric"
              />
            </View>
          </View>
          <Disclosure title="Ajouter des precisions">
            <Toggle
              label="Contenu fragile / manipulation soignee"
              value={!!details.sharedFragile}
              onChange={(v) => set(details, onChange, 'sharedFragile', v)}
            />
            <Toggle
              label="Confirmation de remise souhaitee"
              value={!!details.sharedRequiresSignature}
              onChange={(v) => set(details, onChange, 'sharedRequiresSignature', v)}
            />
            <Field
              label="Consignes communes"
              value={str(details, 'sharedInstructions')}
              onChangeText={(v) => set(details, onChange, 'sharedInstructions', v)}
              placeholder="Precautions, horaires, reperes..."
              multiline
            />
          </Disclosure>
        </View>
      )}

      {(serviceType === 'colis') && (
        <>
          <Text style={styles.audienceTitle}>Pour qui est cette mission ?</Text>
          <View style={styles.audienceRow}>
            {([
              { id: 'particulier' as MissionAudience, label: 'Particulier', desc: 'Colis, objet, courses…', icon: 'person-outline' as const },
              { id: 'professionnel' as MissionAudience, label: 'Professionnel', desc: 'Entreprise, stock B2B', icon: 'business-outline' as const },
            ]).map((opt) => {
              const selected = audience === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.audienceCard, selected && styles.audienceCardOn]}
                  onPress={() => setAudience(opt.id)}
                  activeOpacity={0.88}
                >
                  <View style={[styles.audienceIcon, selected && styles.audienceIconOn]}>
                    <Ionicons name={opt.icon} size={22} color={selected ? Colors.white : Colors.primary} />
                  </View>
                  <Text style={[styles.audienceLabel, selected && styles.audienceLabelOn]}>{opt.label}</Text>
                  <Text style={styles.audienceDesc}>{opt.desc}</Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={styles.audienceCheck} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {audience === 'particulier' && (
            <>
              <Text style={styles.subSectionTitle}>Votre besoin</Text>
              <View style={styles.needGrid}>
                {PARTICULIER_NEED_OPTIONS.map((opt) => {
                  const selected = need === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.needCard, selected && styles.needCardOn]}
                      onPress={() => setColisNeed(opt.id)}
                      activeOpacity={0.88}
                    >
                      <Ionicons name={opt.icon as any} size={18} color={selected ? Colors.primary : Colors.gray500} />
                      <Text style={[styles.needLabel, selected && styles.needLabelOn]}>{opt.label}</Text>
                      <Text style={styles.needDesc} numberOfLines={2}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {audience === 'professionnel' && (
            <>
              <Text style={styles.subSectionTitle}>Type de mission pro</Text>
              <View style={styles.needGrid}>
                {PRO_FLOW_OPTIONS.map((opt) => {
                  const selected = activeProFlow === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.needCard, selected && styles.needCardOn]}
                      onPress={() => set(details, onChange, 'proFlow', opt.id)}
                      activeOpacity={0.88}
                    >
                      <Ionicons name={opt.icon as any} size={18} color={selected ? Colors.primary : Colors.gray500} />
                      <Text style={[styles.needLabel, selected && styles.needLabelOn]}>{opt.label}</Text>
                      <Text style={styles.needDesc} numberOfLines={2}>{opt.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {audience === 'particulier' && (need === 'colis' || need === 'objet') && (
            <>
              <Field
                label={need === 'objet' ? "Objet / contenu" : 'Contenu du colis'}
                value={str(details, 'packageContent')}
                onChangeText={(v) => set(details, onChange, 'packageContent', v)}
                placeholder={need === 'objet' ? 'Ex: téléphone, clés, sac…' : 'Ex: vêtements, électronique…'}
                required
              />
              {need === 'objet' && (
                <Field
                  label="Type d'objet"
                  value={str(details, 'objectType')}
                  onChangeText={(v) => set(details, onChange, 'objectType', v)}
                  placeholder="Ex: téléphone, clés…"
                />
              )}
              <ChipRow
                label="Nature"
                value={str(details, 'packageNature')}
                onChange={(id) => set(details, onChange, 'packageNature', id)}
                required
                options={[
                  { id: 'standard', label: 'Standard' },
                  { id: 'fragile', label: 'Fragile' },
                  { id: 'liquide', label: 'Liquide' },
                  { id: 'alimentaire', label: 'Alimentaire' },
                  { id: 'valeur', label: 'Valeur' },
                ]}
              />
              <View style={styles.row2}>
                <View style={styles.rowCol}>
                  <Field
                    label="Poids estimé"
                    value={str(details, 'weight')}
                    onChangeText={(v) => onChange({ ...details, weight: v, sharedWeight: v })}
                    placeholder="Ex: 2 kg"
                    required
                  />
                </View>
                <View style={styles.rowCol}>
                  <Field
                    label="Valeur estimée (FCFA)"
                    value={str(details, 'sharedEstimatedValue')}
                    onChangeText={(v) => set(details, onChange, 'sharedEstimatedValue', v)}
                    placeholder="Ex: 25000"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Disclosure title="Ajouter des precisions">
                <Field label="Dimensions" value={str(details, 'dimensions')} onChangeText={(v) => set(details, onChange, 'dimensions', v)} placeholder="Ex: 30x20x10 cm" />
                <ChipRow
                  label="Emballage"
                  value={str(details, 'packagingType')}
                  onChange={(id) => set(details, onChange, 'packagingType', id)}
                  options={[
                    { id: 'carton', label: 'Carton' },
                    { id: 'sac', label: 'Sac' },
                    { id: 'enveloppe', label: 'Enveloppe' },
                    { id: 'autre', label: 'Autre' },
                  ]}
                />
                <Toggle label="Assurance souhaitee" value={!!details.insuranceRequested} onChange={(v) => set(details, onChange, 'insuranceRequested', v)} />
                <Field label="Instructions specifiques" value={str(details, 'instructions')} onChangeText={(v) => set(details, onChange, 'instructions', v)} placeholder="Exigences propres au colis" multiline />
              </Disclosure>
            </>
          )}

          {audience === 'particulier' && need === 'courses_list' && (
            <>
              <Field label="Nom du magasin" value={str(details, 'storeName')} onChangeText={(v) => set(details, onChange, 'storeName', v)} placeholder="Ex: Auchan, pharmacie…" required />
              <Field label="Liste des produits" value={str(details, 'productList')} onChangeText={(v) => set(details, onChange, 'productList', v)} placeholder="Un produit par ligne" multiline required />
              <Disclosure title="Ajouter des precisions">
                <Field label="Quantite" value={str(details, 'quantity')} onChangeText={(v) => set(details, onChange, 'quantity', v)} placeholder="Ex: 5 articles" />
                <Field label="Marques / preferences" value={str(details, 'brandPreferences')} onChangeText={(v) => set(details, onChange, 'brandPreferences', v)} placeholder="Ex: marque X, bio..." />
                <Field label="Budget maximum (FCFA)" value={str(details, 'maxBudget')} onChangeText={(v) => set(details, onChange, 'maxBudget', v)} placeholder="Ex: 25000" keyboardType="numeric" />
                <Toggle label="Substitution autorisee" value={!!details.replacementAllowed} onChange={(v) => set(details, onChange, 'replacementAllowed', v)} />
                <Field label="Horaires / creneau magasin" value={str(details, 'storeHours')} onChangeText={(v) => set(details, onChange, 'storeHours', v)} placeholder="Ex: ouvert jusqu'a 20h" />
                <Field label="Instructions" value={str(details, 'instructions')} onChangeText={(v) => set(details, onChange, 'instructions', v)} placeholder="Consignes propres aux courses" multiline />
              </Disclosure>
            </>
          )}

          {audience === 'particulier' && need === 'bill_payment' && (
            <>
              <View style={styles.infoPanel}>
                <Ionicons name="receipt-outline" size={16} color={Colors.warning} />
                <Text style={styles.infoPanelText}>
                  Le prestataire paiera sur place puis devra joindre la preuve de facture au moment de clôturer la mission.
                </Text>
              </View>
              <Field label="Organisme / commerçant" value={str(details, 'billerName')} onChangeText={(v) => set(details, onChange, 'billerName', v)} placeholder="Ex: Senelec, Sonatel, boutique..." required />
              <Field label="Référence facture / abonnement" value={str(details, 'billReference')} onChangeText={(v) => set(details, onChange, 'billReference', v)} placeholder="Numéro client, compteur, référence..." required />
              <Field label="Montant à payer (FCFA)" value={str(details, 'billAmount')} onChangeText={(v) => set(details, onChange, 'billAmount', v)} placeholder="Ex: 18500" keyboardType="numeric" required />
              <Disclosure title="Ajouter des precisions">
                <Field label="Objet de la facture" value={str(details, 'billPurpose')} onChangeText={(v) => set(details, onChange, 'billPurpose', v)} placeholder="Ex: electricite, eau, internet..." />
                <Field label="Adresse / point de paiement" value={str(details, 'billPaymentLocation')} onChangeText={(v) => set(details, onChange, 'billPaymentLocation', v)} placeholder="Lieu du reglement ou agence concernee" />
                <Field label="Instructions" value={str(details, 'instructions')} onChangeText={(v) => set(details, onChange, 'instructions', v)} placeholder="Consignes propres au paiement de facture" multiline />
              </Disclosure>
            </>
          )}

          {audience === 'particulier' && need === 'document_transport' && (
            <>
              <Field label="Nature des documents" value={str(details, 'documentType')} onChangeText={(v) => set(details, onChange, 'documentType', v)} placeholder="Ex: contrat, pièce d'identité…" required />
              <Field label="Nombre de documents" value={str(details, 'documentCount')} onChangeText={(v) => set(details, onChange, 'documentCount', v)} placeholder="Ex: 3" keyboardType="numeric" required />
              <Disclosure title="Ajouter des precisions">
                <Toggle label="Originaux" value={!!details.areOriginals} onChange={(v) => set(details, onChange, 'areOriginals', v)} />
                <Toggle label="Documents confidentiels" value={!!details.isConfidential} onChange={(v) => set(details, onChange, 'isConfidential', v)} />
                <Toggle label="Enveloppe scellee" value={!!details.sealedEnvelope} onChange={(v) => set(details, onChange, 'sealedEnvelope', v)} />
                <Field label="Delai / echeance" value={str(details, 'deadline')} onChangeText={(v) => set(details, onChange, 'deadline', v)} placeholder="Ex: avant 17h" />
                <Field label="Instructions" value={str(details, 'instructions')} onChangeText={(v) => set(details, onChange, 'instructions', v)} placeholder="Consignes propres aux documents" multiline />
              </Disclosure>
            </>
          )}

          {audience === 'professionnel' && activeProFlow === 'marchandises' && (
            <>
              <Field label="Nature des marchandises" value={str(details, 'merchandiseType')} onChangeText={(v) => set(details, onChange, 'merchandiseType', v)} placeholder="Ex: sacs de riz, meubles…" required />
              <Field label="Nombre de colis" value={str(details, 'packageCount')} onChangeText={(v) => set(details, onChange, 'packageCount', v)} placeholder="Ex: 10" keyboardType="numeric" required />
              <Field label="Poids total estimé" value={str(details, 'sharedWeight') || str(details, 'weight')} onChangeText={(v) => onChange({ ...details, sharedWeight: v, weight: v })} placeholder="Ex: 120 kg" required />
              {recommendedVehicle && (
                <View style={styles.infoPanel}>
                  <Ionicons name="car-sport-outline" size={16} color={Colors.info} />
                  <Text style={styles.infoPanelText}>
                    Véhicule recommandé : {recommendedVehicle.label} ({recommendedVehicle.hint}).
                  </Text>
                </View>
              )}
              <Disclosure title="Ajuster le vehicule et l'acces">
                <Field label="Dimensions" value={str(details, 'dimensions')} onChangeText={(v) => set(details, onChange, 'dimensions', v)} placeholder="Ex: 1m x 50cm" />
                <ChipRow
                  label="Type de vehicule"
                  value={str(details, 'vehicleNeeded')}
                  onChange={(id) => set(details, onChange, 'vehicleNeeded', id)}
                  required
                  options={[
                    { id: 'moto', label: 'Moto' },
                    { id: 'voiture', label: 'Voiture' },
                    { id: 'camionnette', label: 'Camionnette' },
                    { id: 'camion', label: 'Camion' },
                  ]}
                />
                <Field label="Etage / acces" value={str(details, 'floorAccess')} onChangeText={(v) => set(details, onChange, 'floorAccess', v)} placeholder="Ex: 3e etage" />
                <Toggle label="Chargement / dechargement requis" value={!!details.needsLoadingHelp} onChange={(v) => set(details, onChange, 'needsLoadingHelp', v)} />
              </Disclosure>
            </>
          )}

          {audience === 'professionnel' && activeProFlow === 'livraison_entreprise' && (
            <>
              <Field label="Nom de l'entreprise" value={str(details, 'businessName')} onChangeText={(v) => set(details, onChange, 'businessName', v)} placeholder="Raison sociale" required />
              <Field label="Nom du responsable" value={str(details, 'managerName')} onChangeText={(v) => set(details, onChange, 'managerName', v)} placeholder="Contact entreprise" required />
              <Field label="Téléphone" value={str(details, 'managerPhone')} onChangeText={(v) => set(details, onChange, 'managerPhone', v)} placeholder="+221 …" keyboardType="phone-pad" required />
              <Field label="Nombre de livraisons" value={str(details, 'deliveryCount')} onChangeText={(v) => set(details, onChange, 'deliveryCount', v)} placeholder="Ex: 5" keyboardType="numeric" required />
              <Field label="Liste des destinataires" value={str(details, 'recipientsList')} onChangeText={(v) => set(details, onChange, 'recipientsList', v)} placeholder="Nom / adresse / téléphone par ligne" multiline />
              <Field label="Créneau de livraison" value={str(details, 'deliveryTimeWindow')} onChangeText={(v) => set(details, onChange, 'deliveryTimeWindow', v)} placeholder="Ex: 9h–12h" />
            </>
          )}

          {audience === 'professionnel' && activeProFlow === 'collecte_marchandises' && (
            <>
              <Field label="Objet à collecter" value={str(details, 'objectToCollect')} onChangeText={(v) => set(details, onChange, 'objectToCollect', v)} placeholder="Que faut-il collecter ?" required />
              <Field label="Nombre d'objets" value={str(details, 'objectCount')} onChangeText={(v) => set(details, onChange, 'objectCount', v)} placeholder="Ex: 2" keyboardType="numeric" />
              <Field label="Nom du vendeur / contact" value={str(details, 'sellerName')} onChangeText={(v) => set(details, onChange, 'sellerName', v)} placeholder="Personne sur place" />
              <Field label="Téléphone du contact" value={str(details, 'sellerPhone')} onChangeText={(v) => set(details, onChange, 'sellerPhone', v)} placeholder="+221 …" keyboardType="phone-pad" />
              <Toggle label="Paiement sur place" value={!!details.payOnSite} onChange={(v) => set(details, onChange, 'payOnSite', v)} />
              <Field label="Montant à récupérer (FCFA)" value={str(details, 'amountToCollect')} onChangeText={(v) => set(details, onChange, 'amountToCollect', v)} placeholder="Ex: 10000" keyboardType="numeric" />
              <Field label="Instructions" value={str(details, 'instructions')} onChangeText={(v) => set(details, onChange, 'instructions', v)} placeholder="Consignes de collecte" multiline />
            </>
          )}
        </>
      )}

      {(serviceType === 'courses' || serviceType === 'pro' || serviceType === 'documents' || serviceType === 'marchandises' || serviceType === 'livraison_entreprise' || serviceType === 'collecte_marchandises' || serviceType === 'objets_personnels') && (
        <>
          <View style={styles.infoPanel}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
            <Text style={styles.infoPanelText}>
              Ce parcours est regroupé dans « Collecte & Livraison ». Revenez en arrière et choisissez Collecte & Livraison.
            </Text>
          </View>
        </>
      )}

      {serviceType === 'depot_administratif' && renderAdminProcedureForm()}
    </View>
  );
}

/** Validation minimale des champs requis selon le service. */
export function validateServiceDetails(serviceType: string, details: ServiceDetails): string | null {
  if (serviceType === 'colis') {
    if (missionAudience(details) === 'professionnel') {
      if (!str(details, 'proFlow')) return 'Choisissez le type de mission pro';
      return validateServiceDetails(String(details.proFlow), details);
    }
    const need = colisNeed(details);
    if (need === 'courses_list' || need === 'bill_payment') {
      return validateServiceDetails('courses', {
        ...details,
        courseMode: need === 'bill_payment' ? 'bill_payment' : 'simple',
      });
    }
    if (need === 'document_transport') {
      return req(details, 'documentType', 'Indiquez la nature des documents')
        || req(details, 'documentCount', 'Indiquez le nombre de documents');
    }
    return req(details, 'packageContent', 'Indiquez le contenu')
      || req(details, 'packageNature', 'Indiquez la nature du colis')
      || req(details, 'weight', 'Indiquez le poids estimé');
  }
  if (serviceType === 'pro') {
    if (!str(details, 'proFlow')) return 'Choisissez le type de mission pro';
    return validateServiceDetails(String(details.proFlow), details);
  }

  const resolved = validationServiceType(serviceType, details);
  switch (resolved) {
    case 'documents':
      if ((str(details, 'documentFlow') || 'have_document') === 'administrative_process') {
        return req(details, 'procedureType', 'Sélectionnez le type de démarche')
          || req(details, 'missionGoal', 'Indiquez la mission')
          || (str(details, 'missionGoal') === 'autre'
            ? req(details, 'missionGoalOther', 'Précisez la mission')
            : null);
      }
      return req(details, 'documentType', 'Indiquez la nature des documents')
        || req(details, 'documentCount', 'Indiquez le nombre de documents');
    case 'courses':
      if ((str(details, 'courseMode') || 'simple') === 'bill_payment') {
        return req(details, 'billerName', "Indiquez l'organisme ou le commerçant")
          || req(details, 'billReference', 'Indiquez la référence de facture')
          || req(details, 'billAmount', 'Indiquez le montant à payer');
      }
      return req(details, 'storeName', 'Indiquez le nom du magasin')
        || req(details, 'productList', 'Ajoutez la liste des produits');
    case 'marchandises':
      return req(details, 'merchandiseType', 'Indiquez la nature des marchandises')
        || req(details, 'packageCount', 'Indiquez le nombre de colis')
        || (!(str(details, 'sharedWeight') || str(details, 'weight')).trim()
          ? 'Indiquez le poids total estimé'
          : null)
        || req(details, 'vehicleNeeded', 'Choisissez le type de véhicule');
    case 'livraison_entreprise':
      return req(details, 'businessName', "Indiquez le nom de l'entreprise")
        || req(details, 'managerName', 'Indiquez le nom du responsable')
        || req(details, 'managerPhone', 'Indiquez le téléphone du responsable')
        || req(details, 'deliveryCount', 'Indiquez le nombre de livraisons');
    case 'collecte_marchandises':
      return req(details, 'objectToCollect', "Indiquez l'objet à collecter");
    case 'depot_administratif':
      return req(details, 'procedureType', 'Sélectionnez le type de démarche')
        || req(details, 'missionGoal', 'Indiquez la mission')
        || (str(details, 'missionGoal') === 'autre'
          ? req(details, 'missionGoalOther', 'Précisez la mission')
          : null);
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: { marginTop: 0, marginBottom: 0 },
  commonCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  commonTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  commonSubtitle: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 4,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.md,
  },
  audienceTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  audienceCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    minHeight: 120,
  },
  audienceCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  audienceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  audienceIconOn: {
    backgroundColor: Colors.primary,
  },
  audienceLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  audienceLabelOn: {
    color: Colors.primary,
  },
  audienceDesc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 4,
    lineHeight: 16,
  },
  audienceCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  subSectionTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  needGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  needCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 4,
  },
  needCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  needLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    marginTop: 2,
  },
  needLabelOn: {
    color: Colors.primary,
  },
  needDesc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    lineHeight: 15,
  },
  field: { marginBottom: Spacing.md },
  row2: { flexDirection: 'row', gap: Spacing.md },
  rowCol: { flex: 1 },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.md,
    padding: Spacing.base,
    backgroundColor: Colors.infoSoft,
    borderRadius: BorderRadius.md,
  },
  infoPanelText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray700,
  },
  disclosureWrap: {
    marginTop: 2,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray50,
    overflow: 'hidden',
  },
  disclosureBtn: {
    minHeight: 46,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  disclosureTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  disclosureBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  label: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  textArea: { alignItems: 'flex-start', paddingVertical: Spacing.sm, minHeight: 96 },
  input: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    paddingVertical: 12,
  },
  textAreaInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
  },
  chipTextActive: { color: Colors.primary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  toggleLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray700,
    flex: 1,
  },
  hintMuted: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },
  procedureGroup: { marginBottom: Spacing.md },
  procedureGroupTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  procedureChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: 8,
  },
  procedureChoiceOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  procedureChoiceName: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  procedureChoiceNameOn: { color: Colors.primary },
  procedureChoiceOrg: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  procedureRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray300,
  },
  procedureCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  procedureCheckOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  docsHero: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  docsHeroTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  docsHeroSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    marginTop: 6,
    lineHeight: 20,
  },
  docsCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  docsCountText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  selChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selChipText: {
    flexShrink: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    paddingVertical: 10,
  },
  procedureSummary: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  procedureSummaryLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  procedureSummaryValue: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginTop: 4,
  },
  procedureSummaryHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray600,
    marginTop: 6,
    lineHeight: 16,
  },
  procedureBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  procedureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  procedureBadgeDelay: { backgroundColor: Colors.infoSoft },
  procedureBadgeText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.warning,
  },
});
