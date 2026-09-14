import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
  Modal,
  TextInput,
  FlatList,
  Image,
  Share,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { tierUi } from '../../constants/loyalty';
import { useAuth } from '../../context/AuthContext';
import { useUserLocation } from '../../context/UserLocationContext';
import { api, resolveMediaUrl } from '../../services/api';
import { searchLocations, SenegalLocation } from '../../constants/senegalLocations';
import { MARKETPLACE_ENABLED } from '../../constants/marketplace';
import { getCurrentPosition } from '../../services/location';
import { syncRideLiveActivity } from '../../services/rideLiveActivity';
import { vehicleIdentityLine } from '../../constants/vehicle';
import { SUPPORT_MAILTO_URL, SUPPORT_TEL_URL } from '../../constants/support';

const ANTIGASPI_FEATURED = require('../../../assets/antigaspi-featured.jpg');
/** JPEG compressé (~370 Ko) — le PNG 2,4 Mo plantait souvent le décodage iOS. */
const RIDE_HERO_FLEET = require('../../../assets/ride-hero-moto-voiture.jpg');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HowStep = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
};

type HowTopic = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  soft: string;
  steps: HowStep[];
};

const howItWorksTopics: HowTopic[] = [
  {
    id: 'livraison',
    label: 'Livraison',
    icon: 'cube',
    color: '#0D8F8F',
    soft: '#E6F7F7',
    steps: [
      { icon: 'list-outline', title: 'Particulier ou pro', desc: 'Colis, objet, courses, facture ou mission B2B.' },
      { icon: 'create-outline', title: 'Décrivez la mission', desc: 'Contenu, magasin, entreprise… puis retrait et livraison.' },
      { icon: 'bicycle-outline', title: 'Un livreur prend en charge', desc: 'Un prestataire Bag’up accepte et vient récupérer votre envoi.' },
      { icon: 'checkmark-done-outline', title: 'Remise confirmée', desc: 'Suivi en direct jusqu’à la livraison ou la course faite.' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: 'cart',
    color: '#7C3AED',
    soft: '#F3E8FF',
    steps: [
      { icon: 'storefront-outline', title: 'Parcourez les boutiques', desc: 'Découvrez les produits des commerçants sénégalais partenaires.' },
      { icon: 'bag-handle-outline', title: 'Commandez en un tap', desc: 'Ajoutez vos articles et validez le panier tout compris.' },
      { icon: 'card-outline', title: 'Payez en toute sécurité', desc: 'Réglez en FCFA ou EUR selon votre profil.' },
      { icon: 'airplane-outline', title: 'Livraison Bag’up', desc: 'Collecte à Dakar puis livraison jusqu’à chez vous.' },
    ],
  },
  {
    id: 'antigaspi',
    label: 'Anti-Gaspi',
    icon: 'leaf',
    color: '#65A30D',
    soft: '#F0FDF4',
    steps: [
      { icon: 'search-outline', title: 'Trouvez un panier', desc: 'Explorez les paniers surplus près de chez vous.' },
      { icon: 'calendar-outline', title: 'Réservez votre offre', desc: 'Choisissez le créneau de retrait proposé.' },
      { icon: 'wallet-outline', title: 'Payez le prix réduit', desc: 'Économisez tout en luttant contre le gaspillage.' },
      { icon: 'happy-outline', title: 'Récupérez & savourez', desc: 'Allez chercher votre panier chez le commerçant.' },
    ],
  },
  {
    id: 'demarches',
    label: 'Démarches',
    icon: 'document-text',
    color: '#EA580C',
    soft: '#FFF7ED',
    steps: [
      { icon: 'list-outline', title: 'Choisissez la démarche', desc: 'CNI, passeport, casier, NINEA… sélectionnez votre besoin.' },
      { icon: 'cloud-upload-outline', title: 'Transmettez les infos', desc: 'Indiquez les pièces et consignes nécessaires.' },
      { icon: 'business-outline', title: 'Bag’up s’occupe du dépôt', desc: 'Un prestataire gère le passage administratif pour vous.' },
      { icon: 'mail-open-outline', title: 'Récupérez le document', desc: 'Suivez le statut jusqu’à la restitution finale.' },
    ],
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = Spacing.sm;
const GRID_PAD = Spacing.lg;
const TILE_W = (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP) / 2;
const RIDE_HERO_H = Math.min(268, Math.round(SCREEN_WIDTH * 0.68));

type ServiceTile = {
  id: string;
  title: string;
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  image: number;
  action: 'create' | 'market' | 'antigaspi';
  serviceType?: string;
  howTopicId?: string;
};

const serviceTiles: ServiceTile[] = [
  {
    id: 'collecte',
    title: 'Collecte & Livraison',
    blurb: 'Particulier ou pro : colis, courses, facture, missions B2B.',
    icon: 'cube',
    colors: ['#0A5C5C', '#0D8F8F'],
    image: require('../../../assets/tile-collecte.jpg'),
    action: 'create',
    serviceType: 'colis',
    howTopicId: 'livraison',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    blurb: 'Achetez chez les commerçants partenaires, livraison Bag’up.',
    icon: 'cart',
    colors: ['#5B21B6', '#7C3AED'],
    image: require('../../../assets/tile-marketplace.jpg'),
    action: 'market',
    howTopicId: 'marketplace',
  },
  {
    id: 'antigaspi',
    title: 'Anti Gaspi',
    blurb: 'Réservez des paniers surplus à prix réduit près de chez vous.',
    icon: 'leaf',
    colors: ['#3F6212', '#65A30D'],
    image: require('../../../assets/tile-antigaspi.jpg'),
    action: 'antigaspi',
    howTopicId: 'antigaspi',
  },
  {
    id: 'demarches',
    title: 'Démarches',
    blurb: 'CNI, passeport, casier… Bag’up gère le dépôt administratif.',
    icon: 'document-text',
    colors: ['#C2410C', '#EA580C'],
    image: require('../../../assets/tile-demarches.jpg'),
    action: 'create',
    serviceType: 'depot_administratif',
    howTopicId: 'demarches',
  },
];

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

interface Props {
  navigation?: any;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { shortLabel, loading: locLoading, refresh: refreshLocation } = useUserLocation();
  const [missions, setMissions] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationResults, setDestinationResults] = useState<Array<SenegalLocation & { placeId?: string }>>([]);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [howTopicId, setHowTopicId] = useState(howItWorksTopics[0].id);
  const [homeBanners, setHomeBanners] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<ServiceTile | null>(null);
  /** Remount image layers after navigation / sheet close (iOS + Android photo surfaces). */
  const [imageEpoch, setImageEpoch] = useState(0);
  const [featuredFailed, setFeaturedFailed] = useState(false);
  const [markingHere, setMarkingHere] = useState(false);
  const howTopic = howItWorksTopics.find((t) => t.id === howTopicId) || howItWorksTopics[0];
  const featuredBanner = homeBanners[0];
  const featuredImageUri = resolveMediaUrl(featuredBanner?.imageUrl);
  const featuredSource =
    featuredImageUri && !featuredFailed
      ? { uri: featuredImageUri }
      : ANTIGASPI_FEATURED;

  const avatarUri = resolveMediaUrl(user?.avatarUrl);

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  const destinationReq = useRef(0);
  const handleDestinationSearch = (text: string) => {
    setDestinationSearch(text);
    if (text.trim().length < 2) {
      setDestinationResults([]);
      return;
    }
    const local = searchLocations(text).slice(0, 4);
    setDestinationResults(local);
    const req = ++destinationReq.current;
    if (!token) return;
    api.geo.places(text, token).then(async (remote: any[]) => {
      if (req !== destinationReq.current) return;
      const google = (Array.isArray(remote) ? remote : []).map((p) => ({
        label: p.label,
        city: p.subtitle || 'Dakar',
        country: 'Sénégal',
        lat: 0,
        lng: 0,
        placeId: p.placeId as string,
      }));
      const covered = google.map((p) => p.label.toLowerCase());
      const extras = local.filter((item) => !covered.some((label) => label.includes(item.label.toLowerCase())));
      setDestinationResults([...google, ...extras].slice(0, 10));
    }).catch(() => {});
  };

  const handleSelectDestination = async (location: SenegalLocation & { placeId?: string }) => {
    let next = location;
    if (location.placeId && token && !location.lat) {
      const details = await api.geo.placeDetails(location.placeId, token).catch(() => null);
      if (details?.lat) {
        next = {
          label: details.address || details.label || location.label,
          city: details.city || 'Dakar',
          country: details.country || 'Sénégal',
          lat: details.lat,
          lng: details.lng,
        };
      }
    }
    if (!next.lat || !next.lng) return;
    setShowDestinationModal(false);
    setDestinationSearch('');
    setDestinationResults([]);
    navigation?.navigate('CreateRequest', {
      prefilledDelivery: next.label,
      prefilledDeliveryCoords: { lat: next.lat, lng: next.lng },
    });
  };

  const fetchMissions = useCallback(async () => {
    if (!token) return;
    try {
      const [data, rideData, banners, unread, loyaltyData] = await Promise.all([
        api.missions.mine(token),
        api.rides.mine(token).catch(() => []),
        api.content.homeBanners().catch(() => []),
        api.notifications.unreadCount(token).catch(() => ({ count: 0 })),
        api.loyalty.me(token).catch(() => null),
      ]);
      setMissions(Array.isArray(data) ? data : []);
      setRides(Array.isArray(rideData) ? rideData : []);
      setHomeBanners(Array.isArray(banners) ? banners : []);
      setUnreadNotifCount(typeof unread?.count === 'number' ? unread.count : 0);
      setLoyalty(loyaltyData);
    } catch (e) {
      console.error('fetchMissions error:', e);
    }
  }, [token]);

  const handleFeaturedPress = () => {
    const linkType = featuredBanner?.linkType || 'antigaspi';
    if (linkType === 'none') return;
    if (linkType === 'antigaspi') {
      navigation?.getParent()?.navigate('AntiGaspiBrowse');
      return;
    }
    if (linkType === 'market') {
      if (!MARKETPLACE_ENABLED) {
        Alert.alert('Bientôt', 'La Marketplace arrive très bientôt.');
        return;
      }
      navigation?.getParent()?.navigate('MarketHome');
      return;
    }
    if (linkType === 'url' && featuredBanner?.linkTarget) {
      Linking.openURL(featuredBanner.linkTarget).catch(() => {
        Alert.alert('Lien', 'Impossible d’ouvrir ce lien.');
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      setImageEpoch((n) => n + 1);
      setFeaturedFailed(false);
      fetchMissions();
      const interval = setInterval(fetchMissions, 10000);
      return () => clearInterval(interval);
    }, [fetchMissions]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMissions();
    setRefreshing(false);
  }, [fetchMissions]);

  const handleImHere = async (rideId: string) => {
    if (!token || markingHere) return;
    setMarkingHere(true);
    try {
      let coords: { lat?: number; lng?: number } = {};
      try {
        coords = await getCurrentPosition();
      } catch {
        // still signal without GPS
      }
      const next = await api.rides.markReady(rideId, token, coords);
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, ...next } : r)));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de signaler votre position');
    } finally {
      setMarkingHere(false);
    }
  };

  const activeMissions = missions.filter((m) =>
    ['pending', 'accepted', 'en_route', 'picked_up', 'in_progress'].includes(m.status),
  );
  const activeRides = rides.filter((r) =>
    ['searching', 'assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(r.status),
  );
  const liveRide = activeRides.find((ride) =>
    ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(ride.status),
  );
  const liveRideRef = useRef<string | null>(null);

  useEffect(() => {
    if (!liveRide) {
      if (liveRideRef.current) {
        liveRideRef.current = null;
        syncRideLiveActivity(null);
      }
      return;
    }
    liveRideRef.current = liveRide.id;
    const title =
      liveRide.status === 'in_progress'
        ? 'Course en cours'
        : liveRide.status === 'driver_arrived'
          ? 'Le chauffeur vous attend'
          : 'Chauffeur en route';
    syncRideLiveActivity({
      rideId: liveRide.id,
      status: liveRide.status,
      title,
      subtitle: vehicleIdentityLine({
        color: liveRide.vehicleColor,
        brand: liveRide.vehicleBrand,
        model: liveRide.vehicleModel,
        plate: liveRide.vehiclePlate,
      }),
    });
  }, [
    liveRide?.id,
    liveRide?.status,
    liveRide?.vehicleColor,
    liveRide?.vehicleBrand,
    liveRide?.vehicleModel,
    liveRide?.vehiclePlate,
  ]);
  const recentMissions = missions
    .filter((m) => ['delivered', 'returned_to_client', 'cancelled'].includes(m.status))
    .slice(0, 3);
  const unseenCount = unreadNotifCount;

  const handleShareReferral = async () => {
    if (!user?.referralCode) {
      Alert.alert('Parrainage', 'Votre code de parrainage n’est pas encore disponible.');
      return;
    }
    try {
      await Share.share({
        message: `Rejoins Bag'up avec mon code ${user.referralCode} ! Je gagne du crédit quand tu fais ton 1er paiement.`,
      });
    } catch {
      Alert.alert('Code de parrainage', user.referralCode);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const handleNotifPress = () => {
    navigation?.navigate('Notifications');
  };

  const handleServicePress = (tile: ServiceTile) => {
    setSelectedService(tile);
  };

  const continueSelectedService = () => {
    const tile = selectedService;
    setSelectedService(null);
    if (!tile) return;
    if (tile.action === 'market') {
      if (!MARKETPLACE_ENABLED) {
        Alert.alert('Bientôt', 'La Marketplace arrive très bientôt.');
        return;
      }
      navigation?.getParent()?.navigate('MarketHome');
      return;
    }
    if (tile.action === 'antigaspi') {
      navigation?.getParent()?.navigate('AntiGaspiBrowse');
      return;
    }
    navigation?.navigate('CreateRequest', { serviceType: tile.serviceType });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, Spacing.lg) }]}>
        <View style={styles.brandRow}>
          <TouchableOpacity
            style={styles.avatarBtn}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate('Profile')}
          >
            {avatarUri && !avatarFailed ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                resizeMode="cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <Ionicons name="person" size={18} color={Colors.primaryDark} />
            )}
          </TouchableOpacity>
          <View style={styles.brandTextCol}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation?.navigate('Profile')}>
              <Text style={styles.brandName} numberOfLines={1}>
                {user?.firstName || "Bag'up"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationRow}
              activeOpacity={0.75}
              onPress={() => refreshLocation()}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
            >
              <Ionicons name="location" size={12} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {shortLabel
                  ? shortLabel
                  : locLoading
                    ? 'Localisation…'
                    : 'Activer ma position'}
              </Text>
              {locLoading ? (
                <Ionicons name="sync" size={11} color={Colors.gray400} />
              ) : (
                <Ionicons name="chevron-down" size={12} color={Colors.gray400} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn} activeOpacity={0.85} onPress={handleNotifPress}>
          <Ionicons name="notifications-outline" size={22} color={Colors.gray700} />
          {unseenCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unseenCount}</Text>
          </View>
          )}
          </TouchableOpacity>
        </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 110, 130) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>
            {getGreeting()}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </Text>
          <Text style={styles.heroQuestion}>Où voulez-vous aller aujourd’hui ?</Text>
        </View>

        <TouchableOpacity
          style={[styles.searchBar, Shadows.sm]}
          activeOpacity={0.9}
          onPress={() => setShowDestinationModal(true)}
        >
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.searchPlaceholder}>Destination, service, adresse…</Text>
          <View style={styles.searchHintChip}>
            <Ionicons name="navigate" size={12} color={Colors.primaryDark} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rideHero, Shadows.lg]}
          activeOpacity={0.94}
          onPress={() => navigation?.getParent()?.navigate('RideRequest')}
        >
          <ExpoImage
            key={`ride-hero-fleet-${imageEpoch}`}
            source={RIDE_HERO_FLEET}
            style={styles.rideHeroFleet}
            contentFit="cover"
            contentPosition="right center"
            cachePolicy="memory-disk"
            recyclingKey={`ride-hero-${imageEpoch}`}
            transition={0}
          />
          <LinearGradient
            colors={['rgba(4,36,36,0.92)', 'rgba(6,55,55,0.55)', 'rgba(6,55,55,0.08)']}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rideHeroScrim}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(3,28,28,0.75)']}
            locations={[0.35, 1]}
            style={styles.rideHeroBottomFade}
            pointerEvents="none"
          />
          <View style={styles.rideHeroContent} pointerEvents="box-none">
            <View style={styles.rideHeroTop}>
              <View style={styles.rideHeroChip}>
                <Ionicons name="flash" size={11} color={Colors.gray900} />
                <Text style={styles.rideHeroChipText}>Course</Text>
              </View>
            </View>
            <View style={styles.rideHeroCopy}>
              <Text style={styles.rideHeroTitle}>Une course{'\n'}maintenant</Text>
              <Text style={styles.rideHeroSub}>Moto ou voiture · prix avant de partir</Text>
              <View style={styles.rideHeroCta}>
                <Text style={styles.rideHeroCtaText}>Commander</Text>
                <View style={styles.rideHeroCtaArrow}>
                  <Ionicons name="arrow-forward" size={14} color={Colors.gray900} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionEyebrow}>Services</Text>
        <View key={`service-grid-${imageEpoch}`} style={styles.serviceGrid} collapsable={false}>
          {serviceTiles.map((tile) => {
            const selected = selectedService?.id === tile.id;
            return (
              <TouchableOpacity
                key={tile.id}
                style={[
                  styles.serviceTileWrap,
                  { backgroundColor: tile.colors[0] },
                  selected && styles.serviceTileWrapSelected,
                ]}
                activeOpacity={0.88}
                onPress={() => handleServicePress(tile)}
                collapsable={false}
              >
                <View style={styles.serviceTile} collapsable={false}>
                  <ExpoImage
                    key={`tile-img-${tile.id}-${imageEpoch}`}
                    source={tile.image}
                    style={styles.serviceTileImgAbs}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={`tile-${tile.id}-${imageEpoch}`}
                    transition={0}
                  />
                  <LinearGradient
                    colors={['transparent', withAlpha(tile.colors[0], 0.92)]}
                    locations={[0.2, 1]}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <View style={styles.serviceTileContent}>
                    <View style={styles.serviceTileIconWrap}>
                      <Ionicons name={tile.icon} size={18} color={Colors.white} />
                    </View>
                    <Text style={styles.serviceTileTitle} numberOfLines={2}>
                      {tile.title}
                    </Text>
                    {selected && (
                      <View style={styles.serviceTileCheck}>
                        <Ionicons name="checkmark" size={12} color={Colors.white} />
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeRides.length > 0 && (
          <View style={[styles.activeCard, Shadows.md]}>
            <View style={styles.activeAccent} />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation?.getParent()?.navigate('RideRequest', { rideId: activeRides[0].id })}
            >
              <View style={styles.activeCardTop}>
                <View style={styles.activePulse} />
                <Text style={styles.activeLabel}>Course en cours</Text>
                <Text style={styles.activeStatus}>
                  {activeRides[0].status === 'searching'
                    ? 'Recherche…'
                    : activeRides[0].status === 'in_progress'
                      ? 'En course'
                      : 'Chauffeur'}
                </Text>
              </View>
              <Text style={styles.activeRoute} numberOfLines={1}>
                {activeRides[0].pickupAddress} → {activeRides[0].dropoffAddress}
              </Text>
              <View style={styles.activeCta}>
                <Text style={styles.activeCtaText}>Suivre la course</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
              </View>
            </TouchableOpacity>
            {['assigned', 'driver_en_route', 'driver_arrived'].includes(activeRides[0].status) &&
              !activeRides[0].passengerReadyAt && (
                <TouchableOpacity
                  style={styles.imHereHome}
                  onPress={() => handleImHere(activeRides[0].id)}
                  disabled={markingHere}
                  activeOpacity={0.88}
                >
                  <Text style={styles.imHereHomeText}>
                    {markingHere ? 'Envoi…' : 'Oui, je suis ici'}
                  </Text>
                </TouchableOpacity>
              )}
            {!!activeRides[0].passengerReadyAt &&
              ['assigned', 'driver_en_route', 'driver_arrived'].includes(activeRides[0].status) && (
                <Text style={styles.imHereHomeDone}>Chauffeur notifié — vous êtes sur place</Text>
              )}
          </View>
        )}

        {activeMissions.length > 0 && (
          <TouchableOpacity
            style={[styles.activeCard, Shadows.md]}
            activeOpacity={0.9}
            onPress={() => navigation?.navigate('Tracking', { missionId: activeMissions[0].id })}
          >
            <View style={styles.activeAccent} />
            <View style={styles.activeCardTop}>
              <View style={styles.activePulse} />
              <Text style={styles.activeLabel}>Mission en cours</Text>
              <Text style={styles.activeStatus}>
                {statusLabels[activeMissions[0].status] || activeMissions[0].status}
              </Text>
            </View>
            <Text style={styles.activeRoute} numberOfLines={1}>
              {activeMissions[0].pickupAddress} → {activeMissions[0].deliveryAddress}
            </Text>
            <View style={styles.activeCta}>
              <Text style={styles.activeCtaText}>Suivre</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.howSection}>
          <Text style={styles.howEyebrow}>Guide rapide</Text>
          <Text style={styles.howTitle}>Comment ça marche ?</Text>
          <Text style={styles.howLead}>Choisissez un service, suivez 4 étapes simples.</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.howTabs}
          >
            {howItWorksTopics.map((topic) => {
              const active = topic.id === howTopic.id;
              return (
                <TouchableOpacity
                  key={topic.id}
                  style={[
                    styles.howTab,
                    active && { backgroundColor: topic.color, borderColor: topic.color },
                  ]}
                  activeOpacity={0.88}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setHowTopicId(topic.id);
                  }}
                >
                  <Ionicons name={topic.icon} size={15} color={active ? Colors.white : topic.color} />
                  <Text style={[styles.howTabText, active && styles.howTabTextActive]}>{topic.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.howCard, Shadows.md]}>
            <View style={[styles.howCardAccent, { backgroundColor: howTopic.color }]} />
            <View style={styles.howCardHeader}>
              <View style={[styles.howCardIcon, { backgroundColor: howTopic.soft }]}>
                <Ionicons name={howTopic.icon} size={22} color={howTopic.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.howCardTitle}>{howTopic.label}</Text>
                <Text style={styles.howCardSub}>Parcours simple et suivi</Text>
                </View>
                </View>

            {howTopic.steps.map((step, index) => (
              <View key={`${howTopic.id}-${index}`} style={styles.howStepRow}>
                <View style={styles.howStepRail}>
                  <View style={[styles.howStepDot, { backgroundColor: howTopic.color }]}>
                    <Text style={styles.howStepNum}>{index + 1}</Text>
              </View>
                  {index < howTopic.steps.length - 1 && (
                    <View style={[styles.howStepLine, { backgroundColor: howTopic.soft }]} />
                  )}
            </View>
                <View style={[styles.howStepBody, index === howTopic.steps.length - 1 && { marginBottom: 0 }]}>
                  <View style={[styles.howStepIconWrap, { backgroundColor: howTopic.soft }]}>
                    <Ionicons name={step.icon} size={18} color={howTopic.color} />
          </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howStepTitle}>{step.title}</Text>
                    <Text style={styles.howStepDesc}>{step.desc}</Text>
            </View>
          </View>
            </View>
            ))}
          </View>
        </View>

        <View style={styles.featuredHeader}>
          <Text style={styles.featuredTitle}>À la une</Text>
        </View>

        <TouchableOpacity
          style={[styles.featuredCard, Shadows.md]}
          activeOpacity={0.92}
          onPress={handleFeaturedPress}
        >
          <View style={[styles.featuredBg, { backgroundColor: '#14532D' }]}>
            <ExpoImage
              key={`featured-${imageEpoch}-${featuredFailed ? 'local' : 'auto'}`}
              source={featuredSource}
              style={styles.featuredBgImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={`home-featured-${imageEpoch}`}
              transition={0}
              onError={() => setFeaturedFailed(true)}
            />
            <LinearGradient
              colors={['rgba(12,50,30,0.9)', 'rgba(20,80,40,0.55)', 'rgba(0,0,0,0.1)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.featuredGradient}
            >
              <View style={styles.featuredContent}>
                <View style={styles.featuredBadge}>
                  <Ionicons name="leaf" size={12} color={Colors.white} />
                  <Text style={styles.featuredBadgeText}>{featuredBanner?.badge || 'Anti-Gaspi'}</Text>
                </View>
                <Text style={styles.featuredHeadline}>
                  {featuredBanner?.headline || 'Luttons ensemble contre le gaspillage'}
                </Text>
                <Text style={styles.featuredSub}>
                  {featuredBanner?.subtitle || 'Découvrez les offres près de chez vous'}
                </Text>
                <View style={styles.featuredBtn}>
                  <Text style={styles.featuredBtnText}>{featuredBanner?.ctaLabel || 'Voir les offres'}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.white} />
                </View>
              </View>
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {MARKETPLACE_ENABLED && (
          <TouchableOpacity
            style={[styles.marketShortcut, Shadows.sm]}
            activeOpacity={0.9}
            onPress={() => navigation?.getParent()?.navigate('MarketHome')}
          >
            <LinearGradient colors={['#5B21B6', '#7C3AED']} style={styles.marketShortcutGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.marketShortcutIcon}>
                <Ionicons name="storefront" size={20} color={Colors.white} />
            </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.marketShortcutTitle}>Explorer la Marketplace</Text>
                <Text style={styles.marketShortcutSub}>Produits, boutiques et offres du moment</Text>
            </View>
              <Ionicons name="chevron-forward" size={20} color={withAlpha('#fff', 0.9)} />
          </LinearGradient>
        </TouchableOpacity>
        )}

        {recentMissions.length > 0 && (
          <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Historique récent</Text>
              <TouchableOpacity onPress={() => navigation?.navigate('Activity')} hitSlop={8}>
                <Text style={styles.sectionLink}>Voir tout</Text>
              </TouchableOpacity>
        </View>
            {recentMissions.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.historyCard, Shadows.sm]}
                activeOpacity={0.88}
                onPress={() => navigation?.navigate('Tracking', { missionId: m.id })}
              >
                <View style={styles.historyIcon}>
                  <Ionicons name="cube-outline" size={18} color={Colors.primary} />
            </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyRoute} numberOfLines={1}>
                    {m.pickupAddress} → {m.deliveryAddress}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {statusLabels[m.status] || m.status}
                    {m.price != null ? ` · ${Number(m.price).toLocaleString()} F` : ''}
                  </Text>
          </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="trophy-outline" size={18} color={tierUi(loyalty?.currentTier?.key).color} />
          <Text style={styles.sectionTitle}>Fidélité</Text>
            </View>
        </View>
        <TouchableOpacity
          style={[styles.referralCard, Shadows.sm]}
          activeOpacity={0.85}
          onPress={() => navigation?.getParent()?.navigate('Loyalty')}
        >
            <View style={{ flex: 1 }}>
            <Text style={styles.referralLabel}>Niveau {loyalty?.currentTier?.name || 'Ivoire'}</Text>
              <Text style={styles.referralCode}>
                {loyalty?.completedCount ?? 0} activité{(loyalty?.completedCount || 0) > 1 ? 's' : ''}
              </Text>
              <Text style={styles.referralSub}>
                {loyalty?.nextTier
                  ? `Encore ${loyalty.remainingToNext} pour passer ${loyalty.nextTier.name}`
                  : 'Gold — bon et panier offert chaque mois'}
              </Text>
          </View>
            <View style={[styles.referralBtn, { backgroundColor: tierUi(loyalty?.currentTier?.key).color }]}>
              <Ionicons name={tierUi(loyalty?.currentTier?.key).icon as any} size={16} color={Colors.white} />
              <Text style={styles.referralBtnText}>Voir</Text>
          </View>
        </TouchableOpacity>
                </View>

        <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="gift-outline" size={18} color={Colors.accent} />
          <Text style={styles.sectionTitle}>Parrainage</Text>
            </View>
        </View>
        <View style={[styles.referralCard, Shadows.sm]}>
            <View style={{ flex: 1 }}>
            <Text style={styles.referralLabel}>Votre code</Text>
              <Text style={styles.referralCode}>{user?.referralCode || '—'}</Text>
              <Text style={styles.referralSub}>
                Client +500 F · livreur/commerçant +1000 F (après leur 1er paiement)
              </Text>
          </View>
            <TouchableOpacity style={styles.referralBtn} onPress={handleShareReferral} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={16} color={Colors.white} />
              <Text style={styles.referralBtnText}>Partager</Text>
          </TouchableOpacity>
        </View>
                </View>

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
            <TouchableOpacity
              style={[styles.hotlineBtn, { backgroundColor: Colors.info }]}
              onPress={() => Linking.openURL(SUPPORT_MAILTO_URL)}
              activeOpacity={0.85}
            >
              <Ionicons name="mail" size={16} color={Colors.white} />
              <Text style={styles.hotlineBtnText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showDestinationModal} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.destinationModalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            >
          <View style={styles.destinationModalContent}>
            <View style={styles.destinationModalHeader}>
                  <Text style={styles.destinationModalTitle}>Que souhaitez-vous faire ?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowDestinationModal(false);
                      setDestinationSearch('');
                      setDestinationResults([]);
                    }}
                  >
                <Ionicons name="close" size={24} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.destinationSearchBox}>
              <Ionicons name="search" size={20} color={Colors.gray400} />
              <TextInput
                style={styles.destinationSearchInput}
                    placeholder="Destination, quartier, ville..."
                placeholderTextColor={Colors.gray400}
                value={destinationSearch}
                onChangeText={handleDestinationSearch}
                autoFocus
              />
              {destinationSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setDestinationSearch('');
                        setDestinationResults([]);
                      }}
                    >
                  <Ionicons name="close-circle" size={20} color={Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            {destinationResults.length > 0 ? (
              <FlatList
                data={destinationResults}
                keyExtractor={(item, index) => `${item.label}-${index}`}
                renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.destinationResultItem}
                        onPress={() => handleSelectDestination(item)}
                        activeOpacity={0.7}
                      >
                    <View style={styles.destinationResultIcon}>
                      <Ionicons name="location" size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.destinationResultInfo}>
                      <Text style={styles.destinationResultLabel}>{item.label}</Text>
                          <Text style={styles.destinationResultCity}>
                            {item.city}, {item.country}
                          </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={Colors.gray300} />
                  </TouchableOpacity>
                )}
                style={styles.destinationResultsList}
              />
            ) : destinationSearch.length >= 2 ? (
              <View style={styles.destinationEmpty}>
                <Ionicons name="location-outline" size={40} color={Colors.gray300} />
                <Text style={styles.destinationEmptyText}>Aucun résultat trouvé</Text>
              </View>
            ) : (
                  <View style={styles.quickActionsModal}>
                    <Text style={styles.destinationHintsTitle}>Accès rapide</Text>
                    {[
                      { label: 'Collecte & Livraison', serviceType: 'colis', icon: 'cube' as const },
                      { label: 'Démarche administrative', serviceType: 'depot_administratif', icon: 'document-text' as const },
                    ].map((item) => (
                  <TouchableOpacity 
                        key={item.serviceType}
                    style={styles.destinationHintItem}
                        onPress={() => {
                          setShowDestinationModal(false);
                          navigation?.navigate('CreateRequest', { serviceType: item.serviceType });
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={item.icon} size={16} color={Colors.primary} />
                        <Text style={styles.destinationHintText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity 
              style={styles.destinationSkipBtn} 
                  onPress={() => {
                    setShowDestinationModal(false);
                    navigation?.navigate('CreateRequest');
                  }}
              activeOpacity={0.8}
            >
              <Text style={styles.destinationSkipText}>Continuer sans destination</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
            </KeyboardAvoidingView>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Absolute sheet — RN Modal blanks Android tile surfaces when push/FCM is active */}
      {!!selectedService && (
        <View style={styles.serviceSheetOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedService(null)}
          />
          <View style={[styles.serviceSheet, { paddingBottom: Math.max(insets.bottom + Spacing.base, Spacing.xl) }]}>
            <View style={styles.serviceSheetHandle} />
            <View style={styles.serviceSheetHeader}>
              <View style={[styles.serviceSheetIcon, { backgroundColor: selectedService.colors[1] }]}>
                <Ionicons name={selectedService.icon} size={22} color={Colors.white} />
              </View>
              <Text style={styles.serviceSheetTitle}>
                {selectedService.title.replace('\n', ' ')}
              </Text>
            </View>
            <Text style={styles.serviceSheetBlurb}>{selectedService.blurb}</Text>
            <TouchableOpacity
              style={styles.serviceSheetCta}
              activeOpacity={0.9}
              onPress={continueSelectedService}
            >
              <Text style={styles.serviceSheetCtaText}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.serviceSheetCancel}
              onPress={() => setSelectedService(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceSheetCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: Spacing.sm },
  brandTextCol: { flex: 1, minWidth: 0 },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.white,
    ...Shadows.xs,
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  brandName: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    maxWidth: '100%',
  },
  locationText: {
    flexShrink: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray700,
  },
  brandSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 1,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: 9,
    color: Colors.white,
  },
  content: { flex: 1 },
  heroCopy: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  greeting: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.gray900,
    letterSpacing: -0.6,
  },
  heroQuestion: {
    marginTop: 6,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray500,
    lineHeight: 22,
  },
  searchBar: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    minHeight: 54,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray100,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
  },
  searchHintChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideHero: {
    marginHorizontal: GRID_PAD,
    marginBottom: Spacing.xl,
    height: RIDE_HERO_H,
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
    backgroundColor: '#042424',
  },
  rideHeroFleet: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  rideHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  rideHeroBottomFade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  rideHeroContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    zIndex: 2,
  },
  rideHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideHeroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  rideHeroChipText: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray900,
    letterSpacing: 0.3,
  },
  rideHeroCopy: {
    maxWidth: '72%',
    gap: 8,
  },
  rideHeroTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 30,
    lineHeight: 34,
    color: Colors.white,
    letterSpacing: -0.8,
  },
  rideHeroSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  rideHeroCta: {
    alignSelf: 'flex-start',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  rideHeroCtaText: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  rideHeroCtaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEyebrow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  serviceGrid: {
    paddingHorizontal: GRID_PAD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Spacing.lg,
    justifyContent: 'flex-start',
  },
  serviceTileWrap: {
    width: TILE_W,
    borderRadius: BorderRadius.xl,
  },
  serviceTileWrapSelected: {
    borderWidth: 2,
    borderColor: Colors.secondary,
    transform: [{ scale: 0.98 }],
  },
  serviceTile: {
    minHeight: 118,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  serviceTileImg: {
    borderRadius: BorderRadius.xl,
  },
  serviceTileImgAbs: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.xl,
  },
  serviceTileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  serviceTileContent: {
    minHeight: 118,
    padding: Spacing.md,
    justifyContent: 'flex-end',
    gap: 8,
    position: 'relative',
    zIndex: 1,
  },
  serviceTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: withAlpha('#fff', 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTileTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    lineHeight: 18,
  },
  serviceTileCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha('#000', 0.45),
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  serviceSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  serviceSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
    marginBottom: Spacing.base,
  },
  serviceSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  serviceSheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceSheetTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 20,
    color: Colors.gray900,
  },
  serviceSheetBlurb: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 15,
    color: Colors.gray600,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  serviceSheetCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
  },
  serviceSheetCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 16,
    color: Colors.white,
  },
  serviceSheetCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  serviceSheetCancelText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 14,
    color: Colors.gray500,
  },
  activeCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.gray100,
    overflow: 'hidden',
  },
  activeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.primary,
  },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  activeLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  activeStatus: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  activeRoute: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    marginBottom: Spacing.sm,
  },
  activeCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  imHereHome: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  imHereHomeText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  imHereHomeDone: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    textAlign: 'center',
  },
  activeCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  featuredHeader: {
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  featuredTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  featuredCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
  },
  featuredBg: {
    width: '100%',
    minHeight: 158,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius['2xl'],
  },
  featuredBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    minHeight: 158,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  featuredContent: { flex: 1, paddingRight: Spacing.sm, maxWidth: '70%' },
  featuredBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withAlpha('#fff', 0.2),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  featuredBadgeText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  featuredHeadline: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
    marginBottom: 4,
  },
  featuredSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha('#fff', 0.9),
    marginBottom: Spacing.md,
  },
  featuredBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha('#fff', 0.22),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featuredBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  marketShortcut: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  marketShortcutGrad: {
    minHeight: 72,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  marketShortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: withAlpha('#fff', 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketShortcutTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  marketShortcutSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: withAlpha('#fff', 0.85),
    marginTop: 2,
  },
  sectionBlock: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  sectionLink: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRoute: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  historyMeta: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
  },
  referralLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
  },
  referralCode: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.accent,
    marginTop: 2,
  },
  referralSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 4,
  },
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  referralBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  hotlineCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
  },
  hotlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  hotlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(Colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  hotlineSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  hotlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hotlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  hotlineBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  howSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  howEyebrow: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  howTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.gray900,
    letterSpacing: -0.4,
  },
  howLead: {
    marginTop: 6,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  howTabs: {
    gap: 8,
    paddingBottom: Spacing.md,
    paddingRight: Spacing.sm,
  },
  howTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  howTabText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  howTabTextActive: {
    color: Colors.white,
  },
  howCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.base,
    overflow: 'hidden',
  },
  howCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  howCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
    paddingLeft: 4,
  },
  howCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howCardTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  howCardSub: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  howStepRow: {
    flexDirection: 'row',
    paddingLeft: 4,
  },
  howStepRail: {
    width: 28,
    alignItems: 'center',
  },
  howStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepNum: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: 11,
    color: Colors.white,
  },
  howStepLine: {
    width: 3,
    flex: 1,
    minHeight: 28,
    borderRadius: 2,
    marginVertical: 4,
  },
  howStepBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginLeft: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  howStepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  howStepDesc: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    lineHeight: 16,
  },
  destinationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  destinationModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  destinationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  destinationModalTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  destinationSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    marginBottom: Spacing.md,
  },
  destinationSearchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    paddingVertical: 10,
  },
  destinationResultsList: { maxHeight: 280 },
  destinationResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  destinationResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationResultInfo: { flex: 1 },
  destinationResultLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  destinationResultCity: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  destinationEmpty: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  destinationEmptyText: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  quickActionsModal: { marginBottom: Spacing.md },
  destinationHintsTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  destinationHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  destinationHintText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  destinationSkipBtn: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  destinationSkipText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
});
