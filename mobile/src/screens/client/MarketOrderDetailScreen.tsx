import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';
import { CurrencySwitch } from '../../components/marketplace/CurrencySwitch';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'En attente de paiement',
  awaiting_preparation: 'Le commerçant prépare',
  collection_scheduled: 'Collecte en cours',
  collected: 'Colis récupéré',
  in_transit: 'En livraison',
  delivered: 'Livré',
  cancelled: 'Annulé',
  dispute: 'Litige',
};

const ORDER_STEPS = [
  { key: 'pending_payment', label: 'Paiement' },
  { key: 'awaiting_preparation', label: 'Préparation' },
  { key: 'collection_scheduled', label: 'Collecte' },
  { key: 'in_transit', label: 'Livraison' },
  { key: 'delivered', label: 'Livré' },
] as const;

function orderStepIndex(status: string): number {
  switch (status) {
    case 'pending_payment':
      return 0;
    case 'awaiting_preparation':
      return 1;
    case 'collection_scheduled':
    case 'collected':
      return 2;
    case 'in_transit':
      return 3;
    case 'delivered':
      return 4;
    default:
      return -1;
  }
}

function OrderStepper({ status }: { status: string }) {
  const idx = orderStepIndex(status);
  if (idx < 0) return null;
  return (
    <View style={styles.stepper}>
      {ORDER_STEPS.map((step, i) => {
        const done = i <= idx;
        const active = i === idx;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                done && styles.stepDotDone,
                active && styles.stepDotActive,
              ]}
            />
            {i < ORDER_STEPS.length - 1 && (
              <View style={[styles.stepLine, i < idx && styles.stepLineDone]} />
            )}
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const MarketOrderDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId as string;
  const { token } = useAuth();
  const { format, currency, setCurrency } = useMarketCurrency();
  const [order, setOrder] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrder(await api.marketplace.getOrder(orderId, token));
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [token, orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 8000);
      return () => clearInterval(interval);
    }, [load]),
  );

  const canTrack =
    order?.missionId &&
    !['pending_payment', 'awaiting_preparation', 'cancelled'].includes(order?.status);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{order?.orderNumber || 'Commande'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
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
      >
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Statut</Text>
          <Text style={styles.statusValue}>{STATUS_LABEL[order?.status] || order?.status || '…'}</Text>
          <Text style={styles.shop}>{order?.shop?.name}</Text>
          {order?.status ? <OrderStepper status={order.status} /> : null}
        </View>

        {(order?.items || []).map((item: any) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineL}>
              {item.quantity}× {item.productName}
            </Text>
            <Text style={styles.lineR}>
              {format(Number(item.unitPriceXof) * Number(item.quantity))}
            </Text>
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.sectionInline}>Montants</Text>
            <CurrencySwitch currency={currency} onChange={setCurrency} />
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Produit</Text>
            <Text style={styles.lineR}>{format(Number(order?.productTotalXof || 0))}</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Livraison</Text>
            <Text style={styles.lineR}>{format(Number(order?.deliveryFeeXof || 0))}</Text>
          </View>
          <View style={[styles.line, { marginBottom: 0 }]}>
            <Text style={styles.totalL}>Total TTC</Text>
            <Text style={styles.totalR}>{format(Number(order?.totalXof || 0))}</Text>
          </View>
        </View>

        <Text style={styles.section}>Livraison</Text>
        <Text style={styles.addr}>{order?.deliveryAddress}</Text>
        {order?.recipientName ? (
          <Text style={styles.meta}>
            Destinataire : {order.recipientName}
            {order.recipientPhone ? ` · ${order.recipientPhone}` : ''}
            {order.deliverToSelf === false
              ? ` · Tiers${order.recipientRelation ? ` (${order.recipientRelation})` : ''}`
              : ' · Vous'}
          </Text>
        ) : null}

        {order?.cancelReason ? (
          <Text style={styles.cancel}>{order.cancelReason}</Text>
        ) : null}

        {canTrack && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { missionId: order.missionId })}
          >
            <Ionicons name="navigate" size={18} color={Colors.white} />
            <Text style={styles.trackText}>Suivre la livraison</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  content: { padding: Spacing.base, paddingBottom: 48 },
  statusCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: withAlpha(Colors.primary, 0.15),
    marginBottom: Spacing.lg,
  },
  statusLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: Colors.primaryDark },
  statusValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 20, color: Colors.primaryDark, marginTop: 4 },
  shop: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray700, marginTop: 6 },
  section: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900, marginTop: Spacing.lg, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineL: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray700, flex: 1 },
  lineR: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 14, color: Colors.gray900 },
  summary: {
    marginTop: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionInline: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900 },
  totalL: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 15, color: Colors.gray900 },
  totalR: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 16, color: Colors.primaryDark },
  addr: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray700, lineHeight: 20 },
  meta: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray500, marginTop: 6, lineHeight: 18 },
  cancel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.accent, marginTop: Spacing.md },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xl,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  trackText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 15, color: Colors.white },
  stepper: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gray200,
    zIndex: 1,
  },
  stepDotDone: { backgroundColor: Colors.primary },
  stepDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primaryDark,
  },
  stepLine: {
    position: 'absolute',
    top: 4,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: Colors.gray200,
  },
  stepLineDone: { backgroundColor: Colors.primary },
  stepLabel: {
    marginTop: 6,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 10,
    color: Colors.gray400,
    textAlign: 'center',
  },
  stepLabelDone: { color: Colors.primaryDark, fontFamily: Typography.fontFamily.dmSans.medium },
});
