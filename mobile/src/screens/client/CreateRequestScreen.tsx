import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, KeyboardAvoidingView, Platform, Modal, Keyboard, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { AddressInput } from '../../components/ui/AddressInput';
import { useAuth } from '../../context/AuthContext';
import { useUserLocation } from '../../context/UserLocationContext';
import { api } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { SenegalLocation, senegalLocations, searchLocations } from '../../constants/senegalLocations';
import { GeoAddress } from '../../services/location';
import { ServiceDetailsFields, ServiceDetails, validateServiceDetails } from '../../components/ServiceDetailsFields';
import { formulaOptions } from '../../constants/formulas';
import { requiresVehicleMode, type VehicleMode } from '../../constants/vehicle';
import {
  defaultDetailsForUiService,
  enrichServiceDetailsForApi,
  normalizeInitialServiceType,
  resolveApiServiceType,
  usesLateRouteFields,
  serviceDisplayLabel,
  missionAudience,
  colisNeed,
} from '../../constants/serviceFlows';

const serviceTypes = [
  { id: 'colis', label: 'Collecte & Livraison', desc: 'Particulier ou pro — colis, courses, facture…', icon: 'cube' as const, color: Colors.primary, gradient: ['#0D8F8F', '#14B8B8'] as [string, string] },
  { id: 'depot_administratif', label: 'Démarches', desc: 'CNI, passeport, casier… Bag\'up gère le dépôt', icon: 'business' as const, color: Colors.warning, gradient: ['#F59E0B', '#FBBF24'] as [string, string] },
];

const timingOptions = [
  { id: 'immediate', label: 'Immédiat', desc: 'Dès que possible', icon: 'flash' as const },
  { id: 'programme', label: 'Programmé', desc: 'Choisir date et heure', icon: 'calendar' as const },
];

const stepLabelsRouteFirst: Record<number, string> = {
  1: 'Service et adresses',
  2: 'Essentiel du besoin',
  3: 'Contacts et confirmation',
};

const stepLabelsNeedFirst: Record<number, string> = {
  1: 'Type de service',
  2: 'Essentiel du besoin',
  3: 'Trajet et confirmation',
};

/** Compat deep links legacy (courses, pro flows…). */
const SERVICES_ROUTE_LAST = new Set(['depot_administratif', 'colis']);

/** Formule livraison → API UrgencyLevel (le timing programmé passe par scheduledAt). */
function toApiUrgency(urgencyLevel: string): 'standard' | 'express' | 'groupe' {
  if (urgencyLevel === 'express') return 'express';
  if (urgencyLevel === 'groupe') return 'groupe';
  return 'standard';
}

interface Props {
  onBack: () => void; 
  onSubmit: () => void; 
  initialServiceType?: string; 
  prefilledDelivery?: string;
  prefilledDeliveryCoords?: { lat: number; lng: number };
  navigation?: any; 
}

/** Champ qui se recentre au-dessus du clavier sans remonter en haut de page. */
function FocusableField({
  style,
  onEnsureVisible,
  children,
}: {
  style?: object;
  onEnsureVisible: (target?: View | null) => void;
  children: (onFocus: () => void) => React.ReactNode;
}) {
  const ref = useRef<View>(null);
  return (
    <View ref={ref} style={style} collapsable={false}>
      {children(() => onEnsureVisible(ref.current))}
    </View>
  );
}

