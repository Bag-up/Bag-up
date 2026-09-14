import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
  Dimensions,
  Alert,
  Linking,
  TextInput,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { AddressInput } from '../../components/ui/AddressInput';
import { Button } from '../../components/ui/Button';
import { DriverVehicleCard } from '../../components/DriverVehicleCard';
import { useAuth } from '../../context/AuthContext';
import { useUserLocation } from '../../context/UserLocationContext';
import { api } from '../../services/api';
import { GeoAddress } from '../../services/location';
import { SenegalLocation } from '../../constants/senegalLocations';
import { routing, LatLng } from '../../services/routing';
import { vehicleTypeIcon, vehicleIdentityLine } from '../../constants/vehicle';
import { getCurrentPosition } from '../../services/location';
import { syncRideLiveActivity } from '../../services/rideLiveActivity';

type VehicleMode = 'moto' | 'voiture';

type Props = {
  onBack: () => void;
  navigation?: any;
  initialRideId?: string;
};

type Phase = 'compose' | 'searching' | 'assigned' | 'completed';

type RidePayload = {
  id: string;
  status: string;
  estimatedPrice?: number;
  finalPrice?: number | null;
  vehicleMode?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLat?: string | null;
  pickupLng?: string | null;
  dropoffLat?: string | null;
  dropoffLng?: string | null;
  isPaid?: boolean;
  isRated?: boolean;
  passengerReadyAt?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverRating?: number | null;
  driverLat?: string | null;
  driverLng?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  driver?: {
    id?: string;
    firstName?: string;
    phone?: string;
    rating?: number;
    avatarUrl?: string | null;
    vehicle?: { plate?: string; brand?: string; model?: string; color?: string; type?: string };
  } | null;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAKAR = { latitude: 14.7167, longitude: -17.4677, latitudeDelta: 0.06, longitudeDelta: 0.06 };

function assignedEtaCopy(
  status?: string,
  etaMin?: number | null,
  arrivalClock?: string | null,
) {
  if (status === 'in_progress') {
    return {
      title: etaMin != null ? `Durée restante : ≈${etaMin} min` : 'Course en cours',
      subtitle: arrivalClock ? `Arrivée vers ${arrivalClock}` : undefined,
    };
  }
  if (status === 'driver_arrived') {
    return {
      title: 'Le chauffeur vous attend',
      subtitle: undefined as string | undefined,
    };
  }
  if (etaMin == null) {
    return {
      title: 'Chauffeur trouvé',
      subtitle: 'Localisation en cours',
    };
  }
  return {
    title: `Arrive dans ≈${etaMin} min`,
    subtitle: arrivalClock ? `Prise en charge vers ${arrivalClock}` : undefined,
  };
}

function parseCoord(lat?: string | null, lng?: string | null) {
  if (lat == null || lng == null) return null;
  const a = parseFloat(lat);
  const b = parseFloat(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { lat: a, lng: b };
}

export const RideRequestScreen: React.FC<Props> = ({ onBack, navigation, initialRideId }) => {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const { token } = useAuth();
  const { address: cachedLocation, refresh: refreshUserLocation } = useUserLocation();
  const mapRef = useRef<MapView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const composeScrollRef = useRef<ScrollView>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>('moto');
  const [locating, setLocating] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('compose');
  const [ride, setRide] = useState<RidePayload | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [etaDistanceKm, setEtaDistanceKm] = useState<number | null>(null);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [lockScroll, setLockScroll] = useState(false);
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);

  useEffect(() => {
    if (phase !== 'compose') setAddressMenuOpen(false);
  }, [phase]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (phase !== 'assigned') {
      sheetAnim.setValue(0);
      return;
    }
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, {
      toValue: 1,
      friction: 8,
      tension: 64,
      useNativeDriver: true,
    }).start();
  }, [phase, sheetAnim, ride?.id]);

  useEffect(() => {
    const pulsing =
      phase === 'assigned' &&
      !!ride &&
      ['assigned', 'driver_en_route'].includes(ride.status);
    if (!pulsing) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, ride?.status, pulseAnim]);

  useEffect(() => {
    setDetailsOpen(false);
  }, [ride?.id]);

  const hydrateFromRide = useCallback((next: RidePayload) => {
    if (next.pickupAddress) setPickupLabel(next.pickupAddress);
    if (next.dropoffAddress) setDropoffLabel(next.dropoffAddress);
    const pickup = parseCoord(next.pickupLat, next.pickupLng);
    const dropoff = parseCoord(next.dropoffLat, next.dropoffLng);
    if (pickup) setPickupCoords(pickup);
    if (dropoff) setDropoffCoords(dropoff);
    if (next.vehicleMode === 'moto' || next.vehicleMode === 'voiture') {
      setVehicleMode(next.vehicleMode);
    }
    if (next.estimatedPrice != null) setPrice(Number(next.estimatedPrice));
  }, []);

  const applyPickup = useCallback((addr: GeoAddress | SenegalLocation) => {
    setPickupLabel(addr.label);
    setPickupCoords({ lat: addr.lat, lng: addr.lng });
  }, []);

  const applyDropoff = useCallback((addr: GeoAddress | SenegalLocation) => {
    setDropoffLabel(addr.label);
    setDropoffCoords({ lat: addr.lat, lng: addr.lng });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocating(true);
      try {
        if (cachedLocation) {
          applyPickup(cachedLocation);
          mapRef.current?.animateToRegion({
            latitude: cachedLocation.lat,
            longitude: cachedLocation.lng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
          if (!cancelled) setLocating(false);
        }
        const addr = await refreshUserLocation();
        if (!cancelled && addr) {
          applyPickup(addr);
          mapRef.current?.animateToRegion({
            latitude: addr.lat,
            longitude: addr.lng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
        }
      } catch {
        // GPS refusé : l'utilisateur saisit le départ
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Une seule init au montage : la position partagée préremplit le départ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyPickup, refreshUserLocation]);

  useEffect(() => {
    if (!token || !pickupCoords || !dropoffCoords) {
      setPrice(null);
      setDistanceKm(null);
      setDurationMin(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setEstimating(true);
      api.geo
        .estimateRide(
          String(pickupCoords.lat),
          String(pickupCoords.lng),
          String(dropoffCoords.lat),
          String(dropoffCoords.lng),
          vehicleMode,
          token,
        )
        .then((res) => {
          if (cancelled) return;
          setPrice(typeof res.price === 'number' ? res.price : null);
          setDistanceKm(typeof res.distanceKm === 'number' ? res.distanceKm : null);
          setDurationMin(typeof res.durationMin === 'number' ? res.durationMin : null);
        })
        .catch(() => {
          if (!cancelled) {
            setPrice(null);
            setDistanceKm(null);
            setDurationMin(null);
          }
        })
        .finally(() => {
          if (!cancelled) setEstimating(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, pickupCoords, dropoffCoords, vehicleMode]);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return;
    mapRef.current?.fitToCoordinates(
      [
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
      ],
      { edgePadding: { top: 80, right: 40, bottom: 320, left: 40 }, animated: true },
    );
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) {
      setRouteCoords([]);
      setRouteEtaMin(null);
      return;
    }
    const controller = new AbortController();
    const trackingDriver =
      !!driverLoc &&
      ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(ride?.status || '');
    const origin = trackingDriver && driverLoc ? driverLoc : pickupCoords;
    const target =
      ride?.status === 'in_progress' || phase === 'completed'
        ? dropoffCoords
        : trackingDriver
          ? pickupCoords
          : dropoffCoords;

    routing
      .getRoute(origin, target, controller.signal)
      .then((res) => {
        if (res?.coordinates?.length) setRouteCoords(res.coordinates);
        else setRouteCoords([origin, target]);

        if (trackingDriver && res?.durationSeconds != null) {
          setRouteEtaMin(Math.max(1, Math.ceil(res.durationSeconds / 60)));
          if (res.distanceMeters != null) {
            setEtaDistanceKm(Math.round((res.distanceMeters / 1000) * 10) / 10);
          }
        } else if (!trackingDriver) {
          setRouteEtaMin(null);
        }
      })
      .catch(() => {
        setRouteCoords([origin, target]);
        if (!trackingDriver) setRouteEtaMin(null);
      });

    return () => controller.abort();
  }, [pickupCoords, dropoffCoords, driverLoc, ride?.status, phase]);

  const startPolling = useCallback(
    (rideId: string) => {
      stopPoll();
      const tick = async () => {
        if (!token) return;
        try {
          const next = (await api.rides.byId(rideId, token)) as RidePayload | null;
          if (!next) return;
          setRide(next);
          hydrateFromRide(next);

          if (
            ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(next.status)
          ) {
            setPhase('assigned');
            try {
              const loc = await api.rides.getLocation(rideId, token);
              if (loc?.driverLat && loc?.driverLng) {
                const lat = parseFloat(loc.driverLat);
                const lng = parseFloat(loc.driverLng);
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                  setDriverLoc({ lat, lng });
                }
              }
              if (loc?.etaToPickupMin != null) {
                setEtaMin(loc.etaToPickupMin);
              } else if (loc?.etaToDropoffMin != null) {
                setEtaMin(loc.etaToDropoffMin);
              } else {
                setEtaMin(null);
              }
              if (loc?.distanceToTargetKm != null) {
                setEtaDistanceKm(loc.distanceToTargetKm);
              }
            } catch {
              // ignore
            }
          }

          if (next.status === 'completed') {
            setPhase('completed');
            setRatingDone(!!next.isRated);
            stopPoll();
          } else if (next.status === 'cancelled') {
            stopPoll();
            setPhase('compose');
            setRide(null);
            setDriverLoc(null);
            setEtaMin(null);
            setRouteEtaMin(null);
            setEtaDistanceKm(null);
            Alert.alert('Course annulée', 'La course a été annulée.');
          }
        } catch {
          // ignore transient poll errors
        }
      };
      tick();
      pollRef.current = setInterval(tick, 3000);
    },
    [stopPoll, token, hydrateFromRide],
  );

  useEffect(() => {
    if (!driverLoc || phase !== 'assigned') return;
    const pts = [
      driverLoc,
      pickupCoords,
      dropoffCoords,
    ].filter(Boolean) as { lat: number; lng: number }[];
    if (pts.length < 2) return;
    mapRef.current?.fitToCoordinates(
      pts.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 100, right: 40, bottom: 340, left: 40 }, animated: true },
    );
  }, [driverLoc, pickupCoords, dropoffCoords, phase]);

  const canOrder =
    !!pickupCoords && !!dropoffCoords && price != null && phase === 'compose' && !estimating && !ordering;

  const handleOrder = async () => {
    if (!canOrder || !token || !pickupCoords || !dropoffCoords || price == null) return;
    setOrdering(true);
    try {
      const created = (await api.rides.create(
        {
          pickupAddress: pickupLabel,
          dropoffAddress: dropoffLabel,
          vehicleMode,
          pickupLat: String(pickupCoords.lat),
          pickupLng: String(pickupCoords.lng),
          dropoffLat: String(dropoffCoords.lat),
          dropoffLng: String(dropoffCoords.lng),
          estimatedPrice: price,
        },
        token,
      )) as RidePayload;
      setRide(created);
      setPhase('searching');
      startPolling(created.id);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de commander la course');
    } finally {
      setOrdering(false);
    }
  };

  const handleCancelSearch = () => {
    const confirmCancel = async () => {
      if (!token || !ride?.id) {
        setPhase('compose');
        return;
      }
      try {
        await api.rides.cancel(ride.id, token);
      } catch (e: any) {
        Alert.alert('Annulation', e?.message || 'Impossible d’annuler');
        return;
      }
      stopPoll();
      setRide(null);
      setDriverLoc(null);
      setEtaMin(null);
      setRouteEtaMin(null);
      setEtaDistanceKm(null);
      setPhase('compose');
    };

    if (ride?.status && ride.status !== 'searching') {
      Alert.alert('Annuler la course', 'Confirmer l’annulation ?', [
        { text: 'Non', style: 'cancel' },
        { text: 'Oui, annuler', style: 'destructive', onPress: confirmCancel },
      ]);
      return;
    }
    confirmCancel();
  };

  const payAmount = Number(ride?.finalPrice ?? ride?.estimatedPrice ?? price ?? 0);

  const handlePay = () => {
    Alert.alert(
      'Paiement en espèces',
      'Payez directement le chauffeur. Il confirmera la réception dans l’application Bag’up.',
    );
  };

  const handleSubmitRating = async () => {
    const ratedId = ride?.driverId || ride?.driver?.id;
    if (!token || !ride?.id || !ratedId || score < 1) return;
    setSubmittingRating(true);
    try {
      await api.ratings.create(
        { rideId: ride.id, ratedId, score, comment: ratingComment.trim() || undefined },
        token,
      );
      setRatingDone(true);
      setRide((prev) => (prev ? { ...prev, isRated: true } : prev));
      Alert.alert('Merci', 'Votre note a été enregistrée.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d’envoyer la note');
    } finally {
      setSubmittingRating(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!token || !ride?.id || phase !== 'completed') return;
      api.rides
        .byId(ride.id, token)
        .then((next: any) => {
          setRide(next);
          setRatingDone(!!next.isRated);
        })
        .catch(() => {});
    }, [token, ride?.id, phase]),
  );

  useEffect(() => {
    if (!initialRideId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const next = (await api.rides.byId(initialRideId, token)) as RidePayload;
        if (cancelled || !next) return;
        setRide(next);
        hydrateFromRide(next);
        if (next.status === 'completed') {
          setPhase('completed');
          setRatingDone(!!next.isRated);
        } else if (next.status === 'cancelled') {
          Alert.alert('Course annulée', 'Cette course a été annulée et ne peut plus être reprise. Créez une nouvelle course si besoin.');
          setRide(null);
          setPhase('compose');
        } else if (next.status === 'searching') {
          setPhase('searching');
          startPolling(next.id);
        } else if (
          ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(next.status)
        ) {
          setPhase('assigned');
          startPolling(next.id);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRideId, token, startPolling, hydrateFromRide]);

  const callDriver = () => {
    const phone = ride?.driverPhone || ride?.driver?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleImHere = async () => {
    if (!token || !ride?.id || markingReady) return;
    setMarkingReady(true);
    try {
      let lat = pickupCoords?.lat;
      let lng = pickupCoords?.lng;
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
      } catch {
        // fallback pickup pin
      }
      const next = (await api.rides.markReady(ride.id, token, { lat, lng })) as RidePayload;
      setRide(next);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de signaler votre position');
    } finally {
      setMarkingReady(false);
    }
  };

  const region = pickupCoords
    ? {
        latitude: pickupCoords.lat,
        longitude: pickupCoords.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : DAKAR;

  const driverDisplayName = ride?.driverName || ride?.driver?.firstName || 'Chauffeur';
  const plate = ride?.vehiclePlate || ride?.driver?.vehicle?.plate;
  const resolvedVehicleType =
    ride?.vehicleType || ride?.driver?.vehicle?.type || ride?.vehicleMode || vehicleMode;
  const vehicleBrand = ride?.vehicleBrand || ride?.driver?.vehicle?.brand;
  const vehicleModel = ride?.vehicleModel || ride?.driver?.vehicle?.model;
  const vehicleColor = ride?.vehicleColor || ride?.driver?.vehicle?.color;
  const rating = ride?.driverRating ?? ride?.driver?.rating;
  const displayEtaMin = routeEtaMin ?? etaMin;
  const etaArrivalClock =
    displayEtaMin != null
      ? new Date(Date.now() + displayEtaMin * 60_000).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  const isLateHint =
    displayEtaMin != null &&
    displayEtaMin >= 12 &&
    ['assigned', 'driver_en_route'].includes(ride?.status || '');
  const driverPhone = ride?.driverPhone || ride?.driver?.phone;
  const etaCopy = assignedEtaCopy(ride?.status, displayEtaMin, etaArrivalClock);
  const canCancelRide = ['assigned', 'driver_en_route', 'driver_arrived'].includes(ride?.status || '');
  const waitingDriver = ['assigned', 'driver_en_route', 'driver_arrived'].includes(ride?.status || '');
  const identityLine = vehicleIdentityLine({
    color: vehicleColor,
    brand: vehicleBrand,
    model: vehicleModel,
    plate,
  });
  const passengerReady = !!ride?.passengerReadyAt;

  useEffect(() => {
    if (phase !== 'assigned' || !ride) {
      if (phase === 'completed' || phase === 'compose') {
        syncRideLiveActivity(null);
      }
      return;
    }
    const endsAt =
      displayEtaMin != null && ride.status !== 'driver_arrived'
        ? Date.now() + displayEtaMin * 60_000
        : null;
    syncRideLiveActivity({
      rideId: ride.id,
      status: ride.status,
      title: etaCopy.title,
      subtitle: identityLine || driverDisplayName,
      endsAt,
    });
  }, [
    phase,
    ride?.id,
    ride?.status,
    displayEtaMin,
    etaCopy.title,
    identityLine,
    driverDisplayName,
  ]);

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailsOpen((open) => !open);
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled={!lockScroll}
        pitchEnabled={false}
      >
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            title="Départ"
          >
            <View style={styles.stopPin}>
              <View style={[styles.stopDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.stopLabel}>Départ</Text>
            </View>
          </Marker>
        )}
        {dropoffCoords && (
          <Marker
            coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }}
            title="Destination"
          >
            <View style={styles.stopPin}>
              <View style={[styles.stopDot, { backgroundColor: Colors.accent }]} />
              <Text style={styles.stopLabel}>Arrivée</Text>
            </View>
          </Marker>
        )}
        {pickupCoords && dropoffCoords && (
          <Polyline
            coordinates={
              routeCoords.length > 1
                ? routeCoords.map((c) => ({ latitude: c.lat, longitude: c.lng }))
                : [
                    { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                    { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
                  ]
            }
            strokeColor={Colors.primary}
            strokeWidth={4}
          />
        )}
        {driverLoc && (
          <Marker
            coordinate={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
            title="Chauffeur"
            description={driverDisplayName}
          >
            <Animated.View style={[styles.driverPin, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons
                name={vehicleTypeIcon(resolvedVehicleType)}
                size={18}
                color={Colors.white}
              />
            </Animated.View>
          </Marker>
        )}
        {driverLoc && (
          <Circle
            center={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
            radius={180}
            strokeColor={withAlpha(Colors.primary, 0.35)}
            fillColor={withAlpha(Colors.primary, 0.12)}
          />
        )}
      </MapView>

      <View
        style={[
          styles.sheetWrap,
          { bottom: keyboardHeight },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              maxHeight: Math.max(
                280,
                Dimensions.get('window').height - insets.top - 48 - keyboardHeight,
              ),
            },
          ]}
        >
          {phase === 'compose' && (
            <>
              <View style={styles.sheetTop}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    onBack();
                  }}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
                </TouchableOpacity>
                <Text style={styles.sheetTopTitle}>Course</Text>
                <View style={{ width: 40 }} />
              </View>
              <ScrollView
                ref={composeScrollRef}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode={addressMenuOpen ? 'none' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{ paddingBottom: addressMenuOpen ? 12 : 8 }}
              >
              {!addressMenuOpen ? (
                <View style={styles.serviceAreaBanner}>
                  <Ionicons name="location-outline" size={16} color={Colors.primary} />
                  <Text style={styles.serviceAreaText}>
                    Les courses sont disponibles à Dakar pour le moment
                  </Text>
                </View>
              ) : null}
              {!addressMenuOpen ? (
                <Text style={styles.sheetEyebrow}>Où allez-vous ?</Text>
              ) : null}
              <View style={[styles.field, addressMenuOpen && styles.fieldRaised]}>
                <Text style={styles.fieldLabel}>Départ</Text>
                <AddressInput
                  value={pickupLabel}
                  onChangeText={(t) => {
                    setPickupLabel(t);
                    setPickupCoords(null);
                  }}
                  onSelect={applyPickup}
                  onDropdownInteract={setLockScroll}
                  onMenuChange={(open) => {
                    setAddressMenuOpen(open);
                    if (open) {
                      requestAnimationFrame(() => {
                        composeScrollRef.current?.scrollTo({ y: 0, animated: true });
                      });
                    }
                  }}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      composeScrollRef.current?.scrollTo({ y: 0, animated: true });
                    });
                  }}
                  placeholder={locating ? 'Position en cours…' : 'Adresse de départ'}
                  icon="navigate-circle"
                  iconColor={Colors.primary}
                  showLocBtn
                />
              </View>
              <View style={[styles.field, addressMenuOpen && styles.fieldRaised]}>
                <Text style={styles.fieldLabel}>Destination</Text>
                <AddressInput
                  value={dropoffLabel}
                  onChangeText={(t) => {
                    setDropoffLabel(t);
                    setDropoffCoords(null);
                  }}
                  onSelect={(loc) => {
                    applyDropoff(loc);
                    Keyboard.dismiss();
                  }}
                  onDropdownInteract={setLockScroll}
                  onMenuChange={(open) => {
                    setAddressMenuOpen(open);
                    if (open) {
                      requestAnimationFrame(() => {
                        composeScrollRef.current?.scrollToEnd({ animated: true });
                      });
                    }
                  }}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      composeScrollRef.current?.scrollToEnd({ animated: true });
                    });
                  }}
                  placeholder="Où allez-vous ?"
                  icon="location"
                  iconColor={Colors.accent}
                  showLocBtn
                />
              </View>

              {!addressMenuOpen ? (
                <View style={styles.vehicleRow}>
                  {(
                    [
                      { id: 'moto' as const, label: 'Moto', icon: 'bicycle' as const },
                      { id: 'voiture' as const, label: 'Voiture', icon: 'car' as const },
                    ] as const
                  ).map((opt) => {
                    const on = vehicleMode === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.vehicleChip, on && styles.vehicleChipOn]}
                        onPress={() => setVehicleMode(opt.id)}
                        activeOpacity={0.88}
                      >
                        <Ionicons name={opt.icon} size={20} color={on ? Colors.primary : Colors.gray500} />
                        <Text style={[styles.vehicleChipText, on && styles.vehicleChipTextOn]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              </ScrollView>

              {!addressMenuOpen ? (
              <View style={styles.stickyCta}>
                <View style={styles.quoteRow}>
                  {estimating ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : price != null ? (
                    <>
                      <View>
                        <Text style={styles.quotePrice}>{price.toLocaleString('fr-FR')} F</Text>
                        <Text style={styles.quoteMeta}>
                          {[
                            distanceKm != null ? `${distanceKm.toFixed(1)} km` : null,
                            durationMin != null ? `~${durationMin} min` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Text style={styles.quoteHint}>Prix estimé</Text>
                    </>
                  ) : (
                    <Text style={styles.quotePlaceholder}>
                      Choisissez départ et destination pour voir le prix
                    </Text>
                  )}
                </View>
                <Button
                  title={ordering ? 'Envoi…' : 'Commander'}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleOrder();
                  }}
                  disabled={!canOrder}
                />
              </View>
              ) : null}
            </>
          )}

          {phase === 'searching' && (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.searchTitle}>Recherche d’un chauffeur…</Text>
              <Text style={styles.searchSub}>
                {price != null ? `${price.toLocaleString('fr-FR')} F · ${vehicleMode}` : ''}
                {ride?.matchingRank
                  ? `\nChauffeur n°${ride.matchingRank} contacté à proximité`
                  : '\nNous contactons le plus proche, puis le suivant si besoin'}
              </Text>
              <TouchableOpacity onPress={handleCancelSearch} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'assigned' && ride && (
            <Animated.View
              style={[
                styles.assignedBlock,
                {
                  opacity: sheetAnim,
                  transform: [
                    {
                      translateY: sheetAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [28, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={toggleDetails}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                accessibilityLabel={etaCopy.title}
              >
                <View style={styles.etaHeadlineRow}>
                  <View style={styles.etaHeadlineText}>
                    <Text style={styles.etaHeadline}>{etaCopy.title}</Text>
                    {!!etaCopy.subtitle && <Text style={styles.etaSub}>{etaCopy.subtitle}</Text>}
                  </View>
                  <Ionicons
                    name={detailsOpen ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={Colors.gray400}
                  />
                </View>
              </TouchableOpacity>

              <DriverVehicleCard
                name={driverDisplayName}
                rating={rating}
                avatarUrl={ride.driver?.avatarUrl}
                vehicleType={resolvedVehicleType}
                brand={vehicleBrand}
                model={vehicleModel}
                color={vehicleColor}
                plate={plate}
                compact
              />

              {waitingDriver && !passengerReady && (
                <TouchableOpacity
                  style={styles.imHereCta}
                  onPress={handleImHere}
                  disabled={markingReady}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Oui, je suis ici"
                >
                  <Ionicons name="navigate" size={18} color={Colors.white} />
                  <Text style={styles.imHereCtaText}>
                    {markingReady ? 'Envoi…' : 'Oui, je suis ici'}
                  </Text>
                </TouchableOpacity>
              )}
              {waitingDriver && passengerReady && (
                <View style={styles.imHereDone}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                  <Text style={styles.imHereDoneText}>Le chauffeur sait que vous êtes là</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                {!!driverPhone && (
                  <TouchableOpacity style={styles.callCta} onPress={callDriver} activeOpacity={0.88}>
                    <Ionicons name="call" size={18} color={Colors.white} />
                    <Text style={styles.callCtaText}>Appeler</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.detailsCta}
                  onPress={toggleDetails}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                >
                  <Ionicons name="grid-outline" size={18} color={Colors.gray900} />
                  <Text style={styles.detailsCtaText}>Détails</Text>
                </TouchableOpacity>
              </View>
              {isLateHint ? (
                <Text style={styles.lateHint}>Il semble en retard ? Appelez-le.</Text>
              ) : null}

              {detailsOpen && (
                <View style={styles.detailsList}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color={Colors.accent} />
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>
                        {waitingDriver && etaArrivalClock
                          ? `Prise en charge vers ${etaArrivalClock}`
                          : 'Prise en charge'}
                      </Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {pickupLabel || ride.pickupAddress || 'Départ'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="flag" size={16} color={Colors.gray700} />
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>
                        {ride.status === 'in_progress' && etaArrivalClock
                          ? `Arrivée vers ${etaArrivalClock}`
                          : 'Destination'}
                      </Text>
                      <Text style={styles.detailValue} numberOfLines={2}>
                        {dropoffLabel || ride.dropoffAddress || 'Destination'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color={Colors.success} />
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>Prix estimé</Text>
                      <Text style={styles.detailValue}>
                        {(ride.estimatedPrice ?? price)?.toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                  </View>
                  {canCancelRide && (
                    <TouchableOpacity onPress={handleCancelSearch} style={styles.cancelLink}>
                      <Text style={styles.cancelLinkText}>Annuler la course</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {phase === 'completed' && (
            <View style={styles.assignedBlock}>
              <View style={styles.centerBlock}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
                <Text style={styles.searchTitle}>Course terminée</Text>
                <Text style={styles.searchSub}>
                  {payAmount.toLocaleString('fr-FR')} F · {driverDisplayName}
                </Text>
              </View>

              {!ride?.isPaid ? (
                <View style={styles.cashPayBox}>
                  <Ionicons name="cash-outline" size={22} color={Colors.primary} />
                  <Text style={styles.searchSub}>
                    Payez le chauffeur en espèces ({payAmount.toLocaleString('fr-FR')} FCFA). Il confirmera la réception dans l’app.
                  </Text>
                </View>
              ) : (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                  <Text style={styles.paidText}>Paiement confirmé par le chauffeur</Text>
                </View>
              )}

              {ride?.isPaid && !ratingDone && (ride.driverId || ride.driver?.id) && (
                <View style={styles.rateBlock}>
                  <Text style={styles.rateTitle}>Noter le chauffeur</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => setScore(n)} activeOpacity={0.85}>
                        <Ionicons
                          name={n <= score ? 'star' : 'star-outline'}
                          size={32}
                          color={n <= score ? Colors.warning : Colors.gray300}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.rateInput}
                    placeholder="Commentaire (optionnel)"
                    placeholderTextColor={Colors.gray400}
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                  />
                  <Button
                    title={submittingRating ? 'Envoi…' : 'Envoyer la note'}
                    onPress={handleSubmitRating}
                    disabled={score < 1 || submittingRating}
                  />
                </View>
              )}

              {ratingDone && (
                <Text style={styles.searchSub}>Merci pour votre avis.</Text>
              )}

              <Button title="Retour à l’accueil" onPress={onBack} />
            </View>
          )}
        </View>
      </View>

      {phase !== 'compose' && (
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Keyboard.dismiss();
              if (phase === 'searching') {
                handleCancelSearch();
                return;
              }
              onBack();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Course</Text>
          <View style={{ width: 40 }} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray100 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 30,
    elevation: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  topTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    ...Shadows.md,
  },
  sheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sheetTopTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  stickyCta: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.gray200,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.white,
  },
  sheetEyebrow: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  serviceAreaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  serviceAreaText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primaryDark,
    lineHeight: 18,
  },
  field: { marginBottom: Spacing.sm },
  fieldRaised: { zIndex: 40, elevation: 40 },
  fieldLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginBottom: 4,
  },
  vehicleRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  vehicleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
  },
  vehicleChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  vehicleChipText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
  },
  vehicleChipTextOn: { color: Colors.primary },
  quoteRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  quotePrice: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 28,
    color: Colors.gray900,
  },
  quoteMeta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginTop: 2,
  },
  quoteHint: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
  },
  quotePlaceholder: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
  },
  centerBlock: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  assignedBlock: { paddingTop: Spacing.xs, gap: Spacing.md },
  etaHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: Spacing.sm,
  },
  etaHeadlineText: { flex: 1, minWidth: 0 },
  etaHeadline: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
  },
  etaSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginTop: 2,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  imHereCta: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
  },
  imHereCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  imHereDone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imHereDoneText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  callCta: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
  },
  callCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  detailsCta: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
  },
  detailsCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  lateHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    textAlign: 'center',
  },
  detailsList: { gap: Spacing.md, paddingTop: Spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  detailValue: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    marginTop: 2,
  },
  driverPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stopPin: { alignItems: 'center' },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  stopLabel: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 10,
    color: Colors.gray900,
    backgroundColor: withAlpha(Colors.white, 0.92),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  searchTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    textAlign: 'center',
  },
  searchSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  cancelLink: { marginTop: Spacing.sm, alignSelf: 'center' },
  cancelLinkText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.accent,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
  },
  cashPayBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paidText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  rateBlock: { gap: Spacing.sm },
  rateTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
  },
  rateInput: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
});
