import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatFormulaLabel } from '../../constants/formulas';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getCurrentPosition } from '../../services/location';
import { routing, LatLng } from '../../services/routing';
import { DriverVehicleCard } from '../../components/DriverVehicleCard';
import { SUPPORT_TEL_URL } from '../../constants/support';

const deliveryFlow = [
  { key: 'pending', label: 'Demande créée', icon: 'document-text-outline' as const },
  { key: 'accepted', label: 'Demande acceptée', icon: 'checkmark-circle-outline' as const },
  { key: 'en_route', label: 'Prestataire en route', icon: 'navigate-outline' as const },
  { key: 'picked_up', label: 'Colis récupéré', icon: 'cube-outline' as const },
  { key: 'in_progress', label: 'En cours de livraison', icon: 'bicycle-outline' as const },
  { key: 'delivered', label: 'Livré', icon: 'checkmark-done-circle-outline' as const },
];

const adminFlow = [
  { key: 'pending', label: 'Demande créée', icon: 'document-text-outline' as const },
  { key: 'accepted', label: 'Mission acceptée', icon: 'checkmark-circle-outline' as const },
  { key: 'dossier_deposed', label: 'Dossier déposé', icon: 'business-outline' as const },
  { key: 'admin_processing', label: 'En attente de traitement', icon: 'time-outline' as const },
  { key: 'document_ready', label: 'Document disponible', icon: 'document-text-outline' as const },
  { key: 'document_collected', label: 'Document retiré', icon: 'download-outline' as const },
  { key: 'returned_to_client', label: 'Restitué au client', icon: 'checkmark-done-circle-outline' as const },
];

// Fallback pour les missions admin qui auraient un statut de livraison (données incorrectes)
const adminFallbackFlow = [
  ...adminFlow.slice(0, 2),
  { key: 'in_progress', label: 'En cours de traitement', icon: 'time-outline' as const },
  ...adminFlow.slice(4),
];

const cancelledEntry = { key: 'cancelled', label: 'Mission annulée', icon: 'close-circle-outline' as const };

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  en_route: 'En route',
  picked_up: 'Récupérée',
  in_progress: 'En cours',
  delivered: 'Terminée',
  cancelled: 'Annulée',
  dossier_deposed: 'Dossier déposé',
  admin_processing: 'En attente admin',
  document_ready: 'Document prêt',
  document_collected: 'Document retiré',
  returned_to_client: 'Restitué',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning },
  accepted: { bg: withAlpha(Colors.info, 0.12), text: Colors.info },
  picked_up: { bg: withAlpha(Colors.info, 0.12), text: Colors.info },
  in_progress: { bg: withAlpha(Colors.primary, 0.12), text: Colors.primary },
  delivered: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
  cancelled: { bg: withAlpha(Colors.accent, 0.12), text: Colors.accent },
  dossier_deposed: { bg: withAlpha(Colors.info, 0.12), text: Colors.info },
  admin_processing: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning },
  document_ready: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
  document_collected: { bg: withAlpha(Colors.info, 0.12), text: Colors.info },
  returned_to_client: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
};

const urgencyColors: Record<string, { bg: string; text: string }> = {
  groupe: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
  standard: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
  normal: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
  urgent: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning },
  express: { bg: withAlpha(Colors.accent, 0.12), text: Colors.accent },
  programme: { bg: withAlpha(Colors.info, 0.12), text: Colors.info },
  prioritaire: { bg: withAlpha(Colors.success, 0.12), text: Colors.success },
};

const serviceLabels: Record<string, string> = {
  colis: 'Collecte & Livraison',
  documents: 'Documents',
  courses: 'Liste de courses',
  marchandises: 'Transport marchandises',
  depot_administratif: 'Démarches administratives',
  administratif: 'Démarches administratives',
  livraison_entreprise: 'Livraison entreprise',
  collecte_marchandises: 'Collecte marchandises',
  pro: 'Collecte & Livraison pro',
};

const serviceIcons: Record<string, string> = {
  colis: 'cube-outline',
  documents: 'document-text-outline',
  courses: 'cart-outline',
  marchandises: 'cube-outline',
  depot_administratif: 'business-outline',
  administratif: 'business-outline',
};

const HIDDEN_DETAIL_KEYS = new Set([
  'pickupAccessInstructions',
  'deliveryAccessInstructions',
  'pickupFloor',
  'pickupContactName',
  'pickupContactPhone',
  'pickupContactPhone2',
  'deliveryContactName',
  'deliveryContactPhone',
  'deliveryContactPhone2',
  'timingMode',
  'urgencyLevel',
  'vehicleOverride',
]);

