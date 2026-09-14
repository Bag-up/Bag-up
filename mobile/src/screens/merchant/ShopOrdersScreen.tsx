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

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Paiement',
  awaiting_preparation: 'À préparer',
  collection_scheduled: 'Collecte',
  collected: 'Collecté',
  in_transit: 'En livraison',
  delivered: 'Livré',
  cancelled: 'Annulé',
  dispute: 'Litige',
};

const STATUS_COLOR: Record<string, string> = {
  awaiting_preparation: Colors.warning,
  collection_scheduled: Colors.info,
  collected: Colors.info,
  in_transit: Colors.primary,
  delivered: Colors.success,
  cancelled: Colors.gray500,
};

function formatXof(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} F`;
}

export const ShopOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.marketplace.shopOrders(token);
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
        <Text style={styles.topTitle}>Commandes</Text>
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
            <Ionicons name="receipt-outline" size={40} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptyText}>Les ventes de votre boutique apparaîtront ici.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const accent = STATUS_COLOR[item.status] || Colors.gray500;
          const deadline = item.preparationDeadline
            ? new Date(item.preparationDeadline)
            : null;
          const hoursLeft =
            item.status === 'awaiting_preparation' && deadline
              ? Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3600000))
              : null;

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('ShopOrderDetail', { orderId: item.id })}
            >
              <View style={styles.row}>
                <Text style={styles.orderNo}>{item.orderNumber}</Text>
                <View style={[styles.badge, { backgroundColor: withAlpha(accent, 0.12) }]}>
                  <Text style={[styles.badgeText, { color: accent }]}>
                    {STATUS_LABEL[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.items} numberOfLines={1}>
                {(item.items || []).map((i: any) => `${i.quantity}× ${i.productName}`).join(' · ')}
              </Text>
              <View style={styles.row}>
                <Text style={styles.amount}>{formatXof(Number(item.totalXof))}</Text>
                {hoursLeft != null && (
                  <Text style={styles.deadline}>
                    {hoursLeft > 0 ? `${hoursLeft} h restantes` : 'Deadline dépassée'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
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
  orderNo: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 11 },
  items: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 13,
    color: Colors.gray600,
    marginTop: 8,
  },
  amount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 16,
    color: Colors.primaryDark,
    marginTop: 10,
  },
  deadline: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 12,
    color: Colors.warning,
    marginTop: 10,
  },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 28 },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: 17,
    color: Colors.gray700,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 13,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 6,
  },
});
