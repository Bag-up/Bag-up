import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { missingRideIdentityFields } from '../../constants/vehicle';
import { isDemarchesProvider } from '../../constants/demarches';
import { api } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { getCurrentPosition } from '../../services/location';

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Mission attribuée',
  en_route: 'En route',
  picked_up: 'Collecte effectuée',
  in_progress: 'Livraison en cours',
  delivered: 'Livraison effectuée',
  cancelled: 'Annulée',
  searching: 'Recherche',
  assigned: 'Course assignée',
  driver_en_route: 'En route (client)',
  driver_arrived: 'Arrivé au départ',
  completed: 'Course terminée',
  // Démarches administratives
  dossier_deposed: 'Dossier déposé',
  admin_processing: 'En attente de traitement',
  document_ready: 'Document disponible',
  document_collected: 'Document retiré',
  returned_to_client: 'Restitué au client',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: Colors.warningSoft, text: Colors.warning },
  accepted: { bg: Colors.infoSoft, text: Colors.info },
  en_route: { bg: Colors.infoSoft, text: Colors.info },
  picked_up: { bg: Colors.infoSoft, text: Colors.info },
  in_progress: { bg: Colors.infoSoft, text: Colors.info },
  delivered: { bg: Colors.successSoft, text: Colors.success },
  cancelled: { bg: Colors.accentSoft, text: Colors.accent },
  searching: { bg: Colors.warningSoft, text: Colors.warning },
  assigned: { bg: Colors.infoSoft, text: Colors.info },
  driver_en_route: { bg: Colors.infoSoft, text: Colors.info },
  driver_arrived: { bg: Colors.infoSoft, text: Colors.primary },
  completed: { bg: Colors.successSoft, text: Colors.success },
  dossier_deposed: { bg: Colors.infoSoft, text: Colors.info },
  admin_processing: { bg: Colors.warningSoft, text: Colors.warning },
  document_ready: { bg: Colors.successSoft, text: Colors.success },
  document_collected: { bg: Colors.infoSoft, text: Colors.info },
  returned_to_client: { bg: Colors.successSoft, text: Colors.success },
};

const adminServiceTypes = ['administratif', 'depot_administratif'];

function mapDriverRide(r: any) {
  return {
    ...r,
    kind: 'ride' as const,
    serviceType: 'course',
    deliveryAddress: r.dropoffAddress,
    price: r.finalPrice ?? r.estimatedPrice,
    passengerName: r.passenger?.firstName || 'Passager',
    passengerPhone: r.passenger?.phone || null,
  };
}

const PAST_STATUSES = ['delivered', 'cancelled', 'returned_to_client', 'completed'];
const RIDE_ACTIVE = ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'];

const getNextStatus = (mission: any): { status: string; label: string } | null => {
  if (mission?.kind === 'ride') {
    const rideNext: Record<string, { status: string; label: string } | null> = {
      assigned: { status: 'driver_en_route', label: 'En route' },
      driver_en_route: { status: 'driver_arrived', label: 'Arrivé' },
      driver_arrived: { status: 'in_progress', label: 'Démarrer' },
      in_progress: { status: 'completed', label: 'Terminer' },
    };
    return rideNext[mission?.status] ?? null;
  }
  if (adminServiceTypes.includes(mission?.serviceType)) {
    const adminNext: Record<string, { status: string; label: string } | null> = {
      accepted: { status: 'dossier_deposed', label: 'Dossier déposé' },
      dossier_deposed: { status: 'admin_processing', label: 'En traitement' },
      admin_processing: { status: 'document_ready', label: 'Doc. prêt' },
      document_ready: { status: 'document_collected', label: 'Doc. retiré' },
      document_collected: { status: 'returned_to_client', label: 'Restituer' },
      returned_to_client: null,
      pending: null,
      cancelled: null,
    };
    return adminNext[mission?.status] ?? null;
  }
  const deliveryNext: Record<string, { status: string; label: string } | null> = {
    accepted: { status: 'en_route', label: 'En route' },
    en_route: { status: 'picked_up', label: 'Collecté' },
    picked_up: { status: 'in_progress', label: 'Livraison' },
    in_progress: { status: 'delivered', label: 'Livré' },
    delivered: null,
    pending: null,
    cancelled: null,
  };
  return deliveryNext[mission?.status] ?? null;
};

