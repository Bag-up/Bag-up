import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api, resolveMediaUrl } from '../../services/api';

interface Props {
  navigation?: any;
  onBack?: () => void;
}

function formatPickup(start?: string, end?: string) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const t1 = s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const t2 = e ? e.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  return t2 ? `${day} · ${t1}–${t2}` : `${day} · ${t1}`;
}

export const AntiGaspiBrowseScreen: React.FC<Props> = ({ navigation, onBack }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [baskets, setBaskets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.antiGaspi.baskets(token);
      setBaskets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('antiGaspi.baskets', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, Spacing['2xl']) }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Anti-Gaspi</Text>
        <TouchableOpacity
          onPress={() => navigation?.navigate('AntiGaspiReservations')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Paniers surplus près de vous — sauvez de la nourriture</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={baskets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="leaf-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>Aucun panier disponible</Text>
              <Text style={styles.emptyText}>Revenez plus tard, les commerçants publient en fin de journée.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, Shadows.sm]}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('AntiGaspiBasket', { basketId: item.id })}
            >
              {resolveMediaUrl(item.photoUrl) ? (
                <ExpoImage
                  source={{ uri: resolveMediaUrl(item.photoUrl)! }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Ionicons name="basket" size={32} color={Colors.primary} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.merchant} numberOfLines={1}>
                  {item.merchant?.businessName || item.merchant?.firstName || 'Commerçant'}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  <Ionicons name="location-outline" size={12} color={Colors.gray500} />{' '}
                  {item.pickupAddress}
                </Text>
                <Text style={styles.meta}>{formatPickup(item.pickupStartAt, item.pickupEndAt)}</Text>
                <View style={styles.row}>
                  <Text style={styles.price}>{Number(item.price).toLocaleString()} FCFA</Text>
                  {item.distanceKm != null && (
                    <Text style={styles.distance}>{Number(item.distanceKm).toFixed(1)} km</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  photo: { width: 100, height: 110 },
  photoPlaceholder: { backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: Spacing.md, justifyContent: 'center' },
  title: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  merchant: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    marginTop: 2,
  },
  meta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  price: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  distance: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray700,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
