import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  available: { label: 'Disponible', bg: Colors.successSoft, text: Colors.success },
  reserved: { label: 'Réservé', bg: Colors.infoSoft, text: Colors.info },
  sold: { label: 'Vendu', bg: Colors.primarySoft, text: Colors.primary },
  expired: { label: 'Expiré', bg: Colors.gray100, text: Colors.gray500 },
  cancelled: { label: 'Annulé', bg: Colors.accentSoft, text: Colors.accent },
};

export const MerchantBasketsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [baskets, setBaskets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.antiGaspi.merchantBaskets(token);
      setBaskets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
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

  const cancel = (id: string) => {
    Alert.alert('Retirer le panier', 'Ce panier ne sera plus visible pour les clients.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.antiGaspi.cancelBasket(id, token!);
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Impossible');
          }
        },
      },
    ]);
  };

  const activeCount = baskets.filter((b) => ['available', 'reserved'].includes(b.status)).length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Mes paniers</Text>
            <Text style={styles.headerSub}>
              {activeCount}/3 actifs · {baskets.length} au total
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.getParent()?.navigate('MerchantPublish')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={baskets}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
              <View style={styles.emptyIcon}>
                <Ionicons name="basket-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun panier</Text>
              <Text style={styles.emptyText}>
                Publiez un surplus pour le proposer aux clients Bag’up.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.getParent()?.navigate('MerchantPublish')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCtaText}>Publier un panier</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS[item.status] || STATUS.available;
            return (
              <View style={[styles.card, Shadows.sm]}>
                <View style={styles.cardTop}>
                  {resolveMediaUrl(item.photoUrl) ? (
                    <Image source={{ uri: resolveMediaUrl(item.photoUrl)! }} style={styles.photo} />
                  ) : (
                    <LinearGradient
                      colors={Colors.gradientPrimary}
                      style={styles.photo}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="leaf" size={26} color={Colors.white} />
                    </LinearGradient>
                  )}
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <Text style={[styles.pillText, { color: st.text }]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.price}>{Number(item.price).toLocaleString()} FCFA</Text>
                    <Text style={styles.meta}>
                      Vous recevez {Number(item.merchantAmount).toLocaleString()} F · −
                      {Number(item.commissionAmount).toLocaleString()} F commission
                    </Text>
                  </View>
                </View>
                {item.status === 'available' && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => cancel(item.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.accent} />
                    <Text style={styles.cancelText}>Retirer de la vente</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  headerSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
    marginTop: 4,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', gap: Spacing.md },
  photo: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
  },
  price: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  meta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 4,
    lineHeight: 16,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  cancelText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.accent,
  },
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyCtaText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
});
