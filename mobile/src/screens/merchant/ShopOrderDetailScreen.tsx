import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'En attente de paiement',
  awaiting_preparation: 'À préparer (48 h)',
  collection_scheduled: 'Collecte planifiée',
  collected: 'Colis collecté',
  in_transit: 'En livraison',
  delivered: 'Livré',
  cancelled: 'Annulé',
  dispute: 'Litige',
};

export const ShopOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId as string;
  const { token } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
    }, [load]),
  );

  const markPrepared = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const updated = await api.marketplace.markPrepared(orderId, token);
      setOrder(updated);
      Alert.alert('Colis prêt', 'Un livreur Bag\'up peut maintenant collecter.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de marquer préparé');
    } finally {
      setLoading(false);
    }
  };

  const deadline = order?.preparationDeadline ? new Date(order.preparationDeadline) : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{order?.orderNumber || 'Commande'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
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
          <Text style={styles.statusValue}>
            {STATUS_LABEL[order?.status] || order?.status || '…'}
          </Text>
          {order?.status === 'awaiting_preparation' && deadline && (
            <Text style={styles.deadline}>
              Préparer avant le{' '}
              {deadline.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>

        <Text style={styles.section}>Articles</Text>
        {(order?.items || []).map((item: any) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.lineL}>
              {item.quantity}× {item.productName}
            </Text>
            <Text style={styles.lineR}>
              {Number(item.unitPriceXof * item.quantity).toLocaleString('fr-FR')} F
            </Text>
          </View>
        ))}

        <View style={styles.summary}>
          <View style={styles.line}>
            <Text style={styles.lineL}>Produit</Text>
            <Text style={styles.lineR}>{Number(order?.productTotalXof || 0).toLocaleString('fr-FR')} F</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Livraison (client)</Text>
            <Text style={styles.lineR}>{Number(order?.deliveryFeeXof || 0).toLocaleString('fr-FR')} F</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineL}>Votre gain (après 5 %)</Text>
            <Text style={[styles.lineR, { color: Colors.primaryDark }]}>
              {Number(order?.merchantAmount || 0).toLocaleString('fr-FR')} F
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Livraison</Text>
        <Text style={styles.addr}>{order?.deliveryAddress}</Text>
        <Text style={styles.meta}>
          Client : {order?.buyer?.firstName} {order?.buyer?.lastName || ''}
        </Text>
        {order?.recipientName ? (
          <Text style={styles.meta}>
            Destinataire : {order.recipientName}
            {order.recipientPhone ? ` · ${order.recipientPhone}` : ''}
            {order.deliverToSelf === false ? ' · Tiers / diaspora' : ''}
          </Text>
        ) : null}

        {order?.cancelReason ? (
          <Text style={styles.cancel}>Motif : {order.cancelReason}</Text>
        ) : null}

        {order?.status === 'awaiting_preparation' && (
          <View style={{ marginTop: Spacing.xl }}>
            <Button title="Marquer colis préparé" fullWidth loading={loading} onPress={markPrepared} />
          </View>
        )}

        {order?.missionId && order?.status !== 'awaiting_preparation' && order?.status !== 'pending_payment' && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { missionId: order.missionId })}
          >
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <Text style={styles.trackText}>Suivre la mission</Text>
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
  deadline: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray700, marginTop: 8 },
  section: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: 15,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineL: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray700, flex: 1, paddingRight: 8 },
  lineR: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 14, color: Colors.gray900 },
  summary: {
    marginTop: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  addr: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray700, lineHeight: 20 },
  meta: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray500, marginTop: 6 },
  cancel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.accent, marginTop: Spacing.md },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  trackText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 15, color: Colors.primary },
});
