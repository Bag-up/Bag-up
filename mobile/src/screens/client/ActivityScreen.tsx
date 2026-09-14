import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { vehicleModeLabel } from '../../constants/vehicle';

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
  searching: 'Recherche',
  assigned: 'Chauffeur trouvé',
  driver_en_route: 'Chauffeur en route',
  driver_arrived: 'Arrivé',
  completed: 'Terminée',
};

const statusColors: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning, icon: 'time' },
  accepted: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'checkmark-circle' },
  en_route: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'navigate' },
  picked_up: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'cube' },
  in_progress: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'bicycle' },
  delivered: { bg: withAlpha(Colors.success, 0.12), text: Colors.success, icon: 'checkmark-done-circle' },
  cancelled: { bg: withAlpha(Colors.accent, 0.12), text: Colors.accent, icon: 'close-circle' },
  dossier_deposed: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'business' },
  admin_processing: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning, icon: 'time' },
  document_ready: { bg: withAlpha(Colors.success, 0.12), text: Colors.success, icon: 'document-text' },
  document_collected: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'download' },
  returned_to_client: { bg: withAlpha(Colors.success, 0.12), text: Colors.success, icon: 'checkmark-done-circle' },
  searching: { bg: withAlpha(Colors.warning, 0.12), text: Colors.warning, icon: 'search' },
  assigned: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'person' },
  driver_en_route: { bg: withAlpha(Colors.info, 0.12), text: Colors.info, icon: 'navigate' },
  driver_arrived: { bg: withAlpha(Colors.primary, 0.12), text: Colors.primary, icon: 'flag' },
  completed: { bg: withAlpha(Colors.success, 0.12), text: Colors.success, icon: 'checkmark-done-circle' },
};

const serviceLabels: Record<string, string> = {
  colis: 'Collecte & Livraison',
  documents: 'Documents',
  courses: 'Liste de courses',
  marchandises: 'Transport marchandises',
  objets_personnels: 'Objet personnel',
  administratif: 'Démarches',
  depot_administratif: 'Démarches',
  livraison_entreprise: 'Livraison entreprise',
  collecte_marchandises: 'Collecte marchandises',
  pro: 'Collecte & Livraison pro',
};

const serviceIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  colis: 'cube',
  documents: 'document-text',
  courses: 'cart',
  marchandises: 'cube-outline',
  objets_personnels: 'cube-outline',
  administratif: 'business',
  depot_administratif: 'business',
  livraison_entreprise: 'storefront-outline',
  collecte_marchandises: 'download-outline',
};

const MISSION_ACTIVE = [
  'pending',
  'accepted',
  'en_route',
  'picked_up',
  'in_progress',
  'dossier_deposed',
  'admin_processing',
  'document_ready',
  'document_collected',
];
const MISSION_DONE = ['delivered', 'returned_to_client'];
const RIDE_ACTIVE = ['searching', 'assigned', 'driver_en_route', 'driver_arrived', 'in_progress'];

type HistoryItem = {
  id: string;
  kind: 'ride' | 'mission';
  createdAt: string;
  status: string;
  title: string;
  from: string;
  to: string;
  price: number;
  icon: keyof typeof Ionicons.glyphMap;
  raw: any;
};

