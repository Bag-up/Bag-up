import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const MerchantPayoutsScreen: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.antiGaspi.merchantPayouts(token);
      setItems(Array.isArray(data) ? data : []);
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

  const total = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [items],
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>Revenus</Text>
        <Text style={styles.headerSub}>Reversements après double confirmation</Text>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total versé</Text>
          <Text style={styles.totalValue}>{total.toLocaleString()} FCFA</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={items}
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
                <Ionicons name="wallet-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Pas encore de reversement</Text>
              <Text style={styles.emptyText}>
                Après le paiement client, confirmez la remise dans Retraits. Le client doit aussi
                confirmer — le montant apparaît alors ici.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, Shadows.sm]}>
              <View style={styles.cardLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons name="cash-outline" size={20} color={Colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.reservation?.basket?.title || 'Panier'}
                  </Text>
                  <Text style={styles.meta}>
                    {item.status === 'success' ? 'Versé' : item.status}
                    {item.paidAt
                      ? ` · ${new Date(item.paidAt).toLocaleDateString('fr-FR')}`
                      : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.amount}>+{Number(item.amount).toLocaleString()} F</Text>
            </View>
          )}
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
  totalCard: {
    marginTop: Spacing.lg,
    backgroundColor: withAlpha(Colors.white, 0.18),
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: withAlpha(Colors.white, 0.25),
  },
  totalLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.9),
  },
  totalValue: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
    marginTop: 4,
  },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  meta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  amount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.success,
  },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: Spacing.xl },
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
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