const DETAIL_LABELS: Record<string, string> = {
  packageType: 'Type de colis',
  shipmentKind: "Type d'envoi",
  packageContent: 'Contenu',
  packageNature: 'Nature',
  sharedDescription: 'À transporter',
  sharedWeight: 'Poids',
  sharedEstimatedValue: 'Valeur estimée',
  sharedFragile: 'Fragile',
  sharedRequiresSignature: 'Confirmation de remise',
  sharedInstructions: 'Précisions',
  weightDimensions: 'Poids / dimensions',
  instructions: 'Précisions',
  documentType: 'Documents',
  documentCount: 'Quantité',
  documentMission: 'Mission',
  confidentiality: 'Confidentialité',
  storeType: 'Magasin',
  storeName: 'Magasin',
  courseMode: 'Mode',
  productList: 'Achats',
  maxBudget: 'Budget max',
  replacementAllowed: 'Substitution',
  merchandiseType: 'Marchandise',
  packageCount: 'Nombre de colis',
  quantity: 'Quantité',
  weight: 'Poids',
  vehicleNeeded: 'Véhicule',
  objectType: "Type d'objet",
  estimatedValue: 'Valeur estimée',
  documentsToProvide: 'Documents à fournir',
  documentsGiven: 'Documents remis',
  documentsToCollect: 'Documents à récupérer',
  businessName: 'Commerce',
  deliveryCount: 'Nb livraisons',
  clientAddresses: 'Adresses clients',
  recipientsList: 'Destinataires',
  deliveryTimeWindow: 'Créneau de livraison',
  collectAmounts: 'Montants à encaisser',
  invoiceRequired: 'Facture / bon requis',
  returnUnsold: 'Retour des invendus',
  electronicSignature: 'Signature électronique',
  schedule: 'Horaire',
  objectToCollect: 'Objet à collecter',
  objectCount: "Nombre d'objets",
  sellerName: 'Contact sur place',
  sellerPhone: 'Téléphone du contact',
  payOnSite: 'Paiement sur place',
  amountToCollect: 'Montant à récupérer',
  documentFlow: 'Besoin',
  missionGoal: 'Mission',
  missionGoalOther: 'Précision mission',
  billerName: 'Organisme',
  billReference: 'Référence facture',
  billAmount: 'Montant facture',
  billPurpose: 'Objet facture',
  organism: 'Organisme',
  procedureType: 'Démarche',
  applicantName: 'Nom du demandeur',
  applicantPhone: 'Téléphone',
  fileNumber: 'Numéro de dossier',
  feesToAdvance: 'Frais à avancer',
  appointmentRequired: 'Rendez-vous requis',
  authorization: 'Autorisation',
};

function humanizeDetailKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

const DETAIL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  shipmentKind: 'layers-outline',
  packageContent: 'cube-outline',
  packageNature: 'leaf-outline',
  sharedDescription: 'briefcase-outline',
  sharedWeight: 'scale-outline',
  weight: 'scale-outline',
  sharedEstimatedValue: 'cash-outline',
  estimatedValue: 'cash-outline',
  documentType: 'document-text-outline',
  documentCount: 'copy-outline',
  documentFlow: 'git-branch-outline',
  courseMode: 'cart-outline',
  storeName: 'storefront-outline',
  productList: 'list-outline',
  merchandiseType: 'cube-outline',
  packageCount: 'albums-outline',
  vehicleNeeded: 'car-sport-outline',
  missionGoal: 'flag-outline',
  billAmount: 'receipt-outline',
  billReference: 'barcode-outline',
  sharedFragile: 'warning-outline',
  sharedRequiresSignature: 'create-outline',
};

const PRETTY_DETAIL_VALUES: Record<string, Record<string, string>> = {
  documentFlow: {
    have_document: "J'ai le document",
    administrative_process: "Bag'up fait la démarche",
  },
  shipmentKind: {
    colis: 'Colis',
    objet: 'Objet',
  },
  courseMode: {
    simple: 'Course simple',
    bill_payment: 'Paiement facture',
  },
  missionGoal: {
    deposer: 'Déposer',
    recuperer: 'Récupérer',
    suivre: 'Suivre',
    autre: 'Autre',
  },
  packageNature: {
    standard: 'Standard',
    fragile: 'Fragile',
    liquide: 'Liquide',
    alimentaire: 'Alimentaire',
    valeur: 'Valeur',
  },
  vehicleNeeded: {
    moto: 'Moto',
    voiture: 'Voiture',
    camionnette: 'Camionnette',
    camion: 'Camion',
  },
};

const DETAIL_ORDER = [
  'documentFlow',
  'courseMode',
  'shipmentKind',
  'packageContent',
  'sharedDescription',
  'packageNature',
  'documentType',
  'documentCount',
  'merchandiseType',
  'storeName',
  'productList',
  'weight',
  'sharedWeight',
  'packageCount',
  'quantity',
  'sharedEstimatedValue',
  'estimatedValue',
  'maxBudget',
  'billAmount',
  'billReference',
  'vehicleNeeded',
  'documentFlow',
  'missionGoal',
  'missionGoalOther',
  'sharedFragile',
  'sharedRequiresSignature',
  'instructions',
  'sharedInstructions',
];

function formatDetailValue(key: string, value: unknown): string {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  if (typeof value === 'string' && PRETTY_DETAIL_VALUES[key]?.[value]) {
    return PRETTY_DETAIL_VALUES[key][value];
  }
  if ((key === 'sharedEstimatedValue' || key === 'estimatedValue' || key === 'maxBudget' || key === 'billAmount' || key === 'feesToAdvance' || key === 'amountToCollect' || key === 'collectAmounts') && value != null) {
    const amount = Number(String(value).replace(/[^\d]/g, ''));
    if (Number.isFinite(amount) && amount > 0) return `${amount.toLocaleString('fr-FR')} FCFA`;
  }
  return String(value);
}