interface Props {
  navigation?: any;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActivityScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMissions = useCallback(async () => {
    if (!token) return;
    try {
      const [data, rideData] = await Promise.all([
        api.missions.mine(token),
        api.rides.mine(token).catch(() => []),
      ]);
      setMissions(Array.isArray(data) ? data : []);
      setRides(Array.isArray(rideData) ? rideData : []);
    } catch (e) {
      console.error('ActivityScreen fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
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

  const totalCount = missions.length + rides.length;
  const activeCount =
    missions.filter((m) => MISSION_ACTIVE.includes(m.status)).length +
    rides.filter((r) => RIDE_ACTIVE.includes(r.status)).length;
  const doneCount =
    missions.filter((m) => MISSION_DONE.includes(m.status)).length +
    rides.filter((r) => r.status === 'completed').length;
  const totalSpent =
    missions.reduce((sum, m) => sum + Number(m.price || 0), 0) +
    rides.reduce((sum, r) => {
      if (r.isPaid || r.status === 'completed') {
        return sum + Number(r.finalPrice ?? r.estimatedPrice ?? 0);
      }
      return sum;
    }, 0);

  const history = useMemo<HistoryItem[]>(() => {
    const rideItems: HistoryItem[] = rides.map((r) => ({
      id: `ride-${r.id}`,
      kind: 'ride',
      createdAt: r.createdAt,
      status: r.status,
      title: `Course · ${vehicleModeLabel(r.vehicleMode || r.vehicleType) || 'Passager'}`,
      from: r.pickupAddress || 'Départ',
      to: r.dropoffAddress || 'Destination',
      price: Number(r.finalPrice ?? r.estimatedPrice ?? 0),
      icon: (r.vehicleMode || r.vehicleType) === 'voiture' ? 'car' : 'bicycle',
      raw: r,
    }));
    const missionItems: HistoryItem[] = missions.map((m) => ({
      id: `mission-${m.id}`,
      kind: 'mission',
      createdAt: m.createdAt,
      status: m.status,
      title: serviceLabels[m.serviceType] || m.serviceType || 'Mission',
      from: m.pickupAddress || 'Retrait',
      to: m.deliveryAddress || 'Livraison',
      price: Number(m.price || 0),
      icon: serviceIcons[m.serviceType] || 'cube',
      raw: m,
    }));
    return [...rideItems, ...missionItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [missions, rides]);

  const openItem = (item: HistoryItem) => {
    if (item.kind === 'ride') {
      if (item.status === 'cancelled') {
        Alert.alert('Course annulée', 'Cette course est annulée et ne peut plus être reprise.');
        return;
      }
      navigation?.getParent()?.navigate('RideRequest', { rideId: item.raw.id });
      return;
    }
    navigation?.navigate('Tracking', { missionId: item.raw.id });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <Text style={styles.headerTitle}>Mon activité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <LinearGradient
          colors={Colors.gradientPrimary}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryIcon}>
            <Ionicons name="flash" size={22} color={Colors.white} />
          </View>
          <Text style={styles.summaryLabel}>Total activité</Text>
          <Text style={styles.summaryAmount}>{totalCount}</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatNum}>{activeCount}</Text>
              <Text style={styles.summaryStatLabel}>En cours</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatNum}>{doneCount}</Text>
              <Text style={styles.summaryStatLabel}>Terminées</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatNum}>{totalSpent.toLocaleString('fr-FR')}</Text>
              <Text style={styles.summaryStatLabel}>FCFA</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Chargement…</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={32} color={Colors.gray300} />
              </View>
              <Text style={styles.emptyText}>Aucune activité</Text>
              <Text style={styles.emptySub}>Vos courses et livraisons apparaîtront ici</Text>
            </View>
          ) : (
            history.map((item) => {
              const sc = statusColors[item.status] || statusColors.pending;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyRow}
                  activeOpacity={0.85}
                  onPress={() => openItem(item)}
                >
                  <View
                    style={[
                      styles.historyIcon,
                      {
                        backgroundColor:
                          item.kind === 'ride'
                            ? withAlpha(Colors.primary, 0.12)
                            : withAlpha(Colors.info, 0.1),
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.kind === 'ride' ? Colors.primary : Colors.info}
                    />
                  </View>
                  <View style={styles.historyBody}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyPrice}>
                        {item.price.toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>{formatWhen(item.createdAt)}</Text>
                    <Text style={styles.historyRoute} numberOfLines={1}>
                      {item.from} → {item.to}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Ionicons name={sc.icon} size={11} color={sc.text} />
                      <Text style={[styles.statusText, { color: sc.text }]} numberOfLines={1}>
                        {statusLabels[item.status] || item.status}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  summaryCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.primary,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.85,
  },
  summaryAmount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  summaryStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  summaryStat: { alignItems: 'center', paddingHorizontal: Spacing.md },
  summaryStatNum: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
  },
  summaryStatLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    opacity: 0.7,
    marginTop: 2,
  },
  summaryDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl, paddingBottom: Spacing.xl },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.gray500,
  },
  emptySub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBody: { flex: 1, minWidth: 0, gap: 3 },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  historyTitle: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  historyPrice: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  historyDate: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
  },
  historyRoute: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
  },
});
