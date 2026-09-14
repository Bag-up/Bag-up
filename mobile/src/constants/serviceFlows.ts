import type { ServiceDetails } from '../components/ServiceDetailsFields';

export type MissionAudience = 'particulier' | 'professionnel';
export type ColisNeed = 'colis' | 'objet' | 'courses_list' | 'bill_payment' | 'document_transport';
export type ProFlow = 'livraison_entreprise' | 'collecte_marchandises' | 'marchandises';

export const PARTICULIER_NEED_OPTIONS: { id: ColisNeed; label: string; desc: string; icon: string }[] = [
  { id: 'colis', label: 'Colis', desc: 'Envoi classique A → B', icon: 'cube-outline' },
  { id: 'objet', label: 'Objet personnel', desc: 'Clés, téléphone, sac…', icon: 'briefcase-outline' },
  { id: 'document_transport', label: 'Document', desc: 'Contrat, dossier à transporter', icon: 'document-text-outline' },
  { id: 'courses_list', label: 'Liste de courses', desc: 'Magasin + produits + budget', icon: 'cart-outline' },
  { id: 'bill_payment', label: 'Paiement facture', desc: 'Senelec, Sonatel…', icon: 'receipt-outline' },
];

export const PRO_FLOW_OPTIONS: { id: ProFlow; label: string; desc: string; icon: string }[] = [
  { id: 'livraison_entreprise', label: 'Livraison entreprise', desc: 'Livrer chez vos clients', icon: 'storefront-outline' },
  { id: 'collecte_marchandises', label: 'Collecte marchandises', desc: 'Aller chercher du stock', icon: 'download-outline' },
  { id: 'marchandises', label: 'Transport marchandises', desc: 'Volumes B2B, palettes…', icon: 'cube-outline' },
];

/** @deprecated use PARTICULIER_NEED_OPTIONS */
export const COLIS_NEED_OPTIONS = PARTICULIER_NEED_OPTIONS.filter((o) => o.id !== 'document_transport');

export function missionAudience(details: ServiceDetails): MissionAudience {
  if (details.missionAudience === 'professionnel' || details.proFlow) return 'professionnel';
  return 'particulier';
}

export function colisNeed(details: ServiceDetails): ColisNeed {
  if (missionAudience(details) === 'professionnel') {
    return 'colis';
  }
  const raw = String(details.colisNeed || details.shipmentKind || 'colis');
  if (raw === 'objet') return 'objet';
  if (raw === 'document_transport') return 'document_transport';
  if (raw === 'courses_list') return 'courses_list';
  if (raw === 'bill_payment') return 'bill_payment';
  return 'colis';
}

export function proFlow(details: ServiceDetails): ProFlow {
  return (details.proFlow as ProFlow) || 'livraison_entreprise';
}

/** serviceType API réel envoyé au backend. */
export function resolveApiServiceType(uiServiceType: string, details: ServiceDetails): string {
  if (uiServiceType === 'depot_administratif') return 'depot_administratif';
  if (uiServiceType === 'documents') {
    if (details.documentFlow === 'administrative_process') return 'depot_administratif';
    return 'documents';
  }
  if (uiServiceType === 'pro') {
    return proFlow(details);
  }
  if (uiServiceType === 'colis') {
    if (missionAudience(details) === 'professionnel') {
      return proFlow(details);
    }
    const need = colisNeed(details);
    if (need === 'document_transport') return 'documents';
    if (need === 'courses_list' || need === 'bill_payment') return 'courses';
    return 'colis';
  }
  return uiServiceType;
}

export function validationServiceType(uiServiceType: string, details: ServiceDetails): string {
  return resolveApiServiceType(uiServiceType, details);
}

export function usesLateRouteFields(uiServiceType: string, details: ServiceDetails): boolean {
  if (uiServiceType === 'colis' || uiServiceType === 'pro' || uiServiceType === 'depot_administratif') return true;
  if (uiServiceType === 'documents' && details.documentFlow === 'administrative_process') return true;
  if (uiServiceType === 'courses') return true;
  return false;
}