function buildDetailEntries(details: Record<string, unknown>) {
  let entries = Object.entries(details).filter(
    ([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && value !== undefined && value !== '' && value !== false,
  );

  const keys = new Set(entries.map(([key]) => key));
  if (keys.has('weight') && keys.has('sharedWeight')) {
    entries = entries.filter(([key]) => key !== 'sharedWeight');
  }
  if (keys.has('packageContent') && keys.has('sharedDescription')) {
    entries = entries.filter(([key]) => key !== 'sharedDescription');
  }
  if (keys.has('estimatedValue') && keys.has('sharedEstimatedValue')) {
    entries = entries.filter(([key]) => key !== 'sharedEstimatedValue');
  }
  if (keys.has('instructions') && keys.has('sharedInstructions')) {
    entries = entries.filter(([key]) => key !== 'sharedInstructions');
  }

  return entries
    .sort((a, b) => {
      const ai = DETAIL_ORDER.indexOf(a[0]);
      const bi = DETAIL_ORDER.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .slice(0, 12);
}

function isWideDetail(key: string, value: unknown) {
  if (typeof value !== 'string') return false;
  return value.length > 42 || ['productList', 'instructions', 'sharedInstructions', 'documentsGiven', 'documentsToCollect'].includes(key);
}

interface Props { onBack: () => void; missionId?: string; navigation?: any; }

export const TrackingScreen: React.FC<Props> = ({ onBack, missionId, navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [mission, setMission] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const mapRef = useRef<any>(null);
  const hasFittedRef = useRef(false);

  const fetchMission = useCallback(async () => {
    if (!missionId || !token) return;
    try {
      const data = await api.missions.byId(missionId, token);
      if (!data) return;
      setMission(data);
      if (data.pickupLat && data.pickupLng) {
        setPickupCoords({ lat: parseFloat(data.pickupLat), lng: parseFloat(data.pickupLng) });
      }
      if (data.deliveryLat && data.deliveryLng) {
        setDeliveryCoords({ lat: parseFloat(data.deliveryLat), lng: parseFloat(data.deliveryLng) });
      }
      // Fetch live provider location
      try {
        const locData = await api.missions.getLocation(missionId, token);
        if (locData?.providerLat && locData?.providerLng) {
          setProviderLocation({ lat: parseFloat(locData.providerLat), lng: parseFloat(locData.providerLng) });
        }
      } catch {}
      // Conserver l'état "déjà évalué" entre les visites de l'écran
      if (['delivered', 'returned_to_client'].includes(data.status)) {
        try {
          const myRatings = await api.ratings.mine(token);
          if (Array.isArray(myRatings) && myRatings.some((r: any) => r.mission?.id === missionId)) {
            setRatingSubmitted(true);
          }
        } catch {}
      }
    } catch (e) {
      console.error('fetchMission error:', e);
    }
  }, [missionId, token]);

  useFocusEffect(
    useCallback(() => {
      fetchMission();
      const interval = setInterval(fetchMission, 5000);
      return () => clearInterval(interval);
    }, [fetchMission])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMission();
    setRefreshing(false);
  }, [fetchMission]);

  const canCancel = mission && ['pending', 'accepted'].includes(mission.status);

  const handleOpenChat = async () => {
    if (!missionId || !token || !mission?.provider?.id) return;
    try {
      const conv = await api.messages.createConversation(
        { missionId, clientId: mission.clientId, providerId: mission.provider.id },
        token,
      );
      navigation?.navigate('Chat', { conversationId: conv.id, name: `${mission.provider.firstName} ${mission.provider.lastName || ''}` });
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'ouvrir la conversation');
    }
  };

  const handleCancel = () => {
    Alert.alert('Annuler la mission', 'Êtes-vous sûr de vouloir annuler cette mission ?', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
        if (!missionId || !token) return;
        setCancelling(true);
        try {
          await api.missions.cancel(missionId, token);
          Alert.alert('Mission annulée', 'Votre mission a été annulée avec succès.');
          fetchMission();
        } catch (e: any) {
          Alert.alert('Erreur', e.message || 'Annulation échouée');
        } finally {
          setCancelling(false);
        }
      } },
    ]);
  };

  const handleSubmitDispute = async () => {
    if (!disputeReason.trim() || !missionId || !token) return;
    setSubmittingDispute(true);
    try {
      await api.disputes.create({ missionId, reason: disputeReason.trim(), description: disputeDesc.trim() || undefined }, token);
      setDisputeOpen(false);
      setDisputeReason('');
      setDisputeDesc('');
      Alert.alert('Litige ouvert', 'Votre réclamation a été enregistrée. Notre équipe va l\'examiner.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Ouverture du litige échouée');
    } finally {
      setSubmittingDispute(false);
    }
  };

  useEffect(() => {
    if (mission && ['accepted', 'picked_up', 'in_progress'].includes(mission.status)) {
      // No more fake animation - real GPS updates come from polling
    }
  }, [mission?.status]);

  // Fit map only once when both pickup and delivery coordinates are known
  useEffect(() => {
    if (mapReady && !hasFittedRef.current && pickupCoords && deliveryCoords) {
      const coords = [
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng },
      ];
      if (providerLocation) coords.push({ latitude: providerLocation.lat, longitude: providerLocation.lng });
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
      hasFittedRef.current = true;
    }
  }, [mapReady, pickupCoords, deliveryCoords, providerLocation]);

  // Calcule l'itinéraire routier réel (OSRM) entre l'origine et la cible courante.
  const lastRouteKeyRef = useRef<string>('');
  useEffect(() => {
    if (!mission || !pickupCoords || !deliveryCoords) return;
    const isActive = ['accepted', 'picked_up', 'in_progress'].includes(mission.status);
    const enRouteToDelivery = mission.status === 'picked_up' || mission.status === 'in_progress';
    const origin = isActive && providerLocation ? providerLocation : pickupCoords;
    const target = enRouteToDelivery ? deliveryCoords : pickupCoords;

    // Évite de rappeler OSRM si l'origine n'a quasiment pas bougé (~30m de grille).
    const key = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}-${target.lat.toFixed(3)},${target.lng.toFixed(3)}`;
    if (key === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = key;

    const controller = new AbortController();
    routing
      .getRoute(origin, target, controller.signal)
      .then((route) => {
        if (route) {
          setRouteCoords(route.coordinates);
          setRouteDuration(route.durationSeconds);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mission?.status, providerLocation, pickupCoords, deliveryCoords]);

  const fitToMarkers = useCallback(() => {
    if (mapRef.current && pickupCoords && deliveryCoords) {
      const coords = [
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng },
      ];
      if (providerLocation) coords.push({ latitude: providerLocation.lat, longitude: providerLocation.lng });
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [pickupCoords, deliveryCoords, providerLocation]);

  const canRate = mission && ['delivered', 'returned_to_client'].includes(mission.status) && !ratingSubmitted && mission.provider?.id;

  const handleSubmitRating = async () => {
    if (rating === 0 || !missionId || !token) return;
    setSubmittingRating(true);
    try {
      await api.ratings.create({ missionId, score: rating, comment: ratingComment.trim() || undefined, ratedId: mission.provider?.id }, token);
      setRatingSubmitted(true);
      Alert.alert('Merci!', 'Votre évaluation a été enregistrée.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Évaluation échouée');
    } finally {
      setSubmittingRating(false);
    }
  };

  const isActiveAdmin = mission?.serviceType === 'depot_administratif' || mission?.serviceType === 'administratif';
  const isCancelled = mission?.status === 'cancelled';
  const isDone = ['delivered', 'returned_to_client'].includes(mission?.status);
  const baseFlow = isActiveAdmin ? adminFlow : deliveryFlow;
  const statusFlow = isCancelled
    ? [...baseFlow]
    : (isActiveAdmin && baseFlow.findIndex(s => s.key === mission?.status) === -1
      ? adminFallbackFlow
      : baseFlow);
  let currentIndex = mission ? statusFlow.findIndex(s => s.key === mission.status) : -1;
  // Si le statut est un statut final mais absent du flux (données incohérentes), on force 100%.
  if (currentIndex === -1 && isDone) currentIndex = statusFlow.length - 1;

  // Estimation du temps d'arrivée (ETA) à partir de la position du prestataire
  const etaMinutes = (() => {
    if (!providerLocation) return null;
    const enRouteToPickup = mission?.status === 'accepted' || mission?.status === 'en_route';
    const enRouteToDelivery = mission?.status === 'picked_up' || mission?.status === 'in_progress';
    const target = enRouteToPickup ? pickupCoords : enRouteToDelivery ? deliveryCoords : null;
    if (!target) return null;
    // Priorité à la durée routière réelle (OSRM) si disponible.
    if (routeDuration !== null && (enRouteToPickup || enRouteToDelivery)) {
      return Math.max(1, Math.round(routeDuration / 60));
    }
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(target.lat - providerLocation.lat);
    const dLng = toRad(target.lng - providerLocation.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(providerLocation.lat)) * Math.cos(toRad(target.lat)) * Math.sin(dLng / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const avgSpeedKmh = mission?.urgency === 'express' ? 30 : 22; // vitesse moyenne urbaine
    return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
  })();

  const detailEntries = mission?.serviceDetails && typeof mission.serviceDetails === 'object'
    ? buildDetailEntries(mission.serviceDetails as Record<string, unknown>)
    : [];

  const isCourseActive = mission && ['accepted', 'en_route', 'picked_up', 'in_progress'].includes(mission.status);
  const courseBannerText = isCancelled
    ? 'Cette mission a été annulée'
    : isDone
      ? (isActiveAdmin ? 'Votre démarche est terminée' : 'Votre course est terminée')
      : isCourseActive
        ? (isActiveAdmin ? 'Votre démarche est en cours !' : 'Votre course est en cours !')
        : (isActiveAdmin ? 'Votre démarche est enregistrée' : 'Votre course est enregistrée');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerBrand}>
          <View style={styles.headerMark}>
            <Text style={styles.headerMarkText}>B</Text>
          </View>
          <Text style={styles.headerTitle}>Suivi {isActiveAdmin ? 'démarche' : 'de livraison'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        {mission && (
          <View style={[styles.courseBanner, isCancelled && styles.courseBannerCancelled, isDone && styles.courseBannerDone, Shadows.sm]}>
            <View style={[styles.courseBannerIcon, isCancelled && styles.courseBannerIconCancelled]}>
              <Ionicons
                name={isCancelled ? 'close' : isDone ? 'checkmark' : 'bicycle'}
                size={22}
                color={isCancelled ? Colors.accent : Colors.primaryDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseBannerTitle}>{courseBannerText}</Text>
              {!isCancelled && !isDone && etaMinutes !== null && (
                <Text style={styles.courseBannerSub}>Arrivée estimée ~{etaMinutes} min</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.mapContainer}>
          {pickupCoords || deliveryCoords ? (
            <>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: ((pickupCoords?.lat ?? deliveryCoords!.lat) + (deliveryCoords?.lat ?? pickupCoords!.lat)) / 2,
                longitude: ((pickupCoords?.lng ?? deliveryCoords!.lng) + (deliveryCoords?.lng ?? pickupCoords!.lng)) / 2,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onMapReady={() => setMapReady(true)}
              showsUserLocation
            >
              {pickupCoords && (
              <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} pinColor={Colors.primary}>
                <View style={styles.markerWrap}>
                  <View style={[styles.markerDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.markerLabel}>Retrait</Text>
                </View>
              </Marker>
              )}
              {deliveryCoords && (
              <Marker coordinate={{ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }} pinColor={Colors.accent}>
                <View style={styles.markerWrap}>
                  <View style={[styles.markerDot, { backgroundColor: Colors.accent }]} />
                  <Text style={styles.markerLabel}>Livraison</Text>
                </View>
              </Marker>
              )}
              {pickupCoords && deliveryCoords && (routeCoords.length > 1 ? (
                <Polyline
                  coordinates={routeCoords.map(c => ({ latitude: c.lat, longitude: c.lng }))}
                  strokeColor={Colors.primary}
                  strokeWidth={4}
                />
              ) : (
                <Polyline
                  coordinates={[
                    { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                    { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng },
                  ]}
                  strokeColor={withAlpha(Colors.primary, 0.5)}
                  strokeWidth={3}
                />
              ))}
              {providerLocation && mission && ['accepted', 'picked_up', 'in_progress'].includes(mission.status) && (
                <Marker coordinate={{ latitude: providerLocation.lat, longitude: providerLocation.lng }}>
                  <View style={styles.driverMarker}>
                    <Ionicons name="bicycle" size={20} color={Colors.white} />
                  </View>
                </Marker>
              )}
              {providerLocation && mission && ['accepted', 'picked_up', 'in_progress'].includes(mission.status) && (
                <Circle
                  center={{ latitude: providerLocation.lat, longitude: providerLocation.lng }}
                  radius={200}
                  strokeColor={withAlpha(Colors.primary, 0.3)}
                  fillColor={withAlpha(Colors.primary, 0.1)}
                />
              )}
            </MapView>
            <TouchableOpacity style={styles.recenterBtn} onPress={fitToMarkers} activeOpacity={0.8}>
              <Ionicons name="expand-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={40} color={Colors.primaryDark} />
              <Text style={styles.mapFallbackText}>Coordonnées GPS non disponibles{mission ? ' pour cette mission' : ''}</Text>
            </View>
          )}
          {mission && ['accepted', 'picked_up', 'in_progress'].includes(mission.status) && providerLocation && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Livreur en direct</Text>
            </View>
          )}
        </View>

        <View style={[styles.etaCard, Shadows.sm]}>
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Statut</Text>
            <View style={[styles.etaBadge, { backgroundColor: mission ? statusColors[mission.status]?.bg || Colors.gray100 : Colors.gray100 }]}>
              <Text style={[styles.etaBadgeText, { color: mission ? statusColors[mission.status]?.text || Colors.gray600 : Colors.gray600 }]}>{mission ? statusLabels[mission.status] || mission.status : '—'}</Text>
            </View>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Formule</Text>
            <View style={[styles.etaBadge, { backgroundColor: urgencyColors[mission?.urgency]?.bg || Colors.gray100 }]}>
              <Text style={[styles.etaBadgeText, { color: urgencyColors[mission?.urgency]?.text || Colors.gray600 }]}>{formatFormulaLabel(mission?.urgency)}</Text>
            </View>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaLabel}>Prix</Text>
            <Text style={styles.etaTime}>{mission ? Number(mission.price).toLocaleString() + ' F' : '—'}</Text>
          </View>
        </View>

        {/* Bouton Payer si mission non payée */}
        {mission && !mission.payments?.some((p: any) => p.status === 'success') && mission.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.payBtn, Shadows.sm]}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('Payment', { missionId: mission.id, amount: Number(mission.price) })}
          >
            <View style={styles.payBtnIcon}>
              <Ionicons name="card-outline" size={20} color={Colors.white} />
            </View>
            <View style={styles.payBtnContent}>
              <Text style={styles.payBtnTitle}>Payer la mission</Text>
              <Text style={styles.payBtnSub}>{Number(mission.price).toLocaleString()} FCFA</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        )}

        {mission && (
          <View style={[styles.metaCard, Shadows.sm]}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.metaHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.metaHeaderIcon}>
                <Ionicons name={(serviceIcons[mission.serviceType] || 'cube-outline') as any} size={22} color={Colors.white} />
              </View>
              <View style={styles.metaHeaderContent}>
                <Text style={styles.metaHeaderTitle}>{serviceLabels[mission.serviceType] || mission.serviceType}</Text>
                <Text style={styles.metaHeaderSub}>
                  Créée le {new Date(mission.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </LinearGradient>

            {mission.scheduledAt && (
              <View style={styles.metaScheduleBanner}>
                <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                <View style={styles.metaScheduleTextWrap}>
                  <Text style={styles.metaScheduleLabel}>Programmé pour</Text>
                  <Text style={styles.metaScheduleValue}>
                    {new Date(mission.scheduledAt).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.metaDetailsSection}>
              <Text style={styles.metaDetailsTitle}>Informations</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailTile}>
                  <View style={styles.detailTileTop}>
                    <View style={styles.detailTileIcon}>
                      <Ionicons name="locate-outline" size={15} color={Colors.primary} />
                    </View>
                    <Text style={styles.detailTileLabel}>Récupération</Text>
                  </View>
                  <Text style={styles.detailTileValue} numberOfLines={2}>{mission.pickupAddress || '—'}</Text>
                </View>
                <View style={styles.detailTile}>
                  <View style={styles.detailTileTop}>
                    <View style={styles.detailTileIcon}>
                      <Ionicons name="flag-outline" size={15} color={Colors.primary} />
                    </View>
                    <Text style={styles.detailTileLabel}>Destination</Text>
                  </View>
                  <Text style={styles.detailTileValue} numberOfLines={2}>{mission.deliveryAddress || '—'}</Text>
                </View>
                <View style={styles.detailTile}>
                  <View style={styles.detailTileTop}>
                    <View style={styles.detailTileIcon}>
                      <Ionicons name={(serviceIcons[mission.serviceType] || 'cube-outline') as any} size={15} color={Colors.primary} />
                    </View>
                    <Text style={styles.detailTileLabel}>Type</Text>
                  </View>
                  <Text style={styles.detailTileValue} numberOfLines={2}>
                    {serviceLabels[mission.serviceType] || mission.serviceType}
                  </Text>
                </View>
                <View style={styles.detailTile}>
                  <View style={styles.detailTileTop}>
                    <View style={styles.detailTileIcon}>
                      <Ionicons name="time-outline" size={15} color={Colors.primary} />
                    </View>
                    <Text style={styles.detailTileLabel}>Heure estimée</Text>
                  </View>
                  <Text style={styles.detailTileValue} numberOfLines={2}>
                    {etaMinutes !== null ? `~${etaMinutes} min` : mission.scheduledAt
                      ? new Date(mission.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </Text>
                </View>
              </View>

              {detailEntries.length > 0 && (
                <>
                  <Text style={[styles.metaDetailsTitle, { marginTop: Spacing.md }]}>Détails de la demande</Text>
                  <View style={styles.detailGrid}>
                    {detailEntries.map(([key, value]) => {
                      const wide = isWideDetail(key, value);
                      const displayValue = formatDetailValue(key, value);
                      return (
                        <View key={key} style={[styles.detailTile, wide && styles.detailTileWide]}>
                          <View style={styles.detailTileTop}>
                            <View style={styles.detailTileIcon}>
                              <Ionicons
                                name={DETAIL_ICONS[key] || 'information-circle-outline'}
                                size={15}
                                color={Colors.primary}
                              />
                            </View>
                            <Text style={styles.detailTileLabel}>{DETAIL_LABELS[key] || humanizeDetailKey(key)}</Text>
                          </View>
                          <Text style={[styles.detailTileValue, wide && styles.detailTileValueWide]} numberOfLines={wide ? 6 : 2}>
                            {displayValue}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {mission?.provider && (
          <View style={styles.driverCard}>
            <DriverVehicleCard
              name={`${mission.provider.firstName || ''} ${mission.provider.lastName || ''}`.trim() || 'Prestataire'}
              rating={mission.provider.rating}
              avatarUrl={mission.provider.avatarUrl}
              vehicleType={mission.provider.vehicle?.type || mission.provider.vehicleType}
              brand={mission.provider.vehicle?.brand}
              model={mission.provider.vehicle?.model}
              color={mission.provider.vehicle?.color}
              plate={mission.provider.vehicle?.plate}
            />
            {!isActiveAdmin && etaMinutes !== null && (
              <View style={styles.arrivalBadge}>
                <Ionicons name="time-outline" size={12} color={Colors.primary} />
                <Text style={styles.arrivalText}>Arrivée estimée ~{etaMinutes} min</Text>
              </View>
            )}
            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.callBtn} activeOpacity={0.8} onPress={() => { if (mission?.provider?.phone) Linking.openURL(`tel:${mission.provider.phone}`); }}><Ionicons name="call" size={18} color={Colors.primary} /></TouchableOpacity>
              <TouchableOpacity style={styles.msgBtn} activeOpacity={0.8} onPress={() => handleOpenChat()}><Ionicons name="chatbubble" size={18} color={Colors.info} /></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.routeCard, Shadows.sm]}>
          <Text style={styles.timelineTitle}>Itinéraire</Text>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{mission?.pickupAddress || '—'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
            <Text style={styles.routeText} numberOfLines={1}>{mission?.deliveryAddress || '—'}</Text>
          </View>
        </View>

        {mission?.recipientName && (
          <View style={[styles.recipientCard, Shadows.sm]}>
            <View style={styles.recipientHeader}>
              <Ionicons name="people-outline" size={18} color={Colors.info} />
              <Text style={styles.recipientTitle}>Remise à un tiers</Text>
            </View>
            <View style={styles.recipientRow}>
              <Text style={styles.recipientKey}>Destinataire</Text>
              <Text style={styles.recipientVal}>{mission.recipientName}</Text>
            </View>
            {mission.recipientPhone && (
              <View style={styles.recipientRow}>
                <Text style={styles.recipientKey}>Téléphone</Text>
                <Text style={styles.recipientVal}>{mission.recipientPhone}</Text>
              </View>
            )}
            {mission.recipientRelation && (
              <View style={styles.recipientRow}>
                <Text style={styles.recipientKey}>Relation</Text>
                <Text style={styles.recipientVal}>{mission.recipientRelation}</Text>
              </View>
            )}
            {mission.deliveryCode && (
              <View style={styles.deliveryCodeBox}>
                <Ionicons name="key-outline" size={16} color={Colors.primary} />
                <Text style={styles.deliveryCodeLabel}>Code de remise:</Text>
                <Text style={styles.deliveryCodeVal}>{mission.deliveryCode}</Text>
              </View>
            )}
            {mission.deliveryCode && !isDone && (
              <View style={styles.providerCodeHint}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                <Text style={styles.providerCodeHintText}>
                  Le prestataire devra saisir ce code au moment de valider la remise finale.
                </Text>
              </View>
            )}
            {mission.requiresIdVerification && (
              <View style={styles.idVerifyBanner}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.warning} />
                <Text style={styles.idVerifyText}>Vérification de la pièce d'identité du destinataire requise</Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.timelineCard, Shadows.sm]}>
          <Text style={styles.timelineTitle}>Progression</Text>
          {!isCancelled && currentIndex >= 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / statusFlow.length) * 100}%` }]} />
            </View>
          )}
          {isCancelled && (
            <View style={styles.cancelledBanner}>
              <Ionicons name="close-circle" size={20} color={Colors.accent} />
              <Text style={styles.cancelledBannerText}>Cette mission a été annulée</Text>
            </View>
          )}
          {statusFlow.map((item, i) => (
            <View key={item.key} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[
                  styles.timelineDot,
                  i <= currentIndex && styles.timelineDotDone,
                  i === currentIndex && styles.timelineDotActive,
                  isCancelled && styles.timelineDotCancelled,
                ]}>
                  {i < currentIndex && <Ionicons name="checkmark" size={10} color={Colors.white} />}
                  {i === currentIndex && !isCancelled && <View style={styles.timelineDotInner} />}
                  {isCancelled && i === 0 && <Ionicons name="close" size={10} color={Colors.accent} />}
                </View>
                {i < statusFlow.length - 1 && <View style={[styles.timelineLine, i < currentIndex && styles.timelineLineDone, isCancelled && styles.timelineLineCancelled]} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[
                  styles.timelineLabel,
                  i > currentIndex && styles.timelineLabelPending,
                  isCancelled && styles.timelineLabelCancelled,
                ]}>{item.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85} disabled={cancelling}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.cancelText}>{cancelling ? 'Annulation...' : 'Annuler la mission'}</Text>
          </TouchableOpacity>
        )}

        {canRate && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Évaluez votre expérience</Text>
            <Text style={styles.ratingSub}>Comment s'est passée votre mission ?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                  <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={36} color={s <= rating ? Colors.warning : Colors.gray300} />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <>
                <TextInput
                  style={styles.ratingCommentInput}
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  placeholder="Laissez un commentaire (optionnel)"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.ratingSubmitBtn} onPress={handleSubmitRating} activeOpacity={0.85} disabled={submittingRating}>
                  <Text style={styles.ratingSubmitText}>{submittingRating ? 'Envoi...' : 'Envoyer l\'évaluation'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {ratingSubmitted && (
          <View style={styles.ratingDoneCard}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
            <Text style={styles.ratingDoneText}>Mission évaluée. Merci pour votre retour !</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => Linking.openURL(SUPPORT_TEL_URL)}
          activeOpacity={0.85}
        >
          <Ionicons name="headset-outline" size={18} color={Colors.white} />
          <Text style={styles.supportBtnText}>Contacter le support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.disputeBtn} onPress={() => setDisputeOpen(true)} activeOpacity={0.85}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.disputeBtnText}>Ouvrir un litige</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={disputeOpen} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); setDisputeOpen(false); }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.disputeOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.disputeSheet}>
            <View style={styles.disputeHeader}>
              <Text style={styles.disputeTitle}>Ouvrir un litige</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setDisputeOpen(false); }}><Ionicons name="close" size={22} color={Colors.gray400} /></TouchableOpacity>
            </View>
            <Text style={styles.disputeLabel}>Motif du litige</Text>
            <TextInput style={styles.disputeInput} value={disputeReason} onChangeText={setDisputeReason} placeholder="Ex: Colis endommagé, retard..." placeholderTextColor={Colors.gray300} returnKeyType="done" />
            <Text style={styles.disputeLabel}>Description (optionnel)</Text>
            <TextInput style={[styles.disputeInput, styles.disputeTextarea]} value={disputeDesc} onChangeText={setDisputeDesc} placeholder="Décrivez le problème..." placeholderTextColor={Colors.gray300} multiline numberOfLines={4} textAlignVertical="top" />
            <TouchableOpacity style={styles.disputeSubmitBtn} onPress={handleSubmitDispute} activeOpacity={0.85} disabled={submittingDispute || !disputeReason.trim()}>
              <Text style={styles.disputeSubmitText}>{submittingDispute ? 'Envoi...' : 'Soumettre le litige'}</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  headerBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMarkText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 13,
    color: Colors.primaryDark,
  },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  courseBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: withAlpha(Colors.success, 0.25),
  },
  courseBannerDone: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primarySoft,
  },
  courseBannerCancelled: {
    backgroundColor: withAlpha(Colors.accent, 0.08),
    borderColor: withAlpha(Colors.accent, 0.2),
  },
  courseBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBannerIconCancelled: {
    backgroundColor: withAlpha(Colors.accent, 0.15),
  },
  courseBannerTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  courseBannerSub: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
  },
  mapContainer: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md, height: 240, backgroundColor: Colors.gray100 },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray100 },
  mapFallbackText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.lg },
  markerWrap: { alignItems: 'center' },
  markerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.white },
  markerLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 10, color: Colors.gray700, marginTop: 2, backgroundColor: Colors.white, paddingHorizontal: 4, borderRadius: 4 },
  driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  recenterBtn: { position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  liveBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, ...Shadows.sm, gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 10, color: Colors.success },
  etaCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Colors.white, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, padding: Spacing.base },
  etaItem: { alignItems: 'center' },
  etaLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  etaTime: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginTop: 4 },
  etaBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginTop: 4 },
  etaBadgeText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs },
  etaDivider: { width: 1, height: 30, backgroundColor: Colors.gray200 },
  metaCard: { backgroundColor: Colors.white, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  metaHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  metaHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaHeaderContent: { flex: 1 },
  metaHeaderTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  metaHeaderSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  metaScheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
  },
  metaScheduleTextWrap: { flex: 1 },
  metaScheduleLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  metaScheduleValue: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900, marginTop: 2 },
  metaDetailsSection: { padding: Spacing.base, paddingTop: Spacing.md },
  metaDetailsTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  detailTile: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray200,
    padding: Spacing.sm,
    minHeight: 84,
  },
  detailTileWide: {
    flexBasis: '100%',
    maxWidth: '100%',
    minHeight: 72,
  },
  detailTileTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  detailTileIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(Colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTileLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  detailTileValue: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    lineHeight: 18,
  },
  detailTileValueWide: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaContent: { marginLeft: Spacing.md, flex: 1 },
  metaLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  metaValue: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray900, marginTop: 2 },
  metaDivider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.sm },
  driverCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  driverActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  arrivalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: withAlpha(Colors.primary, 0.08), paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  arrivalText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.primary },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(Colors.primary, 0.1), alignItems: 'center', justifyContent: 'center' },
  msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(Colors.info, 0.1), alignItems: 'center', justifyContent: 'center' },
  payBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.base, gap: Spacing.md },
  payBtnIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  payBtnContent: { flex: 1 },
  payBtnTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  payBtnSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  routeCard: { backgroundColor: Colors.white, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.base },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  routeLine: { width: 2, height: 20, backgroundColor: Colors.gray200, marginLeft: 3, marginVertical: 2 },
  routeText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600 },
  recipientCard: { backgroundColor: Colors.white, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.base },
  recipientHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  recipientTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  recipientRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  recipientKey: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  recipientVal: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  deliveryCodeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: withAlpha(Colors.primary, 0.08), borderRadius: BorderRadius.md },
  deliveryCodeLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600 },
  deliveryCodeVal: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.md, color: Colors.primary },
  providerCodeHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: withAlpha(Colors.info, 0.08), borderRadius: BorderRadius.md },
  providerCodeHintText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.info },
  idVerifyBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: withAlpha(Colors.warning, 0.08), borderRadius: BorderRadius.md },
  idVerifyText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.warning },
  timelineCard: { backgroundColor: Colors.white, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing['3xl'] },
  timelineTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginBottom: Spacing.md },
  progressBarContainer: { height: 6, backgroundColor: Colors.gray200, borderRadius: 3, marginBottom: Spacing.md, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  timelineItem: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', marginRight: Spacing.md },
  timelineDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.gray200, borderWidth: 2, borderColor: Colors.gray200, alignItems: 'center', justifyContent: 'center' },
  timelineDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  timelineDotActive: { backgroundColor: Colors.white, borderColor: Colors.primary, borderWidth: 3 },
  timelineDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  timelineDotCancelled: { backgroundColor: withAlpha(Colors.accent, 0.1), borderColor: Colors.accent },
  timelineLine: { width: 2, flex: 1, minHeight: 28, backgroundColor: Colors.gray200, marginVertical: 2 },
  timelineLineDone: { backgroundColor: Colors.success },
  timelineLineCancelled: { backgroundColor: withAlpha(Colors.accent, 0.3) },
  timelineContent: { paddingBottom: Spacing.md },
  timelineLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  timelineLabelPending: { color: Colors.gray400 },
  timelineLabelCancelled: { color: Colors.accent },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: withAlpha(Colors.accent, 0.08), borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  cancelledBannerText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.accent },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing['3xl'], backgroundColor: withAlpha(Colors.accent, 0.1), borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, gap: 8 },
  cancelText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.accent },
  ratingCard: { backgroundColor: Colors.white, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md },
  ratingTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  ratingSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 4, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  ratingCommentInput: { width: '100%', minHeight: 70, borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray900, marginBottom: Spacing.md },
  ratingSubmitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  ratingSubmitText: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  ratingDoneCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: withAlpha(Colors.success, 0.08), marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing['3xl'] },
  ratingDoneText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.success, flex: 1 },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    gap: 8,
  },
  supportBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  disputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing['3xl'], backgroundColor: withAlpha(Colors.accent, 0.08), borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, gap: 8 },
  disputeBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.accent },
  disputeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  disputeSheet: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius['2xl'], borderTopRightRadius: BorderRadius['2xl'], padding: Spacing.lg, paddingBottom: 40 },
  disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  disputeTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  disputeLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 4, marginTop: Spacing.sm },
  disputeInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900, backgroundColor: Colors.gray50, minHeight: 48 },
  disputeTextarea: { minHeight: 80 },
  disputeSubmitBtn: { backgroundColor: Colors.accent, borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.lg },
  disputeSubmitText: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
});