export const CreateRequestScreen: React.FC<Props> = ({ onBack, onSubmit, initialServiceType, prefilledDelivery, prefilledDeliveryCoords, navigation }) => {
  const insets = useSafeAreaInsets();
  const initial = normalizeInitialServiceType(
    initialServiceType === 'objets_personnels' ? 'objets_personnels' : initialServiceType,
  );
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState(initial.uiServiceType || '');
  const [serviceDetails, setServiceDetails] = useState<ServiceDetails>(initial.detailsSeed);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode | ''>('');
  const [showServicePicker, setShowServicePicker] = useState(!initial.uiServiceType);
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState(prefilledDelivery || '');
  const [description, setDescription] = useState('');
  const [timingMode, setTimingMode] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const { address: userLocation } = useUserLocation();

  const [procedures, setProcedures] = useState<any[]>([]);
  const [selectedProcedures, setSelectedProcedures] = useState<any[]>([]);
  const [otherProcedureEnabled, setOtherProcedureEnabled] = useState(false);
  const [otherProcedureText, setOtherProcedureText] = useState('');
  const [demarchesProviders, setDemarchesProviders] = useState<any[]>([]);
  const [selectedDemarchesProviderId, setSelectedDemarchesProviderId] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [remiseTiers, setRemiseTiers] = useState(false);
  const [recipientRelation, setRecipientRelation] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [clientCountry, setClientCountry] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(prefilledDeliveryCoords || null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [formulaPrices, setFormulaPrices] = useState<Record<string, number | null>>({});
  const [estimating, setEstimating] = useState(false);
  const [quoteDistanceKm, setQuoteDistanceKm] = useState<number | null>(null);
  const [quoteDurationMin, setQuoteDurationMin] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickupAccess, setPickupAccess] = useState('');
  const [deliveryAccess, setDeliveryAccess] = useState('');
  const [pickupFloor, setPickupFloor] = useState('');
  const [pickupContactName, setPickupContactName] = useState('');
  const [pickupContactPhone, setPickupContactPhone] = useState('');
  const [pickupContactPhone2, setPickupContactPhone2] = useState('');
  const [deliveryContactName, setDeliveryContactName] = useState('');
  const [deliveryContactPhone, setDeliveryContactPhone] = useState('');
  const [deliveryContactPhone2, setDeliveryContactPhone2] = useState('');
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [showExtraContacts, setShowExtraContacts] = useState(false);
  const [showAdditionalRequestInfo, setShowAdditionalRequestInfo] = useState(false);
  const [showPhotoSection, setShowPhotoSection] = useState(false);
  const [showThirdPartySection, setShowThirdPartySection] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const addressFieldsY = useRef(0);
  const deliveryFieldsY = useRef(0);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const focusedTargetRef = useRef<View | null>(null);
  const footerHeightRef = useRef(88);
  const [shouldScrollToAddresses, setShouldScrollToAddresses] = useState(!!initial.uiServiceType);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(88);

  useEffect(() => {
    if (pickup.trim() || !userLocation) return;
    setPickup(userLocation.label);
    setPickupCoords({ lat: userLocation.lat, lng: userLocation.lng });
  }, [userLocation, pickup]);

  /** Garde le champ focalisé visible au-dessus du clavier + bouton Continuer. */
  const ensureFocusedVisible = useCallback((target?: View | null) => {
    if (target) focusedTargetRef.current = target;
    const node = target ?? focusedTargetRef.current;
    if (!node) return;
    const run = () => {
      node.measureInWindow((_x, y, _w, h) => {
        const screenH = Dimensions.get('window').height;
        const kb = keyboardHeightRef.current;
        const footer = footerHeightRef.current;
        const visibleBottom = screenH - Math.max(kb, 0) - footer - 12;
        const fieldBottom = y + Math.max(h, 48);
        const topGuard = Math.max(insets.top, 12) + 88;
        let delta = 0;
        if (fieldBottom > visibleBottom - 20) {
          delta = fieldBottom - visibleBottom + 36;
        } else if (y < topGuard) {
          delta = y - topGuard - 12;
        }
        if (Math.abs(delta) < 6) return;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
      });
    };
    // Clavier iOS : attendre la fin de l’animation.
    setTimeout(run, Platform.OS === 'ios' ? 280 : 180);
    setTimeout(run, Platform.OS === 'ios' ? 480 : 320);
  }, [insets.top]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height || 0;
      keyboardHeightRef.current = h;
      setKeyboardHeight(h);
      // Recentrer le champ après l’ouverture du clavier.
      setTimeout(() => ensureFocusedVisible(), Platform.OS === 'ios' ? 80 : 40);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [ensureFocusedVisible]);

  const scrollToY = useCallback((y: number, extraTop = 24) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(y - extraTop, 0),
        animated: true,
      });
    }, Platform.OS === 'ios' ? 60 : 120);
  }, []);

  const scrollToAddressFields = useCallback(() => {
    scrollToY(addressFieldsY.current, Spacing.md);
  }, [scrollToY]);

  const scrollToTop = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated });
    });
  }, []);

  const handleServiceSelect = (id: string) => {
    setServiceType(id);
    setShowServicePicker(false);
    setServiceDetails(defaultDetailsForUiService(id));
    if (!usesLateRouteFields(id, defaultDetailsForUiService(id))) {
      setShouldScrollToAddresses(true);
      requestAnimationFrame(() => scrollToAddressFields());
    }
  };

  const handleAddressFieldsLayout = useCallback((y: number) => {
    addressFieldsY.current = y;
    if (shouldScrollToAddresses && serviceType) {
      setShouldScrollToAddresses(false);
      scrollToAddressFields();
    }
  }, [shouldScrollToAddresses, serviceType, scrollToAddressFields]);

  const effectiveServiceType = resolveApiServiceType(serviceType, serviceDetails);
  const isAdminService = effectiveServiceType === 'depot_administratif';
  const officialFeesTotal = selectedProcedures.reduce(
    (sum, p) => sum + (Number(p.estimatedFee) || 0),
    0,
  );
  const hasAdminDocsSelection =
    selectedProcedures.length > 0
    || (otherProcedureEnabled && otherProcedureText.trim().length > 0);
  const adminProcedureTypeLabel = [
    ...selectedProcedures.map((p) => p.name),
    otherProcedureEnabled && otherProcedureText.trim()
      ? `Autre: ${otherProcedureText.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ');
  const adminOrganismLabel = [...new Set(selectedProcedures.map((p) => p.organism).filter(Boolean))].join(' · ');
  const routeLate = usesLateRouteFields(serviceType, serviceDetails);
  const needsVehiclePick = requiresVehicleMode(effectiveServiceType) && !isAdminService;
  const showExtraPickupMeta =
    effectiveServiceType === 'courses'
    || effectiveServiceType === 'collecte_marchandises'
    || effectiveServiceType === 'livraison_entreprise';
  const apiUrgency = toApiUrgency(urgencyLevel);
  const estimatedValueRaw = String(serviceDetails.sharedEstimatedValue ?? serviceDetails.estimatedValue ?? '').replace(/[^\d]/g, '');
  const estimatedValue = estimatedValueRaw ? Number(estimatedValueRaw) : 0;
  const requiresSecurityProof =
    serviceType === 'colis'
    && missionAudience(serviceDetails) === 'particulier'
    && (colisNeed(serviceDetails) === 'colis' || colisNeed(serviceDetails) === 'objet')
    && estimatedValue > 50000;
  const requiresAdminDocs = isAdminService;

  useEffect(() => {
    if (requiresSecurityProof || requiresAdminDocs) {
      setShowPhotoSection(true);
    }
  }, [requiresSecurityProof, requiresAdminDocs]);

  useEffect(() => {
    if (remiseTiers) {
      setShowThirdPartySection(true);
    }
  }, [remiseTiers]);

  useEffect(() => {
    if (isAdminService) {
      api.adminProcedures
        .all()
        .then((items: any[]) => setProcedures(Array.isArray(items) ? items : []))
        .catch(() => setProcedures([]));
      if (token) {
        api.users.demarchesProviders(token)
          .then((items: any[]) => setDemarchesProviders(Array.isArray(items) ? items : []))
          .catch(() => setDemarchesProviders([]));
      }
    } else {
      setSelectedProcedures([]);
      setOtherProcedureEnabled(false);
      setOtherProcedureText('');
      setSelectedDemarchesProviderId('');
      setDemarchesProviders([]);
    }
  }, [isAdminService, token]);

  useEffect(() => {
    // Remonter uniquement au changement d'étape (pas au focus d'un champ).
    const t = setTimeout(() => scrollToTop(step !== 1), 16);
    return () => clearTimeout(t);
  }, [step, scrollToTop]);

  const resolveCoords = (text: string, coords: { lat: number; lng: number } | null) => {
    // Ne jamais retomber sur une suggestion approximative : sans GPS sélectionné,
    // on n'estime pas (évite les prix absurdes type "texte Soprim" + ancien point GPS).
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      return coords;
    }
    return null;
  };

  useEffect(() => {
    if (!needsVehiclePick) {
      setVehicleMode('');
    }
  }, [needsVehiclePick]);

  // Estimation style Yango : dès que retrait + livraison (+ véhicule) sont prêts
  useEffect(() => {
    if (!token) return;
    const pc = resolveCoords(pickup, pickupCoords);
    const dc = resolveCoords(delivery, deliveryCoords);
    if (!pc || !dc) {
      setEstimatedPrice(null);
      setFormulaPrices({});
      setQuoteDistanceKm(null);
      setQuoteDurationMin(null);
      return;
    }
    if (needsVehiclePick && !vehicleMode) {
      setEstimatedPrice(null);
      setFormulaPrices({});
      setQuoteDistanceKm(null);
      setQuoteDurationMin(null);
      return;
    }

    const modeForPrice = needsVehiclePick ? vehicleMode || undefined : undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setEstimating(true);
      Promise.all(
        formulaOptions.map((f) =>
          api.geo
            .estimate(String(pc.lat), String(pc.lng), String(dc.lat), String(dc.lng), f.id, token, modeForPrice)
            .then((res: any) => ({ id: f.id, res }))
            .catch(() => ({ id: f.id, res: null })),
        ),
      )
        .then((entries) => {
          if (cancelled) return;
          const prices: Record<string, number | null> = {};
          let distanceKm: number | null = null;
          let durationMin: number | null = null;
          for (const { id, res } of entries) {
            prices[id] = typeof res?.price === 'number' ? res.price : null;
            if (distanceKm == null && typeof res?.distanceKm === 'number') distanceKm = res.distanceKm;
            if (durationMin == null && typeof res?.durationMin === 'number') durationMin = res.durationMin;
          }
          setFormulaPrices(prices);
          setQuoteDistanceKm(distanceKm);
          setQuoteDurationMin(durationMin);
          const selected = urgencyLevel || 'standard';
          setEstimatedPrice(prices[selected] ?? prices.standard ?? null);
        })
        .finally(() => {
          if (!cancelled) setEstimating(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [urgencyLevel, pickupCoords, deliveryCoords, pickup, delivery, token, vehicleMode, needsVehiclePick]);

  const pickPhoto = async () => {
    const uri = await pickImageFromLibrary({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (uri) setPhotoUris([...photoUris, uri]);
  };

  const validateRouteFields = () => {
    if (needsVehiclePick && !vehicleMode) {
      Alert.alert('Erreur', 'Choisissez moto ou voiture pour cette livraison');
      return false;
    }
    if (!pickup.trim()) {
      Alert.alert('Erreur', 'Veuillez renseigner l\'adresse de récupération');
      return false;
    }
    if (!delivery.trim()) {
      Alert.alert('Erreur', 'Veuillez renseigner l\'adresse de livraison');
      return false;
    }
    if (!resolveCoords(pickup, pickupCoords) || !resolveCoords(delivery, deliveryCoords)) {
      Alert.alert(
        'Adresses',
        'Sélectionnez le retrait et la livraison dans la liste (ou via GPS) pour calculer un prix cohérent.',
      );
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    Keyboard.dismiss();
    if (step === 1) {
      if (!serviceType) {
        Alert.alert('Erreur', 'Veuillez sélectionner un type de service');
        return;
      }
      if (!routeLate && !validateRouteFields()) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      if (isAdminService && !hasAdminDocsSelection) {
        Alert.alert('Erreur', 'Sélectionnez au moins un document (ou « Autres » avec précision)');
        return;
      }
      if (isAdminService && otherProcedureEnabled && !otherProcedureText.trim()) {
        Alert.alert('Erreur', 'Précisez le document dans « Autres »');
        return;
      }
      const detailsError = validateServiceDetails(serviceType, serviceDetails);
      if (detailsError) {
        Alert.alert('Erreur', detailsError);
        return;
      }
      setStep(3);
      return;
    }

    if (routeLate && !validateRouteFields()) return;
    if (!pickupContactName.trim() || !pickupContactPhone.trim()) {
      Alert.alert('Erreur', 'Contact de récupération obligatoire (nom et téléphone)');
      return;
    }
    if (!deliveryContactName.trim() || !deliveryContactPhone.trim()) {
      Alert.alert('Erreur', 'Contact de livraison obligatoire (nom et téléphone)');
      return;
    }
    if (remiseTiers && (!recipientRelation.trim())) {
      Alert.alert('Erreur', 'Précisez le lien avec le destinataire pour la remise à un tiers');
      return;
    }
    if ((requiresSecurityProof || requiresAdminDocs) && photoUris.length === 0) {
      Alert.alert(
        'Justificatif requis',
        requiresAdminDocs
          ? 'Ajoutez au moins une photo / scan des documents pour faciliter la démarche.'
          : 'Ajoutez au moins une photo pour un colis / objet de valeur supérieure à 50 000 FCFA.',
      );
      return;
    }
    if (!timingMode) {
      Alert.alert('Erreur', 'Choisissez Immédiat ou Programmé');
      return;
    }
    if (timingMode === 'programme' && !scheduledDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner une date et heure');
      return;
    }
    if (!isAdminService && !urgencyLevel) {
      Alert.alert('Erreur', 'Veuillez sélectionner une formule de livraison');
      return;
    }
    if (isAdminService && !selectedDemarchesProviderId) {
      Alert.alert('Erreur', 'Choisissez un prestataire démarches. Son tarif est affiché avant validation.');
      return;
    }
    if (!acceptCgu) {
      Alert.alert('Erreur', 'Veuillez accepter les conditions générales d\'utilisation');
      return;
    }

    // Fallback: try to find coordinates from typed address if not already set
    let finalPickupCoords = pickupCoords;
    if (!finalPickupCoords) {
      const match = searchLocations(pickup)[0];
      if (match) finalPickupCoords = { lat: match.lat, lng: match.lng };
    }
    let finalDeliveryCoords = deliveryCoords;
    if (!finalDeliveryCoords) {
      const match = searchLocations(delivery)[0];
      if (match) finalDeliveryCoords = { lat: match.lat, lng: match.lng };
    }

    const chosenProvider = demarchesProviders.find((p) => p.id === selectedDemarchesProviderId);
    const serviceFee = isAdminService ? Number(chosenProvider?.demarchesServiceFee || 0) : 0;
    const basePrice = isAdminService ? serviceFee : (estimatedPrice ?? formulaPrices[urgencyLevel] ?? 0);
    if (!basePrice) {
      Alert.alert('Erreur', isAdminService ? 'Ce prestataire n’a pas de tarif.' : 'Impossible d\'estimer le tarif. Vérifiez les adresses.');
      return;
    }
    const adminFee = isAdminService ? officialFeesTotal : 0;
    const totalPrice = basePrice + adminFee;
    setLoading(true);
    try {
      let photosUrl: string | undefined;
      if (photoUris.length > 0 && token) {
        setUploading(true);
        const urls: string[] = [];
        for (const uri of photoUris) {
          const res = await api.uploads.upload({ uri, type: 'image/jpeg', name: `photo-${Date.now()}.jpg` }, token).catch(() => null);
          if (res?.url) urls.push(res.url);
        }
        photosUrl = urls.join(',');
        setUploading(false);
      }

      const enrichedDetails: ServiceDetails = enrichServiceDetailsForApi(serviceType, {
        ...serviceDetails,
        pickupAccessInstructions: pickupAccess || undefined,
        deliveryAccessInstructions: deliveryAccess || undefined,
        pickupFloor: pickupFloor || undefined,
        pickupContactName,
        pickupContactPhone,
        pickupContactPhone2: pickupContactPhone2 || undefined,
        deliveryContactName,
        deliveryContactPhone,
        deliveryContactPhone2: deliveryContactPhone2 || undefined,
        timingMode,
        urgencyLevel: urgencyLevel || (isAdminService ? 'standard' : undefined),
        ...(isAdminService && selectedDemarchesProviderId ? { preferredProviderId: selectedDemarchesProviderId, serviceFee: String(serviceFee) } : {}),
        ...(needsVehiclePick && vehicleMode ? { vehicleNeeded: vehicleMode } : {}),
      });

      const missionData = {
        serviceType: effectiveServiceType,
        urgency: isAdminService ? 'standard' : apiUrgency,
        pickupAddress: pickup,
        deliveryAddress: delivery,
        description: description || (typeof serviceDetails.instructions === 'string' ? serviceDetails.instructions : undefined),
        price: totalPrice,
        vehicleMode: needsVehiclePick ? vehicleMode || undefined : undefined,
        photos: photosUrl,
        pickupLat: finalPickupCoords?.lat?.toString(),
        pickupLng: finalPickupCoords?.lng?.toString(),
        deliveryLat: finalDeliveryCoords?.lat?.toString(),
        deliveryLng: finalDeliveryCoords?.lng?.toString(),
        adminProcedureType: adminProcedureTypeLabel || (typeof serviceDetails.procedureType === 'string' ? serviceDetails.procedureType : undefined),
        adminOrganism: adminOrganismLabel || (typeof serviceDetails.organism === 'string' ? serviceDetails.organism : undefined),
        adminFeeEstimated: adminFee > 0 ? adminFee : undefined,
        recipientName: deliveryContactName,
        recipientPhone: deliveryContactPhone,
        recipientRelation: remiseTiers ? recipientRelation : undefined,
        recipientAddress: remiseTiers ? recipientAddress : undefined,
        clientCountry: remiseTiers ? clientCountry : undefined,
        requiresIdVerification: remiseTiers
          || (serviceType === 'colis' && colisNeed(serviceDetails) === 'document_transport')
          || serviceType === 'depot_administratif',
        serviceDetails: enrichedDetails,
        scheduledAt: timingMode === 'programme' && scheduledDate ? scheduledDate.toISOString() : undefined,
      };

      // Afficher le choix de paiement AVANT de créer la mission
      Alert.alert(
        'Confirmer la commande',
        `Montant total : ${totalPrice.toLocaleString()} FCFA\n\nComment souhaitez-vous procéder ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => setLoading(false),
          },
          {
            text: 'Payer plus tard',
            onPress: async () => {
              try {
                const mission = await api.missions.create(missionData, token!);
                // Remplacer l'écran actuel par Tracking pour éviter de revenir sur CreateRequest
                navigation?.replace('Tracking', { missionId: mission.id });
              } catch (err: any) {
                Alert.alert('Erreur', err.message || 'Création échouée');
                setLoading(false);
              }
            },
          },
          {
            text: 'Payer maintenant',
            style: 'default',
            onPress: async () => {
              try {
                const mission = await api.missions.create(missionData, token!);
                navigation?.replace('Payment', { missionId: mission.id, amount: totalPrice });
              } catch (err: any) {
                Alert.alert('Erreur', err.message || 'Création échouée');
                setLoading(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
      return; // Sortir ici car le loading sera géré dans les callbacks
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Création échouée');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };
  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }
    onBack();
  };

  const currentStepLabels = routeLate ? stepLabelsNeedFirst : stepLabelsRouteFirst;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, Spacing.lg) }]}>
        <TouchableOpacity onPress={handlePrev} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nouvelle demande</Text>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>{`Etape ${step} sur 3`}</Text>
          </View>
          <Text style={styles.headerStepLabel}>{currentStepLabels[step]}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressBar, s <= step && styles.progressActive]} />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.formArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 8) : 0}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: footerHeight + Spacing.xl + (Platform.OS === 'android' && keyboardHeight > 0 ? 24 : 0),
        }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled
        bounces
        automaticallyAdjustKeyboardInsets
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>{routeLate ? 'Quel service ?' : 'Service et adresses'}</Text>
            <Text style={styles.stepSubtitle}>
              {routeLate
                ? serviceType && !showServicePicker
                  ? 'On commence par le besoin. Retrait, livraison et moto/voiture viendront à la dernière étape.'
                  : 'Choisissez le besoin. Les adresses ne sont demandées tout de suite que pour les livraisons A → B.'
                : serviceType && !showServicePicker
                  ? 'Renseignez le départ et l’arrivée pour ce service.'
                  : 'Choisissez le besoin puis renseignez le départ et l’arrivée.'}
            </Text>

            {serviceType && !showServicePicker ? (
              (() => {
                const selected = serviceTypes.find((s) => s.id === serviceType);
                if (!selected) return null;
                return (
                  <View style={[styles.selectedServiceCard, Shadows.sm]}>
                    <LinearGradient colors={selected.gradient} style={styles.selectedServiceIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name={selected.icon} size={22} color={Colors.white} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedServiceLabel}>{selected.label}</Text>
                      <Text style={styles.selectedServiceDesc}>{selected.desc}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowServicePicker(true)}
                      activeOpacity={0.85}
                      hitSlop={8}
                    >
                      <Text style={styles.changeServiceLink}>Changer</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()
            ) : (
              <View style={styles.serviceGrid}>
                {serviceTypes.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.serviceItem, serviceType === s.id && styles.serviceSelected, Shadows.sm]}
                    onPress={() => handleServiceSelect(s.id)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={s.gradient} style={styles.serviceIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name={s.icon} size={22} color={Colors.white} />
                    </LinearGradient>
                    <Text style={styles.serviceLabel}>{s.label}</Text>
                    <Text style={styles.serviceDesc}>{s.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {routeLate && serviceType ? (
              <View style={styles.selectedServiceHint}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.selectedServiceHintText}>
                  Ensuite : le détail du besoin, puis seulement à la fin le retrait, la livraison et le mode de livraison.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {((step === 1 && !routeLate && !!serviceType) || (step === 3 && routeLate)) && (
          <View>
            {step === 3 ? (
              <>
                <Text style={styles.stepTitle}>Trajet et confirmation</Text>
                <Text style={styles.stepSubtitle}>
                  Retrait, livraison, contacts, formule, puis validation.
                </Text>
              </>
            ) : null}
            {serviceType ? (
              <View style={styles.selectedServiceHint}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.selectedServiceHintText}>
                  {routeLate
                    ? 'Indiquez où récupérer et où livrer, puis moto ou voiture si besoin.'
                    : `Renseignez d’abord le retrait et la livraison${needsVehiclePick ? ', puis moto ou voiture' : ''}.`}
                </Text>
              </View>
            ) : null}

            <View
              style={styles.section}
              onLayout={(event) => handleAddressFieldsLayout(event.nativeEvent.layout.y)}
            >
              <Text style={styles.sectionTitle}>Retrait</Text>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Adresse complete *</Text>
                    <AddressInput
                      value={pickup}
                      onChangeText={(text) => {
                        setPickup(text);
                        setPickupCoords(null);
                      }}
                      onSelect={(loc: SenegalLocation) => {
                        setPickup(loc.label);
                        setPickupCoords({ lat: loc.lat, lng: loc.lng });
                      }}
                      onGeoSelect={(addr: GeoAddress) => {
                        setPickup(addr.label);
                        setPickupCoords({ lat: addr.lat, lng: addr.lng });
                      }}
                      onFocus={onFocus}
                      placeholder="Ex: Dakar Plateau, Rue 10"
                      iconColor={Colors.primary}
                      icon="navigate-circle-outline"
                      showLocBtn
                    />
                  </>
                )}
              </FocusableField>
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                deliveryFieldsY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>Livraison</Text>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Adresse complete *</Text>
                    <AddressInput
                      value={delivery}
                      onChangeText={(text) => {
                        setDelivery(text);
                        setDeliveryCoords(null);
                      }}
                      onSelect={(loc: SenegalLocation) => {
                        setDelivery(loc.label);
                        setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                      }}
                      onGeoSelect={(addr: GeoAddress) => {
                        setDelivery(addr.label);
                        setDeliveryCoords({ lat: addr.lat, lng: addr.lng });
                      }}
                      onFocus={onFocus}
                      placeholder="Ex: Almadies, Cite Keur Gorgui"
                      iconColor={Colors.accent}
                      icon="location-outline"
                      showLocBtn
                    />
                  </>
                )}
              </FocusableField>
            </View>

            {needsVehiclePick && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mode de livraison</Text>
                <Text style={styles.label}>Moto ou voiture pour la livraison ? *</Text>
                <View style={{ gap: Spacing.sm }}>
                  {([
                    {
                      id: 'moto' as const,
                      title: 'Moto',
                      desc: 'Colis léger, plus rapide, moins cher',
                      icon: 'bicycle' as const,
                    },
                    {
                      id: 'voiture' as const,
                      title: 'Voiture',
                      desc: 'Colis volumineux / plusieurs sacs',
                      icon: 'car' as const,
                    },
                  ]).map((opt) => {
                    const selected = vehicleMode === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.urgencyCard, selected && styles.urgencySelected, Shadows.sm]}
                        onPress={() => setVehicleMode(opt.id)}
                        activeOpacity={0.88}
                      >
                        <View style={[styles.urgencyIcon, { backgroundColor: withAlpha(selected ? Colors.primary : Colors.gray400, 0.12) }]}>
                          <Ionicons name={opt.icon} size={22} color={selected ? Colors.primary : Colors.gray500} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.urgencyLabel}>{opt.title}</Text>
                          <Text style={styles.urgencyDesc}>{opt.desc}</Text>
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selected ? Colors.primary : Colors.gray300}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {(() => {
              const pc = resolveCoords(pickup, pickupCoords);
              const dc = resolveCoords(delivery, deliveryCoords);
              const readyCoords = !!pc && !!dc;
              const readyVehicle = !needsVehiclePick || !!vehicleMode;
              const hasAddressText = pickup.trim().length > 2 && delivery.trim().length > 2;

              if (!readyCoords) {
                if (hasAddressText) {
                  return (
                    <View style={styles.quoteHint}>
                      <Ionicons name="location-outline" size={16} color={Colors.gray500} />
                      <Text style={styles.quoteHintText}>
                        Sélectionnez chaque adresse dans la liste (ou GPS) pour calculer le vrai prix du trajet.
                      </Text>
                    </View>
                  );
                }
                return null;
              }
              if (!readyVehicle) {
                return (
                  <View style={styles.quoteHint}>
                    <Ionicons name="car-outline" size={16} color={Colors.gray500} />
                    <Text style={styles.quoteHintText}>Choisissez moto ou voiture pour voir le prix.</Text>
                  </View>
                );
              }
              const standardPrice = formulaPrices.standard ?? estimatedPrice;
              return (
                <View style={[styles.quoteCard, Shadows.md]}>
                  <View style={styles.quoteTop}>
                    <View style={styles.quoteIconWrap}>
                      <Ionicons
                        name={vehicleMode === 'voiture' ? 'car' : vehicleMode === 'moto' ? 'bicycle' : 'navigate'}
                        size={22}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quoteTitle}>Estimation du trajet</Text>
                      <Text style={styles.quoteMeta}>
                        {estimating
                          ? 'Calcul en cours…'
                          : [
                              quoteDistanceKm != null ? `${quoteDistanceKm} km` : null,
                              quoteDurationMin != null ? `~${quoteDurationMin} min` : null,
                              vehicleMode === 'voiture' ? 'Voiture' : vehicleMode === 'moto' ? 'Moto' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Itinéraire'}
                      </Text>
                    </View>
                    <View style={styles.quotePriceWrap}>
                      <Text style={styles.quotePrice}>
                        {estimating || standardPrice == null
                          ? '…'
                          : `${Number(standardPrice).toLocaleString('fr-FR')} F`}
                      </Text>
                      <Text style={styles.quotePriceHint}>Standard</Text>
                    </View>
                  </View>
                  {!estimating && (formulaPrices.groupe != null || formulaPrices.express != null) && (
                    <View style={styles.quoteFormulas}>
                      {formulaPrices.groupe != null && (
                        <Text style={styles.quoteFormulaLine}>
                          Groupé · {Number(formulaPrices.groupe).toLocaleString('fr-FR')} F
                        </Text>
                      )}
                      {formulaPrices.express != null && (
                        <Text style={styles.quoteFormulaLine}>
                          Express · {Number(formulaPrices.express).toLocaleString('fr-FR')} F
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.quoteNote}>
                    Prix selon l’itinéraire carte. Vérifiez les km : s’ils sont trop élevés, resélectionnez les adresses.
                  </Text>
                </View>
              );
            })()}

            <TouchableOpacity style={styles.compactAction} onPress={() => setShowRouteDetails((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.compactActionText}>{showRouteDetails ? 'Masquer les precisions de trajet' : 'Ajouter des precisions de trajet'}</Text>
              <Ionicons name={showRouteDetails ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            {showRouteDetails && (
              <View style={styles.section}>
                {showExtraPickupMeta && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Repere / Immeuble / Etage</Text>
                    <View style={styles.inputBox}>
                      <TextInput style={styles.input} placeholder="Ex: Immeuble A, 3e etage" value={pickupFloor} onChangeText={setPickupFloor} placeholderTextColor={Colors.gray400} />
                    </View>
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.label}>Instructions d'acces au retrait</Text>
                  <View style={[styles.inputBox, styles.textArea]}>
                    <TextInput style={styles.textAreaInput} placeholder="Digicode, gardien, entree..." value={pickupAccess} onChangeText={setPickupAccess} multiline numberOfLines={3} placeholderTextColor={Colors.gray400} />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Instructions d'acces a la livraison</Text>
                  <View style={[styles.inputBox, styles.textArea]}>
                    <TextInput style={styles.textAreaInput} placeholder="Etage, repere, consigne..." value={deliveryAccess} onChangeText={setDeliveryAccess} multiline numberOfLines={3} placeholderTextColor={Colors.gray400} />
                  </View>
                </View>
              </View>
            )}

            {pickup.trim() && delivery.trim() && step === 1 && (
              <View style={styles.infoBanner}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.info} />
                <Text style={styles.infoText}>Le prix indicatif apparaîtra à la confirmation dès que les adresses sont valides.</Text>
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>
              {isAdminService ? 'Documents à traiter' : 'Essentiel du besoin'}
            </Text>
            <Text style={styles.stepSubtitle}>
              {isAdminService
                ? 'Choisissez un ou plusieurs papiers, ou « Autres » si le document n’est pas listé.'
                : 'On ne vous demande ici que les informations utiles au cas choisi.'}
            </Text>

            <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details du service</Text>
            <ServiceDetailsFields
              serviceType={serviceType}
              details={serviceDetails}
              onChange={setServiceDetails}
              procedures={isAdminService ? procedures : []}
              selectedProcedures={selectedProcedures}
              onChangeSelectedProcedures={setSelectedProcedures}
              otherProcedureEnabled={otherProcedureEnabled}
              otherProcedureText={otherProcedureText}
              onChangeOtherProcedure={(enabled, text) => {
                setOtherProcedureEnabled(enabled);
                setOtherProcedureText(text);
              }}
              onFieldFocus={ensureFocusedVisible}
            />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            {!routeLate ? (
              <>
                <Text style={styles.stepTitle}>Contacts et confirmation</Text>
                <Text style={styles.stepSubtitle}>Dernière étape : contacts, formule puis validation.</Text>
              </>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact de retrait</Text>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Nom et prenom *</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="person-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Nom complet" value={pickupContactName} onChangeText={setPickupContactName} onFocus={onFocus} placeholderTextColor={Colors.gray400} />
                    </View>
                  </>
                )}
              </FocusableField>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Telephone principal *</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="call-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="+221 77 ..." value={pickupContactPhone} onChangeText={setPickupContactPhone} onFocus={onFocus} keyboardType="phone-pad" placeholderTextColor={Colors.gray400} />
                    </View>
                  </>
                )}
              </FocusableField>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact de livraison</Text>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Nom et prenom *</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="person-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Nom complet" value={deliveryContactName} onChangeText={setDeliveryContactName} onFocus={onFocus} placeholderTextColor={Colors.gray400} />
                    </View>
                  </>
                )}
              </FocusableField>
              <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                {(onFocus) => (
                  <>
                    <Text style={styles.label}>Telephone principal *</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="call-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="+221 77 ..." value={deliveryContactPhone} onChangeText={setDeliveryContactPhone} onFocus={onFocus} keyboardType="phone-pad" placeholderTextColor={Colors.gray400} />
                    </View>
                  </>
                )}
              </FocusableField>
            </View>

            <TouchableOpacity style={styles.compactAction} onPress={() => setShowExtraContacts((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.compactActionText}>{showExtraContacts ? 'Masquer les options de contact' : 'Ajouter des options de contact'}</Text>
              <Ionicons name={showExtraContacts ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            {showExtraContacts && (
              <View style={styles.section}>
                <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                  {(onFocus) => (
                    <>
                      <Text style={styles.label}>Telephone secondaire retrait</Text>
                      <View style={styles.inputBox}>
                        <Ionicons name="call-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="+221 70 ..." value={pickupContactPhone2} onChangeText={setPickupContactPhone2} onFocus={onFocus} keyboardType="phone-pad" placeholderTextColor={Colors.gray400} />
                      </View>
                    </>
                  )}
                </FocusableField>
                <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                  {(onFocus) => (
                    <>
                      <Text style={styles.label}>Telephone secondaire livraison</Text>
                      <View style={styles.inputBox}>
                        <Ionicons name="call-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="+221 70 ..." value={deliveryContactPhone2} onChangeText={setDeliveryContactPhone2} onFocus={onFocus} keyboardType="phone-pad" placeholderTextColor={Colors.gray400} />
                      </View>
                    </>
                  )}
                </FocusableField>
              </View>
            )}

            <Text style={[styles.stepTitle, { marginTop: Spacing.lg }]}>Date et heure souhaitees</Text>
            {timingOptions.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.urgencyCard, timingMode === t.id && styles.urgencySelected, Shadows.sm]}
                onPress={() => {
                  setTimingMode(t.id);
                  if (t.id === 'programme') setShowDatePicker(true);
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.urgencyIcon, timingMode === t.id && styles.urgencyIconSelected]}>
                  <Ionicons name={t.icon} size={22} color={timingMode === t.id ? Colors.primary : Colors.gray400} />
                </View>
                <View style={styles.urgencyInfo}>
                  <Text style={styles.urgencyLabel}>{t.label}</Text>
                  <Text style={styles.urgencyDesc}>{t.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {timingMode === 'programme' && (
              <TouchableOpacity
                style={[styles.datePickerBtn, Shadows.sm]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.85}
              >
                <View style={styles.datePickerIcon}>
                  <Ionicons name="calendar" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.datePickerLabel}>Date et heure</Text>
                  <Text style={styles.datePickerValue}>
                    {scheduledDate
                      ? scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                      : 'Choisir une date'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            )}

            {isAdminService ? (
              <>
                <Text style={[styles.stepTitle, { marginTop: Spacing.lg }]}>Prestataire démarches</Text>
                <Text style={styles.infoText}>Le tarif affiché est celui du prestataire. Les frais officiels s’ajoutent, sans commission Bag’up.</Text>
                {demarchesProviders.length === 0 ? (
                  <Text style={styles.infoText}>Aucun prestataire démarches disponible pour le moment.</Text>
                ) : demarchesProviders.map((p) => {
                  const selected = selectedDemarchesProviderId === p.id;
                  const fee = Number(p.demarchesServiceFee || 0);
                  const official = officialFeesTotal;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.urgencyCard, selected && styles.urgencySelected, Shadows.sm]}
                      onPress={() => setSelectedDemarchesProviderId(p.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.urgencyIcon, selected && styles.urgencyIconSelected]}>
                        <Ionicons name="briefcase" size={22} color={selected ? Colors.primary : Colors.gray400} />
                      </View>
                      <View style={styles.urgencyInfo}>
                        <Text style={styles.urgencyLabel}>{p.firstName} {p.lastName}</Text>
                        <Text style={styles.urgencyDesc}>Honoraires {fee.toLocaleString('fr-FR')} · total {(fee + official).toLocaleString('fr-FR')} FCFA</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : null}

            {!isAdminService ? (
            <>
            <Text style={[styles.stepTitle, { marginTop: Spacing.lg }]}>Formule de livraison</Text>
            {formulaOptions.map((u) => {
              const price = formulaPrices[u.id];
              const priceLabel = estimating && price == null
                ? '...'
                : price != null
                  ? `${price.toLocaleString('fr-FR')} FCFA`
                  : '—';
              return (
              <TouchableOpacity
                key={u.id}
                style={[styles.urgencyCard, urgencyLevel === u.id && styles.urgencySelected, Shadows.sm]}
                onPress={() => {
                  setUrgencyLevel(u.id);
                  if (price != null) setEstimatedPrice(price);
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.urgencyIcon, urgencyLevel === u.id && styles.urgencyIconSelected]}>
                  <Ionicons name={u.icon} size={22} color={urgencyLevel === u.id ? Colors.primary : Colors.gray400} />
                </View>
                <View style={styles.urgencyInfo}>
                  <Text style={styles.urgencyLabel}>{u.label}</Text>
                  <Text style={styles.urgencyDesc}>{u.desc}</Text>
                </View>
                <Text style={styles.urgencyPrice}>{priceLabel}</Text>
              </TouchableOpacity>
            );})}
            </>
            ) : null}

            {(isAdminService ? timingMode && !!selectedDemarchesProviderId : timingMode && urgencyLevel) && (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                <Text style={styles.infoText}>Tarif indicatif jusqu'au paiement — montant ferme confirmé au moment du règlement.</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.compactAction, { marginTop: Spacing.sm }]} onPress={() => setShowAdditionalRequestInfo((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.compactActionText}>{showAdditionalRequestInfo ? 'Masquer les precisions' : 'Ajouter des precisions utiles'}</Text>
              <Ionicons name={showAdditionalRequestInfo ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            {showAdditionalRequestInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description complementaire</Text>
                <View style={[styles.inputBox, styles.textArea]}>
                  <TextInput style={styles.textAreaInput} placeholder="Details complementaires (optionnel)" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor={Colors.gray400} />
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.compactAction} onPress={() => setShowPhotoSection((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.compactActionText}>
                {showPhotoSection
                  ? 'Masquer les photos / scans'
                  : requiresSecurityProof || requiresAdminDocs
                    ? 'Ajouter les photos requises'
                    : 'Ajouter des photos / scans'}
              </Text>
              <Ionicons name={showPhotoSection ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            {(showPhotoSection || requiresSecurityProof || requiresAdminDocs) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Photos / scans{' '}
                  {requiresAdminDocs
                    ? '(obligatoire — documents de la démarche)'
                    : requiresSecurityProof
                      ? '(obligatoire > 50 000 FCFA)'
                      : '(optionnel)'}
                </Text>
                <View style={styles.photoRow}>
                  {photoUris.map((uri, i) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoImg} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUris(photoUris.filter((_, idx) => idx !== i))}>
                        <Ionicons name="close-circle" size={18} color={Colors.accent} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={24} color={Colors.gray400} />
                    <Text style={styles.photoAddText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
                {requiresAdminDocs && (
                  <View style={styles.infoBanner}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.warning} />
                    <Text style={styles.infoText}>
                      Scannez les pièces utiles (CNI, formulaire, récépissé…). Cela aide le commissionnaire / prestataire sur place.
                    </Text>
                  </View>
                )}
                {requiresSecurityProof && (
                  <View style={styles.infoBanner}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={Colors.warning} />
                    <Text style={styles.infoText}>
                      Pour un colis / objet au-dessus de 50 000 FCFA, une photo est requise et un code de remise sera genere automatiquement.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.compactAction} onPress={() => setShowThirdPartySection((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.compactActionText}>{showThirdPartySection ? 'Masquer la remise a un tiers' : 'Configurer une remise a un tiers / GP'}</Text>
              <Ionicons name={showThirdPartySection ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray500} />
            </TouchableOpacity>

            {showThirdPartySection && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Remise a un tiers / GP</Text>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setRemiseTiers(!remiseTiers)} activeOpacity={0.8}>
                  <Ionicons name={remiseTiers ? 'checkbox' : 'square-outline'} size={22} color={remiseTiers ? Colors.primary : Colors.gray400} />
                  <Text style={styles.checkboxLabel}>Activer la remise a un tiers / diaspora</Text>
                </TouchableOpacity>

                {remiseTiers && (
                  <View style={styles.recipientSection}>
                    <View style={styles.field}>
                      <Text style={styles.label}>Relation avec le destinataire *</Text>
                      <View style={styles.inputBox}>
                        <Ionicons name="people-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="Ex: Famille, ami, GP..." value={recipientRelation} onChangeText={setRecipientRelation} placeholderTextColor={Colors.gray400} />
                      </View>
                    </View>
                    <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                      {(onFocus) => (
                        <>
                          <Text style={styles.label}>Adresse de remise</Text>
                          <AddressInput
                            value={recipientAddress}
                            onChangeText={setRecipientAddress}
                            onSelect={(loc: SenegalLocation) => setClientCountry(loc.country)}
                            onFocus={onFocus}
                            placeholder="Domicile, aeroport, lieu de RDV..."
                            iconColor={Colors.gray400}
                            icon="location-outline"
                          />
                        </>
                      )}
                    </FocusableField>
                    <FocusableField style={styles.field} onEnsureVisible={ensureFocusedVisible}>
                      {(onFocus) => (
                        <>
                          <Text style={styles.label}>Pays de residence</Text>
                          <AddressInput
                            value={clientCountry}
                            onChangeText={setClientCountry}
                            onSelect={(loc: SenegalLocation) => setClientCountry(loc.country || loc.label)}
                            onFocus={onFocus}
                            placeholder="Ex: France, USA, Italie..."
                            iconColor={Colors.gray400}
                            icon="globe-outline"
                            placesCountry={null}
                          />
                        </>
                      )}
                    </FocusableField>
                    <View style={styles.infoBanner}>
                      <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                      <Text style={styles.infoText}>Un code de remise unique sera genere et envoye par SMS.</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {(isAdminService ? timingMode && !!selectedDemarchesProviderId : timingMode && urgencyLevel) && (() => {
              const selectedService = serviceTypes.find((s) => s.id === serviceType);
              const subLabel = serviceDisplayLabel(effectiveServiceType, serviceDetails);
              const selectedUrgency = formulaOptions.find(u => u.id === urgencyLevel);
              const chosenProvider = demarchesProviders.find((p) => p.id === selectedDemarchesProviderId);
              const serviceFee = isAdminService ? Number(chosenProvider?.demarchesServiceFee || 0) : 0;
              const basePrice = isAdminService ? serviceFee : (estimatedPrice ?? formulaPrices[urgencyLevel] ?? 0);
              const adminFee = isAdminService ? officialFeesTotal : 0;
              const total = basePrice + adminFee;
              return (
                <View style={[styles.summary, Shadows.md]}>
                  <LinearGradient colors={Colors.gradientPrimary} style={styles.summaryHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.summaryHeaderIcon}>
                      <Ionicons name={selectedService?.icon || 'cube'} size={20} color={Colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryHeaderTitle}>{selectedService?.label || 'Service'}</Text>
                      <Text style={styles.summaryHeaderSub}>
                        {subLabel !== selectedService?.label ? `${subLabel} · ` : ''}
                        {timingMode === 'programme' ? 'Programmé' : 'Immédiat'} · {selectedUrgency?.label}
                      </Text>
                    </View>
                  </LinearGradient>

                  <View style={styles.summaryBody}>
                    <View style={styles.summaryRow}>
                      <Ionicons name="navigate-circle-outline" size={14} color={Colors.primary} style={styles.summaryRowIcon} />
                      <Text style={styles.summaryKey}>Récupération</Text>
                      <Text style={styles.summaryVal} numberOfLines={1}>{pickup || '-'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Ionicons name="person-outline" size={14} color={Colors.primary} style={styles.summaryRowIcon} />
                      <Text style={styles.summaryKey}>Contact retrait</Text>
                      <Text style={styles.summaryVal} numberOfLines={1}>{pickupContactName} · {pickupContactPhone}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.accent} style={styles.summaryRowIcon} />
                      <Text style={styles.summaryKey}>Livraison</Text>
                      <Text style={styles.summaryVal} numberOfLines={1}>{delivery || '-'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Ionicons name="person-outline" size={14} color={Colors.accent} style={styles.summaryRowIcon} />
                      <Text style={styles.summaryKey}>Contact livraison</Text>
                      <Text style={styles.summaryVal} numberOfLines={1}>{deliveryContactName} · {deliveryContactPhone}</Text>
                    </View>

                    {timingMode === 'programme' && scheduledDate && (
                      <View style={styles.summaryRow}>
                        <Ionicons name="calendar-outline" size={14} color={Colors.primary} style={styles.summaryRowIcon} />
                        <Text style={styles.summaryKey}>Programmé</Text>
                        <Text style={styles.summaryVal} numberOfLines={1}>
                          {scheduledDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}

                    {isAdminService && hasAdminDocsSelection && (
                      <View style={styles.summarySection}>
                        <View style={styles.summaryDivider} />
                        <Text style={styles.summarySubTitle}>Démarche administrative</Text>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryKey}>Documents</Text>
                          <Text style={styles.summaryVal} numberOfLines={3}>{adminProcedureTypeLabel}</Text>
                        </View>
                        {adminOrganismLabel ? (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryKey}>Organisme(s)</Text>
                            <Text style={styles.summaryVal} numberOfLines={2}>{adminOrganismLabel}</Text>
                          </View>
                        ) : null}
                        {chosenProvider ? (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryKey}>Prestataire</Text>
                            <Text style={styles.summaryVal} numberOfLines={1}>{chosenProvider.firstName} {chosenProvider.lastName}</Text>
                          </View>
                        ) : null}
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryKey}>Honoraires</Text>
                          <Text style={styles.summaryVal}>{serviceFee.toLocaleString()} FCFA</Text>
                        </View>
                        {adminFee > 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryKey}>Frais officiels</Text>
                            <Text style={styles.summaryVal}>{adminFee.toLocaleString()} FCFA</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.summaryTotal}>
                      <View style={styles.summaryTotalLeft}>
                        <Ionicons name="pricetag" size={16} color={Colors.primary} />
                        <Text style={styles.summaryTotalLabel}>Total estimé</Text>
                      </View>
                      <Text style={styles.summaryTotalVal}>{estimating ? '...' : `${total.toLocaleString()} FCFA`}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <TouchableOpacity style={[styles.checkboxRow, { marginTop: Spacing.lg }]} onPress={() => setAcceptCgu(!acceptCgu)} activeOpacity={0.8}>
              <Ionicons name={acceptCgu ? 'checkbox' : 'square-outline'} size={22} color={acceptCgu ? Colors.primary : Colors.gray400} />
              <Text style={styles.checkboxLabel}>
                J'accepte les{' '}
                <Text
                  style={styles.cguLink}
                  onPress={() => navigation?.navigate?.('TermsOfService')}
                >
                  conditions générales d'utilisation
                </Text>
                {' '}*
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          footerHeightRef.current = h;
          setFooterHeight(h);
        }}
      >
        <Button title={step === 3 ? 'Confirmer la demande' : 'Continuer'} onPress={handleNext} loading={loading} fullWidth />
      </View>
      </KeyboardAvoidingView>

      {/* Modal de sélection de date pour le mode programmé */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalContent}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>Choisir la date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.dateModalSubtitle}>Sélectionnez le jour de collecte</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateOptionsScroll}>
              {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                const date = new Date();
                date.setDate(date.getDate() + dayOffset);
                const isSelected = scheduledDate?.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity
                    key={dayOffset}
                    style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                    onPress={() => {
                      const newDate = new Date(date);
                      if (scheduledDate) {
                        newDate.setHours(scheduledDate.getHours(), scheduledDate.getMinutes());
                      } else {
                        newDate.setHours(10, 0);
                      }
                      setScheduledDate(newDate);
                    }}
                  >
                    <Text style={[styles.dateOptionDay, isSelected && styles.dateOptionTextSelected]}>
                      {dayOffset === 0 ? "Auj." : dayOffset === 1 ? "Dem." : date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateOptionNum, isSelected && styles.dateOptionTextSelected]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[styles.dateOptionMonth, isSelected && styles.dateOptionTextSelected]}>
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.dateModalSubtitle, { marginTop: Spacing.lg }]}>Sélectionnez l'heure</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateOptionsScroll}>
              {['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => {
                const [h, m] = time.split(':').map(Number);
                const isSelected = scheduledDate?.getHours() === h && scheduledDate?.getMinutes() === m;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeOption, isSelected && styles.dateOptionSelected]}
                    onPress={() => {
                      const newDate = scheduledDate ? new Date(scheduledDate) : new Date();
                      newDate.setHours(h, m, 0, 0);
                      setScheduledDate(newDate);
                    }}
                  >
                    <Text style={[styles.timeOptionText, isSelected && styles.dateOptionTextSelected]}>{time}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.dateModalBtn, !scheduledDate && styles.dateModalBtnDisabled]}
              onPress={() => scheduledDate && setShowDatePicker(false)}
              disabled={!scheduledDate}
            >
              <Text style={styles.dateModalBtnText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadows.xs },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  stepPill: {
    marginTop: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  stepPillText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  headerStepLabel: {
    marginTop: 4,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    textAlign: 'center',
  },
  progress: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  progressBar: { flex: 1, height: 4, backgroundColor: Colors.gray200, borderRadius: 2 },
  progressActive: { backgroundColor: Colors.primary, height: 4 },
  formArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  stepTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900, marginBottom: Spacing.base },
  stepSubtitle: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500, marginBottom: Spacing.lg, lineHeight: 20 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
    overflow: 'visible',
  },
  field: { marginBottom: Spacing.md, zIndex: 1 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.md },
  serviceItem: { width: '47%', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  serviceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  serviceIcon: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm, ...Shadows.sm },
  serviceLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  serviceDesc: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2, textAlign: 'center' },
  selectedServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  selectedServiceIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedServiceLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  selectedServiceDesc: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  changeServiceLink: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  selectedServiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  selectedServiceHintText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    lineHeight: 18,
  },
  label: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray600, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    minHeight: 48,
    paddingHorizontal: 4,
  },
  inputIcon: { marginLeft: Spacing.md },
  input: { flex: 1, paddingHorizontal: Spacing.sm, paddingVertical: 12, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  locBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  textArea: { minHeight: 88, alignItems: 'flex-start', paddingVertical: 4 },
  textAreaInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900, textAlignVertical: 'top' },
  urgencyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray200 },
  urgencySelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  urgencyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  urgencyIconSelected: { backgroundColor: Colors.white },
  urgencyInfo: { flex: 1 },
  urgencyLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  urgencyDesc: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 2 },
  urgencyPrice: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.primary },
  summary: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, marginTop: Spacing.lg, overflow: 'hidden' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: 12 },
  summaryHeaderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  summaryHeaderTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  summaryHeaderSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.white, opacity: 0.85, marginTop: 2 },
  summaryBody: { padding: Spacing.base },
  summaryDivider: { height: 1, backgroundColor: Colors.gray200, marginVertical: Spacing.sm },
  summarySubTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.primary, marginTop: Spacing.xs, marginBottom: 4 },
  summarySection: { marginTop: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 6 },
  summaryRowIcon: { marginRight: 2 },
  summaryKey: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500, flex: 1 },
  summaryVal: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray900, maxWidth: '50%', textAlign: 'right' },
  summaryTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: Colors.gray200, marginTop: Spacing.md, paddingTop: Spacing.base },
  summaryTotalLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTotalLabel: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  summaryTotalVal: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.primary },
  summaryNote: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 4, textAlign: 'center' },
  quoteCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: withAlpha(Colors.primary, 0.15),
  },
  quoteTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quoteIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(Colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  quoteMeta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  quotePriceWrap: { alignItems: 'flex-end' },
  quotePrice: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.primary,
  },
  quotePriceHint: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 10,
    color: Colors.gray400,
    marginTop: 1,
  },
  quoteFormulas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  quoteFormulaLine: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray600,
  },
  quoteNote: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  quoteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
  },
  quoteHintText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.gray200,
  },
  adminSection: { marginTop: Spacing.md },
  adminSubtitle: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginBottom: Spacing.md },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, textAlign: 'center', paddingVertical: Spacing.md },
  procedureCategory: { marginBottom: Spacing.lg },
  procedureCategoryTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.sm, color: Colors.primary, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  procedureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.base, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.gray200 },
  procedureSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  procedureName: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  procedureOrg: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: 2 },
  procedureIntervention: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.primary, marginTop: 2 },
  procedureMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  procedureFeeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: withAlpha(Colors.warning, 0.12), paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  procedureFeeText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.warning },
  procedureDelayBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: withAlpha(Colors.info, 0.12), paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  procedureDelayText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.info },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  photoThumb: { width: 72, height: 72, borderRadius: BorderRadius.md, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 2, right: 2 },
  photoAdd: { width: 72, height: 72, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.gray200, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray50 },
  photoAddText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
  checkboxLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray700, flex: 1 },
  cguLink: { color: Colors.primary, textDecorationLine: 'underline', fontFamily: Typography.fontFamily.dmSans.semiBold },
  recipientSection: { marginTop: Spacing.sm },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: BorderRadius.md, padding: Spacing.md },
  infoText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray600, lineHeight: 18 },
  compactAction: {
    minHeight: 48,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  compactActionText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary },
  datePickerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(Colors.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  datePickerLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  datePickerValue: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginTop: 2 },
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  dateModalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius['2xl'], borderTopRightRadius: BorderRadius['2xl'], padding: Spacing.lg, paddingBottom: 40 },
  dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  dateModalTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900 },
  dateModalSubtitle: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray600, marginBottom: Spacing.md },
  dateOptionsScroll: { marginBottom: Spacing.sm },
  dateOption: { width: 70, height: 80, backgroundColor: Colors.gray100, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  dateOptionSelected: { backgroundColor: Colors.primary },
  dateOptionDay: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  dateOptionNum: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900, marginVertical: 2 },
  dateOptionMonth: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  dateOptionTextSelected: { color: Colors.white },
  timeOption: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.gray100, borderRadius: BorderRadius.lg, marginRight: Spacing.sm },
  timeOptionText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray700 },
  dateModalBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.lg },
  dateModalBtnDisabled: { backgroundColor: Colors.gray300 },
  dateModalBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
});
