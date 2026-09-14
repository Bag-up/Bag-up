import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Linking, Modal, Pressable } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { formatFormulaLabel } from '../../constants/formulas';
import { vehicleModeLabel } from '../../constants/vehicle';
import { useAuth } from '../../context/AuthContext';
import { missingRideIdentityFields } from '../../constants/vehicle';
import { api } from '../../services/api';
import { getCurrentPosition } from '../../services/location';
import { SUPPORT_MAILTO_URL, SUPPORT_TEL_URL } from '../../constants/support';

const REMINDER_DISMISS_KEY = '@bagup_sub_reminder_dismissed';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export const ProviderDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, token, online, setOnline, refreshUser } = useAuth();
  const [availableMissions, setAvailableMissions] = useState<any[]>([]);
  const [myMissions, setMyMissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [bannerVisible, setBannerVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [focusRideId, setFocusRideId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const availableSectionY = useRef(0);

  const nextStatus: Record<string, { status: string; label: string; icon: string } | null> = {
    // Collecte / livraison
    accepted: { status: 'en_route', label: 'En route', icon: 'navigate' },
    en_route: { status: 'picked_up', label: 'Récupérer', icon: 'bag-check' },
    picked_up: { status: 'in_progress', label: 'Démarrer', icon: 'bicycle' },
    in_progress: { status: 'delivered', label: 'Livrer', icon: 'checkmark-done' },
    // Démarches administratives
    dossier_deposed: { status: 'admin_processing', label: 'En attente', icon: 'time' },
    admin_processing: { status: 'document_ready', label: 'Doc. prêt', icon: 'document-text' },
    document_ready: { status: 'document_collected', label: 'Retirer', icon: 'download' },
    document_collected: { status: 'returned_to_client', label: 'Restituer', icon: 'return-up-forward' },
    returned_to_client: null,
    delivered: null,
    pending: null,
    cancelled: null,
    completed: null,
  };

  const rideNextStatus: Record<string, { status: string; label: string; icon: string } | null> = {
    assigned: { status: 'driver_en_route', label: 'En route', icon: 'navigate' },
    driver_en_route: { status: 'driver_arrived', label: 'Arrivé', icon: 'flag' },
    driver_arrived: { status: 'in_progress', label: 'Démarrer', icon: 'play' },
    in_progress: { status: 'completed', label: 'Terminer', icon: 'checkmark-done' },
  };

  const statusLabels: Record<string, string> = {
    accepted: 'Acceptée',
    en_route: 'En route',
    picked_up: 'Récupérée',
    in_progress: 'En cours',
    delivered: 'Terminée',
    pending: 'En attente',
    cancelled: 'Annulée',
    searching: 'Recherche',
    assigned: 'Course assignée',
    driver_en_route: 'En route (client)',
    driver_arrived: 'Arrivé',
    completed: 'Terminée',
    dossier_deposed: 'Dossier déposé',
    admin_processing: 'En attente admin',
    document_ready: 'Document prêt',
    document_collected: 'Document retiré',
    returned_to_client: 'Restitué',
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    accepted: { bg: Colors.infoSoft, text: Colors.info },
    en_route: { bg: Colors.infoSoft, text: Colors.info },
    picked_up: { bg: Colors.infoSoft, text: Colors.info },
    in_progress: { bg: Colors.infoSoft, text: Colors.info },
    delivered: { bg: Colors.successSoft, text: Colors.success },
    pending: { bg: Colors.warningSoft, text: Colors.warning },
    cancelled: { bg: Colors.accentSoft, text: Colors.accent },
    searching: { bg: Colors.warningSoft, text: Colors.warning },
    assigned: { bg: Colors.infoSoft, text: Colors.info },
    driver_en_route: { bg: Colors.infoSoft, text: Colors.info },
    driver_arrived: { bg: Colors.infoSoft, text: Colors.info },
    completed: { bg: Colors.successSoft, text: Colors.success },
    dossier_deposed: { bg: Colors.infoSoft, text: Colors.info },
    admin_processing: { bg: Colors.warningSoft, text: Colors.warning },
    document_ready: { bg: Colors.successSoft, text: Colors.success },
    document_collected: { bg: Colors.infoSoft, text: Colors.info },
    returned_to_client: { bg: Colors.successSoft, text: Colors.success },
  };

  const serviceIcons: Record<string, { icon: string; color: string; gradient: [string, string] }> = {
    colis: { icon: 'cube', color: Colors.primary, gradient: ['#0D8F8F', '#14B8B8'] },
    documents: { icon: 'document-text', color: Colors.accent, gradient: ['#F04A3A', '#FF6B5B'] },
    courses: { icon: 'cart', color: Colors.info, gradient: ['#6366F1', '#818CF8'] },
    course: { icon: 'navigate', color: Colors.info, gradient: ['#0EA5E9', '#38BDF8'] },
    administratif: { icon: 'business', color: Colors.warning, gradient: ['#F59E0B', '#FBBF24'] },
  };

  const activeMissions = myMissions.filter(m =>
    m.kind === 'ride'
      ? ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(m.status)
      : ['accepted', 'en_route', 'picked_up', 'in_progress', 'dossier_deposed', 'admin_processing', 'document_ready', 'document_collected'].includes(m.status),
  );
  const deliveredCount = myMissions.filter((m) =>
    m.kind === 'ride' ? m.status === 'completed' : m.status === 'delivered',
  ).length;
  const activeCount = activeMissions.length;
  const totalEarnings = myMissions
    .filter((m) => (m.kind === 'ride' ? m.status === 'completed' : m.status === 'delivered'))
    .reduce((sum, m) => sum + Number(m.price || 0), 0);
  const todayEarnings = myMissions
    .filter(
      (m) =>
        (m.kind === 'ride' ? m.status === 'completed' : m.status === 'delivered') &&
        new Date(m.createdAt).toDateString() === new Date().toDateString(),
    )
    .reduce((sum, m) => sum + Number(m.price || 0), 0);
  const pastItems = myMissions
    .filter((m) =>
      m.kind === 'ride'
        ? ['completed', 'cancelled'].includes(m.status)
        : ['delivered', 'cancelled', 'returned_to_client'].includes(m.status),
    )
    .slice(0, 12);

  const pendingCashRide = myMissions.find(
    (m) => m.kind === 'ride' && (m.needsCashConfirm || (m.status === 'completed' && !m.isPaid)),
  );

  const daysLeft = useMemo(() => {
    if (!user?.subscriptionExpiry) return null;
    return Math.ceil(
      (new Date(user.subscriptionExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
  }, [user?.subscriptionExpiry]);

  const isExpiringWindow = daysLeft !== null && daysLeft >= 1 && daysLeft <= 10;
  const isUrgentPopup = daysLeft !== null && daysLeft >= 1 && daysLeft <= 3;
  const isSoftBanner = daysLeft !== null && daysLeft >= 4 && daysLeft <= 10;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isExpiringWindow || !user?.id) {
        setBannerVisible(false);
        setPopupVisible(false);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(`${REMINDER_DISMISS_KEY}:${user.id}`);
        const dismissedToday = raw === todayKey();
        if (cancelled) return;
        if (dismissedToday) {
          setBannerVisible(false);
          setPopupVisible(false);
          return;
        }
        if (isUrgentPopup) {
          setPopupVisible(true);
          setBannerVisible(false);
        } else if (isSoftBanner) {
          setBannerVisible(true);
          setPopupVisible(false);
        }
      } catch {
        if (!cancelled) {
          setBannerVisible(isSoftBanner);
          setPopupVisible(isUrgentPopup);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, isExpiringWindow, isUrgentPopup, isSoftBanner, daysLeft]);

  const dismissReminderForToday = async () => {
    setBannerVisible(false);
    setPopupVisible(false);
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(`${REMINDER_DISMISS_KEY}:${user.id}`, todayKey());
    } catch {
      // ignore storage errors
    }
  };

  const goRenew = () => {
    setBannerVisible(false);
    setPopupVisible(false);
    const parent = navigation.getParent();
    if (parent) parent.navigate('ProviderPayment');
    else navigation.navigate('ProviderPayment');
  };

  const fetchAvailable = useCallback(async (zone?: string) => {
    if (!token) return;
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
      } catch {}
      const [missions, rides] = await Promise.all([
        api.missions.available(token, zone || undefined),
        api.rides.available(token, lat, lng, 20),
      ]);
      const rideItems = (Array.isArray(rides) ? rides : []).map((r: any) => ({
        ...r,
        kind: 'ride',
        serviceType: 'course',
        deliveryAddress: r.dropoffAddress,
        price: r.estimatedPrice,
        passengerName: r.passenger?.firstName || 'Passager',
        passengerPhone: r.passenger?.phone || null,
        distanceKm: r.offerDistanceKm ?? r.distanceKm,
        offerExpiresAt: r.offerExpiresAt,
        isExclusiveOffer: r.isExclusiveOffer,
      }));
      setAvailableMissions([...(Array.isArray(missions) ? missions : []), ...rideItems]);
    } catch (e) {
      console.error('fetchAvailable error:', e);
    }
  }, [token]);

  const sortedAvailable = useMemo(() => {
    if (!focusRideId) return availableMissions;
    const focused = availableMissions.filter((m) => m.id === focusRideId);
    const rest = availableMissions.filter((m) => m.id !== focusRideId);
    return [...focused, ...rest];
  }, [availableMissions, focusRideId]);

  const fetchMyMissions = useCallback(async () => {
    if (!token) return;
    try {
      const [missions, rides] = await Promise.all([
        api.missions.provider(token),
        api.rides.driver(token),
      ]);
      const rideItems = (Array.isArray(rides) ? rides : []).map((r: any) => ({
        ...r,
        kind: 'ride',
        serviceType: 'course',
        deliveryAddress: r.dropoffAddress,
        price: r.finalPrice ?? r.estimatedPrice,
        passengerName: r.passenger?.firstName || 'Passager',
        passengerPhone: r.passenger?.phone || null,
      }));
      setMyMissions([...(Array.isArray(missions) ? missions : []), ...rideItems]);
    } catch (e) {
      console.error('fetchMyMissions error:', e);
    }
  }, [token]);

  const fetchSubscriptions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.subscriptions.mine(token);
      setSubscriptions(data);
    } catch (e) {
      console.error('fetchSubscriptions error:', e);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailable(zoneFilter);
      fetchMyMissions();
      fetchSubscriptions();
      refreshUser();
      const interval = setInterval(() => {
        fetchAvailable(zoneFilter);
        fetchMyMissions();
      }, 4000);
      return () => clearInterval(interval);
    }, [fetchAvailable, fetchMyMissions, fetchSubscriptions, refreshUser, zoneFilter])
  );

  useEffect(() => {
    const id = route.params?.focusRideId as string | undefined;
    if (!id) return;
    setFocusRideId(id);
    setOnline(true);
    fetchAvailable(zoneFilter).then(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(availableSectionY.current - 12, 0),
          animated: true,
        });
      }, 350);
    });
    navigation.setParams?.({ focusRideId: undefined });
  }, [route.params?.focusRideId, fetchAvailable, zoneFilter, navigation, setOnline]);

  // Notif / deep-link vers une offre déjà expirée ou prise
  useEffect(() => {
    if (!focusRideId) return;
    const stillThere = availableMissions.some((m) => m.id === focusRideId);
    if (stillThere) return;
    // Laisser un tick après fetch pour éviter faux négatif au chargement
    const t = setTimeout(() => {
      const found = availableMissions.some((m) => m.id === focusRideId);
      if (!found) {
        Alert.alert(
          'Course indisponible',
          'Cette course a déjà été prise ou n’est plus proposée.',
        );
        setFocusRideId(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [focusRideId, availableMissions]);

  // GPS courses personnes (dashboard)
  useFocusEffect(
    useCallback(() => {
      const sendRideLocation = async () => {
        if (!token) return;
        try {
          const activeRides = myMissions.filter(
            (m) =>
              m.kind === 'ride' &&
              ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(m.status),
          );
          if (activeRides.length === 0) return;
          const { lat, lng } = await getCurrentPosition();
          for (const r of activeRides) {
            api.rides.updateLocation(r.id, lat, lng, token).catch(() => {});
          }
        } catch {}
      };
      sendRideLocation();
      const interval = setInterval(sendRideLocation, 8000);
      return () => clearInterval(interval);
    }, [token, myMissions]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailable(zoneFilter), fetchMyMissions(), fetchSubscriptions(), refreshUser()]);
    setRefreshing(false);
  }, [fetchAvailable, fetchMyMissions, fetchSubscriptions, refreshUser, zoneFilter]);

  const handleZoneChange = (zone: string) => {
    setZoneFilter(zone);
    fetchAvailable(zone);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    if (!token) return;
    setUpdating(id);
    try {
      const item = myMissions.find((m) => m.id === id) || activeMissions.find((m) => m.id === id);
      if (item?.kind === 'ride') {
        await api.rides.updateStatus(id, newStatus, token);
      } else {
        await api.missions.updateStatus(id, newStatus, token);
      }
      fetchMyMissions();
      fetchAvailable(zoneFilter);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Mise à jour échouée');
    } finally {
      setUpdating(null);
    }
  };

  const handleAccept = async (id: string) => {
    if (!token) return;
    setAccepting(id);
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
        Alert.alert('Succès', 'Course acceptée', [{ text: 'OK' }]);
      } else {
        await api.missions.accept(id, token);
        Alert.alert('Succès', 'Mission acceptée', [{ text: 'OK' }]);
      }
      fetchAvailable();
      fetchMyMissions();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/déjà prise|plus disponible|délai dépassé|ne vous est plus/i.test(msg)) {
        Alert.alert('Course déjà prise', 'Cette course n’est plus disponible.');
        fetchAvailable();
      } else {
        Alert.alert('Erreur', msg || 'Acceptation échouée');
      }
    } finally {
      setAccepting(null);
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
            setAccepting(id);
            try {
              if (isRide) {
                await api.rides.refuse(id, token);
                setAvailableMissions((prev) => prev.filter((m) => m.id !== id));
              } else {
                await api.missions.refuse(id, token);
                fetchAvailable();
              }
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Refus échoué');
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
    );
  };

  const handleConfirmCash = async (id: string) => {
    if (!token) return;
    Alert.alert(
      'Confirmer le paiement reçu ?',
      'Le client vous a payé en espèces. Cette confirmation est enregistrée dans le backoffice Bag’up.',
      [
        { text: 'Pas encore', style: 'cancel' },
        {
          text: 'Oui, j’ai reçu',
          onPress: async () => {
            setUpdating(id);
            try {
              await api.rides.confirmCash(id, token);
              Alert.alert('OK', 'Paiement enregistré. Vous pouvez à nouveau recevoir des courses.');
              fetchMyMissions();
              fetchAvailable(zoneFilter);
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Confirmation échouée');
            } finally {
              setUpdating(null);
            }
          },
        },
      ],
    );
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.firstName || 'L')[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>Bonjour 👋</Text>
              <Text style={styles.userName}>{user?.firstName || 'Livreur'}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.toggleBtn, !online && styles.toggleOff]} onPress={() => setOnline(!online)} activeOpacity={0.85}>
            <View style={[styles.toggleDot, !online && styles.toggleDotOff]} />
          </TouchableOpacity>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, online && styles.statusDotOnline]} />
          <Text style={styles.statusText}>{online ? 'En ligne · Prêt à livrer' : 'Hors ligne'}</Text>
        </View>
      </LinearGradient>

      {pendingCashRide && (
        <View style={styles.cashPayBanner}>
          <View style={styles.cashPayBannerTop}>
            <View style={styles.cashPayIconWrap}>
              <Ionicons name="cash" size={22} color={Colors.white} />
            </View>
            <View style={styles.reminderBannerInfo}>
              <Text style={styles.cashPayBadge}>PAYÉ PAR LE CLIENT</Text>
              <Text style={styles.cashPayTitle}>Confirmer les espèces reçues</Text>
              <Text style={styles.cashPaySub}>
                Course terminée · {Number(pendingCashRide.price || 0).toLocaleString('fr-FR')} F
                {'\n'}Aucune nouvelle course tant que ce n’est pas confirmé.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.cashPayBtn}
            onPress={() => handleConfirmCash(pendingCashRide.id)}
            disabled={updating === pendingCashRide.id}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
            <Text style={styles.cashPayBtnText}>
              {updating === pendingCashRide.id ? 'Confirmation…' : 'Oui, j’ai reçu le paiement'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {bannerVisible && daysLeft !== null && (
        <View style={styles.reminderBanner}>
          <View style={styles.reminderBannerLeft}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <View style={styles.reminderBannerInfo}>
              <Text style={styles.reminderBannerTitle}>
                Abonnement : plus que {daysLeft} jour{daysLeft > 1 ? 's' : ''}
              </Text>
              <Text style={styles.reminderBannerSub}>Renouvelez pour éviter toute interruption.</Text>
            </View>
          </View>
          <View style={styles.reminderBannerActions}>
            <TouchableOpacity style={styles.reminderRenewBtn} onPress={goRenew} activeOpacity={0.85}>
              <Text style={styles.reminderRenewText}>Renouveler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderCloseBtn} onPress={dismissReminderForToday} activeOpacity={0.85}>
              <Ionicons name="close" size={18} color={Colors.gray500} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={popupVisible} transparent animationType="fade" onRequestClose={dismissReminderForToday}>
        <Pressable style={styles.modalBackdrop} onPress={dismissReminderForToday}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={styles.modalClose} onPress={dismissReminderForToday} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={Colors.gray500} />
            </TouchableOpacity>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={36} color={Colors.warning} />
            </View>
            <Text style={styles.modalTitle}>
              Plus que {daysLeft} jour{daysLeft !== 1 ? 's' : ''} !
            </Text>
            <Text style={styles.modalSub}>
              Votre abonnement expire bientôt. Renouvelez aujourd&apos;hui pour continuer à recevoir des missions sans interruption.
            </Text>
            <TouchableOpacity style={styles.modalCta} onPress={goRenew} activeOpacity={0.85}>
              <Text style={styles.modalCtaText}>Renouveler maintenant</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissReminderForToday} activeOpacity={0.8}>
              <Text style={styles.modalLater}>Rappeler demain</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={[styles.statsCard, Shadows.sm]}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
              <Ionicons name="wallet-outline" size={16} color={Colors.success} />
            </View>
            <Text style={styles.statValue}>{totalEarnings.toLocaleString()}<Text style={styles.statSuffix}> F</Text></Text>
            <Text style={styles.statLabel}>Revenus</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.info, 0.12) }]}>
              <Ionicons name="checkmark-done" size={16} color={Colors.info} />
            </View>
            <Text style={styles.statValue}>{deliveredCount}</Text>
            <Text style={styles.statLabel}>Livrées</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.warning, 0.12) }]}>
              <Ionicons name="flash" size={16} color={Colors.warning} />
            </View>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
        </View>

        {online && (
          <View style={styles.todayCard}>
            <LinearGradient colors={Colors.gradientDark} style={styles.todayGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.todayLeft}>
                <View style={styles.todayIcon}>
                  <Ionicons name="trending-up" size={20} color={Colors.secondary} />
                </View>
                <View>
                  <Text style={styles.todayLabel}>Gains du jour</Text>
                  <Text style={styles.todayValue}>{todayEarnings.toLocaleString()} F</Text>
                </View>
              </View>
              <View style={styles.todayRight}>
                <Ionicons name="arrow-forward" size={18} color={Colors.white} />
              </View>
            </LinearGradient>
          </View>
        )}

        {activeMissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Missions en cours</Text>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{activeMissions.length}</Text></View>
            </View>
            {activeMissions.map((m) => {
              const next = m.kind === 'ride' ? (rideNextStatus[m.status] ?? null) : nextStatus[m.status];
              const sc = statusColors[m.status] || statusColors.pending;
              const svc = serviceIcons[m.serviceType] || serviceIcons.colis;
              return (
                <View key={m.id} style={[styles.missionCard, Shadows.sm, { borderLeftWidth: 3, borderLeftColor: svc.color }]}>
                  <View style={styles.missionTop}>
                    <View style={styles.missionTopLeft}>
                      <LinearGradient colors={svc.gradient} style={styles.missionServiceIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Ionicons name={svc.icon as any} size={16} color={Colors.white} />
                      </LinearGradient>
                      <View>
                        <Text style={styles.missionType}>{m.kind === 'ride' ? 'Course' : m.serviceType}</Text>
                        <View style={[styles.missionStatusPill, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.missionStatusText, { color: sc.text }]}>{statusLabels[m.status] || m.status}</Text>
                        </View>
                        {m.kind === 'ride' && (
                          <Text style={styles.passengerHint} numberOfLines={1}>
                            {m.passengerName || m.passenger?.firstName || 'Passager'}
                            {m.vehicleMode ? ` · ${vehicleModeLabel(m.vehicleMode)}` : ''}
                            {m.passengerReadyAt ? ' · sur place' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.missionPrice}>{Number(m.price).toLocaleString()} F</Text>
                  </View>
                  <View style={styles.missionRoute}>
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.pickupAddress}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.deliveryAddress}</Text>
                    </View>
                  </View>
                  {next && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleStatusUpdate(m.id, next.status)} disabled={updating === m.id} activeOpacity={0.85}>
                      <Ionicons name={next.icon as any} size={16} color={Colors.white} />
                      <Text style={styles.actionBtnText} numberOfLines={1}>{updating === m.id ? 'Mise à jour...' : next.label}</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {pastItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Historique</Text>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{pastItems.length}</Text></View>
            </View>
            {pastItems.map((m) => {
              const sc = statusColors[m.status] || statusColors.pending;
              const svc = serviceIcons[m.serviceType] || serviceIcons.colis;
              return (
                <View key={`past-${m.id}`} style={[styles.missionCard, Shadows.sm, { borderLeftWidth: 3, borderLeftColor: svc.color }]}>
                  <View style={styles.missionTop}>
                    <View style={styles.missionTopLeft}>
                      <LinearGradient colors={svc.gradient} style={styles.missionServiceIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Ionicons name={svc.icon as any} size={16} color={Colors.white} />
                      </LinearGradient>
                      <View>
                        <Text style={styles.missionType}>{m.kind === 'ride' ? 'Course' : m.serviceType}</Text>
                        <View style={[styles.missionStatusPill, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.missionStatusText, { color: sc.text }]}>{statusLabels[m.status] || m.status}</Text>
                        </View>
                        {m.kind === 'ride' && (
                          <Text style={styles.passengerHint} numberOfLines={1}>
                            {m.passengerName || m.passenger?.firstName || 'Passager'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.missionPrice}>{Number(m.price || 0).toLocaleString()} F</Text>
                  </View>
                  <View style={styles.missionRoute}>
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.pickupAddress}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.deliveryAddress}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View
          style={styles.section}
          onLayout={(e) => {
            availableSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="notifications" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Missions disponibles</Text>
            </View>
            {availableMissions.length > 0 && <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{availableMissions.length}</Text></View>}
          </View>
          {/* Zone filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneFilterScroll}>
            {['', 'Dakar', 'Thiès', 'Mbour', 'Saint-Louis', 'Touba', 'Kaolack', 'Ziguinchor', 'Louga', 'Tambacounda', 'Kolda'].map((z) => (
              <TouchableOpacity
                key={z || 'all'}
                style={[styles.zoneChip, zoneFilter === z && styles.zoneChipActive]}
                onPress={() => handleZoneChange(z)}
                activeOpacity={0.85}
              >
                <Text style={[styles.zoneChipText, zoneFilter === z && styles.zoneChipTextActive]}>
                  {z || 'Toutes zones'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!online ? (
            <View style={styles.emptyState}>
              <LinearGradient colors={Colors.gradientDark} style={styles.emptyIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="cloud-offline-outline" size={32} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.emptyText}>Vous êtes hors ligne</Text>
              <Text style={styles.emptySub}>Activez le mode en ligne pour recevoir des missions</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setOnline(true)} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>Passer en ligne</Text>
                <Ionicons name="power" size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : sortedAvailable.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.emptyIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="cube-outline" size={32} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.emptyText}>Aucune mission disponible</Text>
              <Text style={styles.emptySub}>Les nouvelles missions apparaîtront ici automatiquement</Text>
            </View>
          ) : (
            sortedAvailable.map((m) => {
              const svc = serviceIcons[m.serviceType] || serviceIcons.colis;
              const highlighted = focusRideId === m.id;
              const secs = m.kind === 'ride' ? offerSecondsLeft(m.offerExpiresAt) : null;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.missionCard,
                    Shadows.sm,
                    highlighted && styles.missionCardFocused,
                    m.kind === 'ride' && m.isExclusiveOffer && styles.missionCardOffer,
                  ]}
                >
                  {m.kind === 'ride' && secs != null && (
                    <View style={styles.offerTimerRow}>
                      <Ionicons name="timer-outline" size={14} color={Colors.warning} />
                      <Text style={styles.offerTimerText}>
                        Offre exclusive · {secs}s
                        {m.distanceKm != null ? ` · ~${Number(m.distanceKm).toFixed(1)} km` : ''}
                      </Text>
                    </View>
                  )}
                  <View style={styles.missionTop}>
                    <View style={styles.missionTopLeft}>
                      <LinearGradient colors={svc.gradient} style={styles.missionServiceIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Ionicons name={svc.icon as any} size={16} color={Colors.white} />
                      </LinearGradient>
                      <View>
                        <Text style={styles.missionType}>{m.kind === 'ride' ? 'Course' : m.serviceType}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {m.vehicleMode ? (
                            <View style={styles.urgencyBadge}>
                              <Ionicons name={m.vehicleMode === 'voiture' ? 'car' : 'bicycle'} size={10} color={Colors.primary} />
                              <Text style={[styles.urgencyText, { color: Colors.primary }]}>{vehicleModeLabel(m.vehicleMode)}</Text>
                            </View>
                          ) : null}
                          {m.kind === 'ride' ? (
                            <View style={styles.urgencyBadge}>
                              <Ionicons name="person" size={10} color={Colors.info} />
                              <Text style={[styles.urgencyText, { color: Colors.info }]}>
                                {m.passenger?.firstName || m.passengerName || 'Passager'}
                              </Text>
                            </View>
                          ) : m.urgency ? (
                            <View style={styles.urgencyBadge}>
                              <Ionicons name="flash" size={10} color={Colors.warning} />
                              <Text style={styles.urgencyText}>{formatFormulaLabel(m.urgency)}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.missionPrice}>{Number(m.price).toLocaleString()} F</Text>
                  </View>
                  <View style={styles.missionRoute}>
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.pickupAddress}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={[styles.dot, { backgroundColor: Colors.accent }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{m.deliveryAddress}</Text>
                    </View>
                  </View>
                  <View style={styles.missionActionsRow}>
                    <TouchableOpacity style={[styles.refuseBtn, accepting === m.id && styles.actionBtnDisabled]} onPress={() => handleRefuse(m.id)} disabled={accepting === m.id} activeOpacity={0.85}>
                      <Ionicons name="close-outline" size={16} color={Colors.accent} />
                      <Text style={styles.refuseBtnText} numberOfLines={1}>Refuser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, accepting === m.id && styles.actionBtnDisabled]} onPress={() => handleAccept(m.id)} disabled={accepting === m.id} activeOpacity={0.85}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                      <Text style={styles.actionBtnText} numberOfLines={1}>{accepting === m.id ? '...' : 'Accepter'}</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Abonnement & Assurance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Abonnement & Assurance</Text>
            </View>
          </View>
          <View style={[styles.subCard, Shadows.sm]}>
            <View style={styles.subRow}>
              <View style={[styles.subIconWrap, { backgroundColor: withAlpha(Colors.primary, 0.12) }]}>
                <Ionicons name="card-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subLabel}>Statut abonnement</Text>
                <Text style={styles.subSub}>
                  {user?.subscriptionStatus === 'active'
                    ? daysLeft !== null && daysLeft <= 10
                      ? `Actif · ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
                      : 'Actif'
                    : user?.subscriptionStatus === 'expired'
                      ? 'Expiré'
                      : 'Aucun'}
                </Text>
              </View>
              {user?.subscriptionExpiry && (
                <Text style={styles.subExpiry}>
                  {new Date(user.subscriptionExpiry) > new Date()
                    ? `Exp. ${new Date(user.subscriptionExpiry).toLocaleDateString('fr-FR')}`
                    : 'Expiré'}
                </Text>
              )}
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.subRow}>
              <View style={[styles.subIconWrap, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
                <Ionicons name="shield-outline" size={18} color={Colors.success} />
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subLabel}>Assurance</Text>
                <Text style={styles.subSub}>
                  Après 4 mois d&apos;abonnement continus
                </Text>
              </View>
              <Ionicons name="information-circle-outline" size={20} color={Colors.gray400} />
            </View>
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 10 && (
              <>
                <View style={styles.perfDivider} />
                <TouchableOpacity style={styles.renewInlineBtn} onPress={goRenew} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={16} color={Colors.white} />
                  <Text style={styles.renewInlineText}>Renouveler mon abonnement</Text>
                </TouchableOpacity>
              </>
            )}
            {subscriptions.length > 0 && (
              <>
                <View style={styles.perfDivider} />
                <Text style={styles.subHistoryTitle}>Historique des paiements</Text>
                {subscriptions.slice(0, 3).map((sub: any) => (
                  <View key={sub.id} style={styles.subHistoryRow}>
                    <Text style={styles.subHistoryAmount}>{Number(sub.amount || 0).toLocaleString()} F</Text>
                    <Text style={styles.subHistoryDate}>{new Date(sub.createdAt).toLocaleDateString('fr-FR')}</Text>
                    <View style={[styles.subHistoryStatus, { backgroundColor: sub.status === 'success' ? withAlpha(Colors.success, 0.12) : withAlpha(Colors.warning, 0.12) }]}>
                      <Text style={[styles.subHistoryStatusText, { color: sub.status === 'success' ? Colors.success : Colors.warning }]}>{sub.status === 'success' ? 'Payé' : 'En attente'}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Code de parrainage */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="gift-outline" size={18} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Parrainage</Text>
            </View>
          </View>
          <View style={[styles.referralCard, Shadows.sm]}>
            <View style={styles.referralLeft}>
              <Text style={styles.referralLabel}>Votre code</Text>
              <Text style={styles.referralCode}>{user?.referralCode || '—'}</Text>
              <Text style={styles.referralSub}>
                Client +500 F · livreur/commerçant +1000 F (après leur 1er paiement)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.referralCopyBtn}
              onPress={() => {
                if (user?.referralCode) {
                  Alert.alert('Code copié', `Votre code ${user.referralCode} a été copié.`);
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.white} />
              <Text style={styles.referralCopyText}>Copier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hotline */}
        <View style={[styles.hotlineCard, Shadows.sm]}>
          <View style={styles.hotlineLeft}>
            <View style={styles.hotlineIcon}>
              <Ionicons name="headset" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hotlineTitle}>Hotline Bag'up</Text>
              <Text style={styles.hotlineSub}>Besoin d'aide ? Contactez-nous</Text>
            </View>
          </View>
          <View style={styles.hotlineActions}>
            <TouchableOpacity style={styles.hotlineBtn} onPress={() => Linking.openURL(SUPPORT_TEL_URL)} activeOpacity={0.85}>
              <Ionicons name="call" size={16} color={Colors.white} />
              <Text style={styles.hotlineBtnText}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.hotlineBtn, { backgroundColor: Colors.info }]} onPress={() => Linking.openURL(SUPPORT_MAILTO_URL)} activeOpacity={0.85}>
              <Ionicons name="mail" size={16} color={Colors.white} />
              <Text style={styles.hotlineBtnText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, borderBottomLeftRadius: BorderRadius['3xl'], borderBottomRightRadius: BorderRadius['3xl'] },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.md, color: Colors.white },
  greeting: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.85 },
  userName: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.white },
  toggleBtn: { width: 56, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)', padding: 3, justifyContent: 'center' },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.15)' },
  toggleDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.white, alignSelf: 'flex-end', ...Shadows.sm },
  toggleDotOff: { alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray400, marginRight: Spacing.sm },
  statusDotOnline: { backgroundColor: Colors.success },
  statusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.9 },
  content: { flex: 1, marginTop: -Spacing.md, paddingTop: Spacing.lg },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, paddingVertical: Spacing.base, marginHorizontal: Spacing.lg },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.gray100 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  statValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900 },
  statSuffix: { fontSize: Typography.fontSize.sm, color: Colors.gray400 },
  statLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  todayCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.lg },
  todayGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.base, borderRadius: BorderRadius.xl },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todayIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  todayLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray300 },
  todayValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.white, marginTop: 2 },
  todayRight: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  sectionBadge: { backgroundColor: withAlpha(Colors.primary, 0.12), paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  sectionBadgeText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'], paddingHorizontal: Spacing.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, ...Shadows.md },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray600 },
  emptySub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 4, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, gap: 6, ...Shadows.sm },
  emptyBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
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
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  missionTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  missionServiceIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', ...Shadows.xs },
  missionType: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, textTransform: 'capitalize' },
  passengerHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  missionStatusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: 4, alignSelf: 'flex-start' },
  missionStatusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs },
  missionPrice: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  missionRoute: { marginBottom: Spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  routeLine: { width: 2, height: 14, backgroundColor: Colors.gray200, marginLeft: 3, marginVertical: 2 },
  routeText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600 },
  urgencyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(Colors.warning, 0.1), paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, marginTop: 4, alignSelf: 'flex-start', gap: 4 },
  urgencyText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.warning },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 120, maxWidth: '100%', ...Shadows.sm },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { flexShrink: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  missionActionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  refuseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(Colors.accent, 0.1), paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, gap: 4, paddingHorizontal: Spacing.md, flexShrink: 1 },
  refuseBtnText: { flexShrink: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.accent },
  subCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  subIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  subInfo: { flex: 1 },
  subLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  subSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  subExpiry: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  perfDivider: { height: 1, backgroundColor: Colors.gray100 },
  subHistoryTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray700, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  subHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  subHistoryAmount: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  subHistoryDate: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  subHistoryStatus: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  subHistoryStatusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 10 },
  referralCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base },
  referralLeft: { flex: 1 },
  referralLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  referralCode: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.accent, marginTop: 2 },
  referralSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 4 },
  referralCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg },
  referralCopyText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  zoneFilterScroll: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.sm },
  zoneChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.lg, backgroundColor: Colors.white, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.gray200 },
  zoneChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  zoneChipText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray600 },
  zoneChipTextActive: { color: Colors.white },
  hotlineCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, marginHorizontal: Spacing.lg },
  hotlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  hotlineIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(Colors.primary, 0.12), alignItems: 'center', justifyContent: 'center' },
  hotlineTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  hotlineSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  hotlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hotlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, backgroundColor: Colors.primary, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg },
  hotlineBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.white },
  reminderBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: withAlpha(Colors.warning, 0.12), borderBottomWidth: 1, borderBottomColor: withAlpha(Colors.warning, 0.25), paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  cashPayBanner: {
    backgroundColor: withAlpha(Colors.success, 0.12),
    borderBottomWidth: 2,
    borderBottomColor: Colors.success,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  cashPayBannerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cashPayIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashPayBadge: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.success,
    marginBottom: 2,
  },
  cashPayTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  cashPaySub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    marginTop: 2,
    lineHeight: 18,
  },
  cashPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
  },
  cashPayBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  reminderBannerLeft: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderBannerInfo: { flex: 1 },
  reminderBannerTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  reminderBannerSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray600, marginTop: 2 },
  reminderBannerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  reminderRenewBtn: { backgroundColor: Colors.warning, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.lg },
  reminderRenewText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.xs, color: Colors.white },
  reminderCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center' },
  modalClose: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray100, zIndex: 2 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(Colors.warning, 0.12), alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, marginTop: Spacing.sm },
  modalTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900, textAlign: 'center', marginBottom: Spacing.sm },
  modalSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  modalCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  modalCtaText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  modalLater: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  renewInlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm },
  renewInlineText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
});
