import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Paiement',
  awaiting_preparation: 'Préparation',
  collection_scheduled: 'Collecte',
  collected: 'Collecté',
  in_transit: 'En route',
  delivered: 'Livré',
  cancelled: 'Annulé',
  dispute: 'Litige',
};

export const MarketOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const { format } = useMarketCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.marketplace.myOrders(token);
      setOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
    } finally {
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Mes commandes</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
            <Ionicons name="bag-handle-outline" size={40} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>Pas encore de commande</Text>
            <Text style={styles.emptyText}>Parcourez les boutiques Sénégal pour commencer.</Text>
            <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('MarketHome')}>
              <Text style={styles.ctaText}>Voir les boutiques</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => {
              if (item.missionId && !['pending_payment', 'awaiting_preparation', 'cancelled'].includes(item.status)) {
                navigation.navigate('Tracking', { missionId: item.missionId });
              } else {
                navigation.navigate('MarketOrderDetail', { orderId: item.id });
              }
            }}
          >
            <View style={styles.row}>
              <Text style={styles.shop}>{item.shop?.name || 'Boutique'}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
              </View>
            </View>
            <Text style={styles.orderNo}>{item.orderNumber}</Text>
            <Text style={styles.amount}>{format(Number(item.totalXof))}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 17, color: Colors.gray900 },
  list: { padding: Spacing.base, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shop: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900, flex: 1 },
  badge: {
    backgroundColor: withAlpha(Colors.primary, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 11, color: Colors.primaryDark },
  orderNo: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginTop: 6 },
  amount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 16, color: Colors.primaryDark, marginTop: 8 },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 28 },
  emptyTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 17, color: Colors.gray700, marginTop: 12 },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 13,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 6,
  },
  cta: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  ctaText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 14, color: Colors.white },
});