export function normalizeInitialServiceType(initial?: string): {
  uiServiceType: string;
  detailsSeed: ServiceDetails;
} {
  if (!initial) return { uiServiceType: '', detailsSeed: {} };
  if (initial === 'objets_personnels') {
    return {
      uiServiceType: 'colis',
      detailsSeed: { missionAudience: 'particulier', colisNeed: 'objet', shipmentKind: 'objet' },
    };
  }
  if (initial === 'courses') {
    return {
      uiServiceType: 'colis',
      detailsSeed: { missionAudience: 'particulier', colisNeed: 'courses_list', courseMode: 'simple' },
    };
  }
  if (initial === 'documents') {
    return {
      uiServiceType: 'colis',
      detailsSeed: {
        missionAudience: 'particulier',
        colisNeed: 'document_transport',
        documentFlow: 'have_document',
      },
    };
  }
  if (initial === 'pro' || initial === 'livraison_entreprise' || initial === 'collecte_marchandises' || initial === 'marchandises') {
    const flow = initial === 'pro' ? 'livraison_entreprise' : initial;
    return {
      uiServiceType: 'colis',
      detailsSeed: { missionAudience: 'professionnel', proFlow: flow as ProFlow },
    };
  }
  if (initial === 'administratif') {
    return { uiServiceType: 'depot_administratif', detailsSeed: {} };
  }
  if (initial === 'colis') {
    return { uiServiceType: 'colis', detailsSeed: defaultDetailsForUiService('colis') };
  }
  return { uiServiceType: initial, detailsSeed: {} };
}

export function serviceDisplayLabel(serviceType: string, details?: ServiceDetails | null): string {
  const d = details || {};
  if (serviceType === 'colis' && d) {
    if (missionAudience(d) === 'professionnel') {
      const pf = proFlow(d);
      const opt = PRO_FLOW_OPTIONS.find((o) => o.id === pf);
      return opt?.label || 'Mission pro';
    }
    const need = colisNeed(d);
    const opt = PARTICULIER_NEED_OPTIONS.find((o) => o.id === need);
    return opt?.label || 'Colis';
  }
  const labels: Record<string, string> = {
    colis: 'Collecte & Livraison',
    documents: 'Document',
    courses: 'Liste de courses',
    marchandises: 'Transport marchandises',
    depot_administratif: 'Démarches',
    livraison_entreprise: 'Livraison entreprise',
    collecte_marchandises: 'Collecte marchandises',
    pro: 'Collecte & Livraison pro',
  };
  return labels[serviceType] || serviceType;
}

export function enrichServiceDetailsForApi(uiServiceType: string, details: ServiceDetails): ServiceDetails {
  const next = { ...details };
  if (uiServiceType === 'colis') {
    if (missionAudience(details) === 'professionnel') {
      next.missionAudience = 'professionnel';
      if (!next.proFlow) next.proFlow = 'livraison_entreprise';
    } else {
      next.missionAudience = 'particulier';
      const need = colisNeed(details);
      next.colisNeed = need;
      if (need === 'courses_list') next.courseMode = 'simple';
      if (need === 'bill_payment') next.courseMode = 'bill_payment';
      if (need === 'objet') next.shipmentKind = 'objet';
      if (need === 'colis') next.shipmentKind = 'colis';
      if (need === 'document_transport') {
        next.documentFlow = 'have_document';
      }
    }
  }
  return next;
}

export function defaultDetailsForUiService(uiServiceType: string): ServiceDetails {
  if (uiServiceType === 'colis') {
    return { missionAudience: 'particulier', colisNeed: 'colis', shipmentKind: 'colis' };
  }
  return {};
}

export function defaultNeedForAudience(audience: MissionAudience): Partial<ServiceDetails> {
  if (audience === 'professionnel') {
    return { missionAudience: 'professionnel', proFlow: 'livraison_entreprise', colisNeed: undefined };
  }
  return { missionAudience: 'particulier', colisNeed: 'colis', shipmentKind: 'colis', proFlow: undefined };
}