export const ProviderMissionsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { token, user } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [availableMissions, setAvailableMissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [codeModal, setCodeModal] = useState<{ missionId: string; status: string } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [feeModal, setFeeModal] = useState<{ missionId: string; reason: 'admin_fee' | 'bill_payment' } | null>(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeReceiptUri, setFeeReceiptUri] = useState<string | null>(null);
  const [submittingFee, setSubmittingFee] = useState(false);
  const [focusRideId, setFocusRideId] = useState<string | null>(null);

  const pickReceipt = async () => {
    const uri = await pickImageFromLibrary({ quality: 0.7 });
    if (uri) setFeeReceiptUri(uri);
  };

  const submitFeeReceipt = async () => {
    if (!feeModal || !token) return;
    const amount = parseInt(feeAmount, 10);
    if (!amount || amount <= 0) { Alert.alert('Montant requis', feeModal.reason === 'bill_payment' ? 'Saisissez le montant payé sur facture.' : 'Saisissez le montant des frais avancés.'); return; }
    if (!feeReceiptUri) { Alert.alert('Justificatif requis', feeModal.reason === 'bill_payment' ? 'Ajoutez une photo de la facture ou du reçu.' : 'Ajoutez une photo du reçu.'); return; }
    setSubmittingFee(true);
    try {
      const res = await api.uploads.upload({ uri: feeReceiptUri, type: 'image/jpeg', name: `receipt-${Date.now()}.jpg` }, token);
      await api.missions.submitAdminFeeReceipt(feeModal.missionId, amount, res.url, token);
      Alert.alert(
        'Envoyé',
        feeModal.reason === 'bill_payment'
          ? 'Preuve de facture transmise. Vous pouvez maintenant clôturer la course.'
          : 'Justificatif transmis. Le client sera notifié pour le remboursement.',
      );
      setFeeModal(null);
      setFeeAmount('');
      setFeeReceiptUri(null);
      fetchMissions();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Échec de l\'envoi du justificatif');
    } finally {
      setSubmittingFee(false);
    }
  };

  const fetchMissions = useCallback(async () => {
    if (!token) return;
    try {
      const demarches = isDemarchesProvider(user);
      const [data, rides] = await Promise.all([
        api.missions.provider(token),
        demarches ? Promise.resolve([]) : api.rides.driver(token),
      ]);
      const rideItems = (Array.isArray(rides) ? rides : []).map(mapDriverRide);
      setMissions([...(Array.isArray(data) ? data : []), ...rideItems]);
    } catch (e) {
      console.error('ProviderMissions fetch error:', e);
    }
  }, [token, user]);

  const fetchAvailable = useCallback(async () => {
    if (!token) return;
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
        setMyCoords(pos);
      } catch {}
      const demarches = isDemarchesProvider(user);
      const [data, rides] = await Promise.all([
        api.missions.available(token, undefined, lat, lng, 20),
        demarches ? Promise.resolve([]) : api.rides.available(token, lat, lng, 20),
      ]);
      const rideItems = (Array.isArray(rides) ? rides : []).map((r: any) => ({
        ...mapDriverRide(r),
        distanceKm: r.offerDistanceKm ?? r.distanceKm,
        offerExpiresAt: r.offerExpiresAt,
        isExclusiveOffer: r.isExclusiveOffer,
      }));
      setAvailableMissions([...(Array.isArray(data) ? data : []), ...rideItems]);
    } catch (e) {
      console.error('fetchAvailable error:', e);
    }
  }, [token, user]);

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
      fetchAvailable();
      const interval = setInterval(() => {
        fetchMissions();
        fetchAvailable();
      }, 4000);
      return () => clearInterval(interval);
    }, [fetchMissions, fetchAvailable])
  );

  useEffect(() => {
    const id = route.params?.focusRideId as string | undefined;
    if (!id) return;
    setFocusRideId(id);
    fetchMissions();
    fetchAvailable();
    navigation?.setParams?.({ focusRideId: undefined });
  }, [route.params?.focusRideId, fetchMissions, fetchAvailable, navigation]);

  // Send provider GPS location periodically for active missions
  useFocusEffect(
    useCallback(() => {
      const sendLocation = async () => {
        if (!token) return;
        try {
          const activeMissionsGps = missions.filter(
            (m) =>
              m.kind !== 'ride' &&
              ['accepted', 'en_route', 'picked_up', 'in_progress'].includes(m.status),
          );
          const activeRidesGps = missions.filter(
            (m) =>
              m.kind === 'ride' &&
              ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(m.status),
          );
          if (activeMissionsGps.length === 0 && activeRidesGps.length === 0) return;
          const { lat, lng } = await getCurrentPosition();
          for (const m of activeMissionsGps) {
            api.missions.updateLocation(m.id, lat, lng, token).catch(() => {});
          }
          for (const r of activeRidesGps) {
            api.rides.updateLocation(r.id, lat, lng, token).catch(() => {});
          }
        } catch {}
      };
      sendLocation();
      const locInterval = setInterval(sendLocation, 8000);
      return () => clearInterval(locInterval);
    }, [token, missions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMissions(), fetchAvailable()]);
    setRefreshing(false);
  }, [fetchMissions, fetchAvailable]);

  const handleAccept = async (id: string) => {
    if (!token) return;
    setUpdating(id);
    try {
      const item = availableMissions.find((m) => m.id === id);
      if (item?.kind === 'ride') {
        const missing = missingRideIdentityFields(user);
        if (missing.length) {
          Alert.alert(
            'Profil incomplet',
            `Pour accepter une course, complétez : ${missing.join(', ')}.`,
          );
          return;
        }
        await api.rides.accept(id, token);
        Alert.alert('Succès', 'Course acceptée ! Le client a été notifié.');
      } else {
        await api.missions.accept(id, token);
        Alert.alert('Succès', 'Mission acceptée ! Le client a été notifié.');
      }
      fetchMissions();
      fetchAvailable();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/déjà prise|plus disponible|délai dépassé|ne vous est plus/i.test(msg)) {
        Alert.alert('Course déjà prise', 'Cette course n’est plus disponible.');
        fetchAvailable();
      } else {
        Alert.alert('Erreur', msg || 'Acceptation échouée');
      }
    } finally {
      setUpdating(null);
    }
  };

  // Intercepte les remises finales : exige le code de remise si la mission en possède un
  const requestStatusUpdate = (mission: any, newStatus: string) => {
    if (mission?.kind === 'ride') {
      handleStatusUpdate(mission.id, newStatus);
      return;
    }
    const isFinalRemise = newStatus === 'delivered' || newStatus === 'returned_to_client';
    const isBillPaymentCourse =
      mission?.serviceType === 'courses' &&
      mission?.serviceDetails?.courseMode === 'bill_payment';
    if (isFinalRemise && isBillPaymentCourse && !mission.adminFeeReceiptUrl) {
      setFeeAmount(
        mission?.adminFeeActual
          ? String(mission.adminFeeActual)
          : String(mission?.serviceDetails?.billAmount ?? ''),
      );
      setFeeReceiptUri(null);
      setFeeModal({ missionId: mission.id, reason: 'bill_payment' });
      return;
    }
    if (isFinalRemise && mission.deliveryCode) {
      setCodeInput('');
      setCodeModal({ missionId: mission.id, status: newStatus });
      return;
    }
    handleStatusUpdate(mission.id, newStatus);
  };

  const confirmCodeAndUpdate = () => {
    if (!codeModal) return;
    if (!codeInput.trim()) {
      Alert.alert('Code requis', 'Saisissez le code de remise fourni par le destinataire.');
      return;
    }
    const { missionId, status } = codeModal;
    setCodeModal(null);
    handleStatusUpdate(missionId, status, codeInput.trim());
  };

  const handleStatusUpdate = async (id: string, newStatus: string, code?: string) => {
    if (!token) return;
    setUpdating(id);
    try {
      const item = missions.find((m) => m.id === id);
      if (item?.kind === 'ride') {
        await api.rides.updateStatus(id, newStatus, token);
        Alert.alert('Succès', `Statut mis à jour : ${statusLabels[newStatus] || newStatus}`);
      } else {
        await api.missions.updateStatus(id, newStatus, token, code);
        Alert.alert('Succès', `Statut mis à jour : ${statusLabels[newStatus]}`);
      }
      fetchMissions();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Mise à jour échouée');
    } finally {
      setUpdating(null);
    }
  };

  const handleOpenChat = async (m: any) => {
    if (!token || !user?.id) return;
    try {
      const conv = await api.messages.createConversation(
        { missionId: m.id, clientId: m.clientId, providerId: user.id },
        token,
      );
      navigation?.navigate('Chat', {
        conversationId: conv.id,
        name: `${m.client?.firstName || 'Client'} ${m.client?.lastName || ''}`.trim(),
      });
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'ouvrir la conversation');
    }
  };

  const handleRefuse = async (id: string) => {
    if (!token) return;
    const item = availableMissions.find((m) => m.id === id);
    const isRide = item?.kind === 'ride';
    Alert.alert(
      isRide ? 'Refuser cette course ?' : 'Refuser cette mission ?',
      isRide
        ? 'Elle sera proposée au chauffeur suivant à proximité. Vous ne serez plus sollicité pour celle-ci.'
        : 'La mission redeviendra disponible pour d’autres prestataires.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setUpdating(id);
            try {
              if (isRide) {
                await api.rides.refuse(id, token);
                setAvailableMissions((prev) => prev.filter((m) => m.id !== id));
              } else {
                await api.missions.refuse(id, token);
                Alert.alert('Mission refusée', 'La mission est de nouveau disponible');
                fetchMissions();
                fetchAvailable();
              }
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Refus échoué');
            } finally {
              setUpdating(null);
            }
          },
        },
      ],
    );
  };

  const handleCancel = async (id: string) => {
    if (!token) return;
    Alert.alert(
      'Annuler la mission',
      'Êtes-vous sûr de vouloir annuler cette mission ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setUpdating(id);
            try {
              await api.missions.cancel(id, token);
              Alert.alert('Mission annulée');
              fetchMissions();
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Annulation échouée');
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  };

  const activeMissions = missions.filter((m) =>
    m.kind === 'ride' ? RIDE_ACTIVE.includes(m.status) : !PAST_STATUSES.includes(m.status),
  );
  const pastMissions = missions.filter((m) => PAST_STATUSES.includes(m.status));

  const callPassenger = (phone?: string | null) => {
    if (!phone) {
      Alert.alert('Info', 'Numéro du passager indisponible');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const [offerTick, setOfferTick] = useState(0);
  useEffect(() => {
    const hasOffer = availableMissions.some((m) => m.kind === 'ride' && m.offerExpiresAt);
    if (!hasOffer) return;
    const t = setInterval(() => setOfferTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [availableMissions]);

  const offerSecondsLeft = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    void offerTick;
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  };

  const renderAvailableMission = (m: any) => {
    const distance = m.distanceKm !== undefined && m.distanceKm !== null ? `${Number(m.distanceKm).toFixed(1)} km` : null;
    const highlighted = focusRideId === m.id;
    const secs = m.kind === 'ride' ? offerSecondsLeft(m.offerExpiresAt) : null;
    return (
      <View
        key={m.id}
        style={[
          styles.missionCard,
          Shadows.sm,
          styles.availableCard,
          highlighted && styles.missionCardFocused,
          m.kind === 'ride' && m.isExclusiveOffer && styles.missionCardOffer,
        ]}
      >
        {m.kind === 'ride' && secs != null && (
          <View style={styles.offerTimerRow}>
            <Ionicons name="timer-outline" size={14} color={Colors.warning} />
            <Text style={styles.offerTimerText}>Offre exclusive · {secs}s</Text>
          </View>
        )}
        <View style={styles.missionTop}>
          <View style={styles.missionBadge}>
            <Text style={styles.missionBadgeText} numberOfLines={1}>
              {m.kind === 'ride' ? `Course · ${m.vehicleMode || 'passager'}` : m.serviceType}
            </Text>
          </View>
          {distance && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={12} color={Colors.info} />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
        </View>
        {m.kind === 'ride' && (
          <Text style={styles.passengerLine} numberOfLines={1}>
            Passager · {m.passengerName || m.passenger?.firstName || 'Client'}
          </Text>
        )}
        <View style={styles.missionRoute}>
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: Colors.primary }]} /><Text style={styles.routeText} numberOfLines={1}>{m.pickupAddress}</Text></View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: Colors.accent }]} /><Text style={styles.routeText} numberOfLines={1}>{m.deliveryAddress}</Text></View>
        </View>
        <View style={styles.missionBottom}>
          <Text style={styles.missionPrice}>{Number(m.price || 0).toLocaleString()} F</Text>
          <View style={styles.actionRow}>
            {m.kind === 'ride' && (
              <TouchableOpacity
                style={[styles.refuseBtn, updating === m.id && styles.actionBtnDisabled]}
                onPress={() => handleRefuse(m.id)}
                disabled={updating === m.id}
                activeOpacity={0.85}
              >
                <Text style={styles.refuseBtnText}>Refuser</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, updating === m.id && styles.actionBtnDisabled]}
              onPress={() => handleAccept(m.id)}
              disabled={updating === m.id}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText} numberOfLines={1}>{updating === m.id ? '...' : 'Accepter'}</Text>
              <Ionicons name="checkmark-circle" size={14} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderMission = (m: any) => {
    const next = getNextStatus(m);
    const sc = statusColors[m.status] || statusColors.pending;
    const highlighted = focusRideId === m.id;
    const isRide = m.kind === 'ride';
    return (
      <View key={m.id} style={[styles.missionCard, Shadows.sm, highlighted && styles.missionCardFocused]}>
        <View style={styles.missionTop}>
          <View style={styles.missionBadge}>
            <Text style={styles.missionBadgeText} numberOfLines={1}>
              {isRide ? `Course · ${m.vehicleMode || ''}` : m.serviceType}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]} numberOfLines={1}>{statusLabels[m.status] || m.status}</Text>
          </View>
        </View>
        {isRide && (
          <Text style={styles.passengerLine} numberOfLines={1}>
            Passager · {m.passengerName || m.passenger?.firstName || 'Client'}
          </Text>
        )}
        {isRide && m.passengerReadyAt && (
          <View style={styles.readyBanner}>
            <Ionicons name="navigate" size={14} color={Colors.primary} />
            <Text style={styles.readyBannerText}>Le passager est sur place</Text>
          </View>
        )}
        <View style={styles.missionRoute}>
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: Colors.primary }]} /><Text style={styles.routeText} numberOfLines={1}>{m.pickupAddress}</Text></View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}><View style={[styles.dot, { backgroundColor: Colors.accent }]} /><Text style={styles.routeText} numberOfLines={1}>{m.deliveryAddress}</Text></View>
        </View>
        {!isRide && m.deliveryCode && (
          <View style={styles.codeHintBanner}>
            <Ionicons name="key-outline" size={14} color={Colors.warning} />
            <Text style={styles.codeHintText}>Code de remise requis lors de la validation finale</Text>
          </View>
        )}
        <View style={styles.missionBottom}>
          <Text style={styles.missionPrice}>{Number(m.price || 0).toLocaleString()} F</Text>
          <View style={styles.actionRow}>
            {isRide && RIDE_ACTIVE.includes(m.status) && (m.passengerPhone || m.passenger?.phone) && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => callPassenger(m.passengerPhone || m.passenger?.phone)}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {!isRide && ['accepted', 'en_route', 'picked_up', 'in_progress'].includes(m.status) && (
              <>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation?.navigate('Tracking', { missionId: m.id })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map-outline" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleOpenChat(m)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
                </TouchableOpacity>
              </>
            )}
            {!isRide && m.status === 'accepted' && (
              <TouchableOpacity
                style={[styles.cancelBtn, updating === m.id && styles.actionBtnDisabled]}
                onPress={() => handleCancel(m.id)}
                disabled={updating === m.id}
                activeOpacity={0.85}
              >
                <Ionicons name="close-outline" size={14} color={Colors.accent} />
                <Text style={styles.cancelBtnText} numberOfLines={1}>Annuler</Text>
              </TouchableOpacity>
            )}
            {!isRide && (adminServiceTypes.includes(m.serviceType) || (m.serviceType === 'courses' && m.serviceDetails?.courseMode === 'bill_payment')) && !['pending', 'cancelled'].includes(m.status) && !m.adminFeeReceiptUrl && (
              <TouchableOpacity
                style={styles.feeBtn}
                onPress={() => {
                  setFeeModal({
                    missionId: m.id,
                    reason: m.serviceType === 'courses' ? 'bill_payment' : 'admin_fee',
                  });
                  setFeeAmount(
                    m.adminFeeActual
                      ? String(m.adminFeeActual)
                      : String(m.serviceDetails?.billAmount ?? ''),
                  );
                  setFeeReceiptUri(null);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="receipt-outline" size={14} color={Colors.warning} />
                <Text style={styles.feeBtnText} numberOfLines={1}>
                  {m.serviceType === 'courses' ? 'Facture' : 'Justificatif'}
                </Text>
              </TouchableOpacity>
            )}
            {next && (
              <TouchableOpacity
                style={[styles.actionBtn, updating === m.id && styles.actionBtnDisabled]}
                onPress={() => requestStatusUpdate(m, next.status)}
                disabled={updating === m.id}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnText} numberOfLines={1}>{updating === m.id ? '...' : next.label}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, Spacing['3xl']) }]}>
        <Text style={styles.title}>Missions & courses</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.subtitlePill}>
            <Ionicons name="flash" size={12} color={Colors.info} />
            <Text style={styles.subtitleText}>{activeMissions.length} en cours</Text>
          </View>
          <View style={styles.subtitlePill}>
            <Ionicons name="checkmark-done" size={12} color={Colors.success} />
            <Text style={styles.subtitleText}>{pastMissions.length} terminées</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disponibles près de vous</Text>
        {availableMissions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="search-outline" size={36} color={Colors.gray300} /></View>
            <Text style={styles.emptyText}>Aucune mission ou course disponible{myCoords ? ' dans un rayon de 20 km' : ''}</Text>
          </View>
        ) : (
          availableMissions.map(renderAvailableMission)
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>En cours</Text>
        {activeMissions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="cube-outline" size={36} color={Colors.gray300} /></View>
            <Text style={styles.emptyText}>Aucune course ou mission en cours</Text>
          </View>
        ) : (
          activeMissions.map(renderMission)
        )}
      </View>

      {pastMissions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {pastMissions.map(renderMission)}
        </View>
      )}
    </ScrollView>

    <Modal visible={!!codeModal} transparent animationType="fade" onRequestClose={() => setCodeModal(null)}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons name="shield-checkmark-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.modalTitle}>Code de remise</Text>
          <Text style={styles.modalSubtitle}>
            Demandez au destinataire le code de remise reçu par le client, puis saisissez-le pour valider la remise.
          </Text>
          <TextInput
            style={styles.modalInput}
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder="Code à 6 caractères"
            placeholderTextColor={Colors.gray400}
            autoCapitalize="characters"
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCodeModal(null)} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmCodeAndUpdate} activeOpacity={0.85}>
              <Text style={styles.modalConfirmText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={!!feeModal} transparent animationType="fade" onRequestClose={() => setFeeModal(null)}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons name="receipt-outline" size={28} color={Colors.warning} />
          </View>
          <Text style={styles.modalTitle}>
            {feeModal?.reason === 'bill_payment' ? 'Preuve de facture' : 'Justificatif de frais'}
          </Text>
          <Text style={styles.modalSubtitle}>
            {feeModal?.reason === 'bill_payment'
              ? 'Indiquez le montant réellement payé et joignez une photo de la facture ou du reçu. Cette preuve est requise avant de clôturer la course.'
              : 'Indiquez le montant réellement avancé et joignez une photo du reçu (timbre, quittance...). Le client sera notifié pour le remboursement.'}
          </Text>
          <TextInput
            style={styles.feeInput}
            value={feeAmount}
            onChangeText={setFeeAmount}
            placeholder={feeModal?.reason === 'bill_payment' ? 'Montant payé en FCFA' : 'Montant en FCFA'}
            keyboardType="number-pad"
            placeholderTextColor={Colors.gray400}
          />
          <TouchableOpacity style={styles.receiptPick} onPress={pickReceipt} activeOpacity={0.85}>
            <Ionicons name={feeReceiptUri ? 'checkmark-circle' : 'camera-outline'} size={18} color={feeReceiptUri ? Colors.success : Colors.primary} />
            <Text style={styles.receiptPickText}>{feeReceiptUri ? 'Reçu ajouté' : 'Ajouter le reçu'}</Text>
          </TouchableOpacity>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFeeModal(null)} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalConfirmBtn, submittingFee && styles.actionBtnDisabled]} onPress={submitFeeReceipt} disabled={submittingFee} activeOpacity={0.85}>
              <Text style={styles.modalConfirmText}>{submittingFee ? 'Envoi...' : 'Envoyer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['2xl'], color: Colors.gray900 },
  subtitleRow: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
  subtitlePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, ...Shadows.xs },
  subtitleText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray600, marginLeft: 4 },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray500 },
  missionCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.md },
  missionCardFocused: {
    borderWidth: 2,
    borderColor: Colors.secondary,
    backgroundColor: withAlpha(Colors.secondary, 0.12),
  },
  missionCardOffer: {
    borderWidth: 2,
    borderColor: Colors.warning,
    backgroundColor: withAlpha(Colors.warning, 0.06),
  },
  offerTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  offerTimerText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.warning,
  },
  refuseBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  refuseBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.accent,
  },
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  missionBadge: { flexShrink: 1, backgroundColor: withAlpha(Colors.primary, 0.1), paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  missionBadgeText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.primary },
  passengerLine: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginBottom: 6,
  },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  readyBannerText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  statusBadge: { flexShrink: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  statusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs },
  missionRoute: { marginBottom: Spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  routeLine: { width: 2, height: 14, backgroundColor: Colors.gray200, marginLeft: 3, marginVertical: 2 },
  routeText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600 },
  missionBottom: { gap: Spacing.sm },
  missionPrice: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexShrink: 1, minWidth: 96, maxWidth: '100%', justifyContent: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: 4, ...Shadows.xs },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { flexShrink: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: BorderRadius.md, backgroundColor: withAlpha(Colors.primary, 0.1), alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '100%', backgroundColor: withAlpha(Colors.accent, 0.1), paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: 4 },
  cancelBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.accent },
  availableCard: { borderLeftWidth: 3, borderLeftColor: Colors.info },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(Colors.info, 0.1), paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, gap: 4 },
  distanceText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.info },
  codeHintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md, backgroundColor: withAlpha(Colors.warning, 0.08), borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  codeHintText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.warning },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  modalCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(Colors.primary, 0.1), alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  modalTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.xs },
  modalSubtitle: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600, textAlign: 'center', marginBottom: Spacing.md },
  modalInput: { width: '100%', borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.lg, color: Colors.gray900, textAlign: 'center', letterSpacing: 4, marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: Colors.gray100 },
  modalCancelText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  modalConfirmBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: Colors.primary },
  modalConfirmText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  feeBtn: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '100%', gap: 4, backgroundColor: withAlpha(Colors.warning, 0.12), paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  feeBtnText: { flexShrink: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.warning },
  feeInput: { width: '100%', borderWidth: 1.5, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginBottom: Spacing.md },
  receiptPick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', borderWidth: 1.5, borderColor: Colors.gray200, borderStyle: 'dashed', borderRadius: BorderRadius.md, paddingVertical: Spacing.md, marginBottom: Spacing.md },
  receiptPickText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
});
