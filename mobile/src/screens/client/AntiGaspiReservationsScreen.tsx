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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../services/api';

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending_payment: { label: 'À payer', bg: Colors.warningSoft, text: Colors.warning },
  paid: { label: 'Payé — à retirer', bg: Colors.infoSoft, text: Colors.info },
  merchant_confirmed: { label: 'Commerçant OK', bg: Colors.infoSoft, text: Colors.info },
  client_confirmed: { label: 'Vous avez confirmé', bg: Colors.infoSoft, text: Colors.info },
  completed: { label: 'Terminé', bg: Colors.successSoft, text: Colors.success },
  cancelled: { label: 'Annulé', bg: Colors.accentSoft, text: Colors.accent },
  expired: { label: 'Expiré', bg: Colors.gray100, text: Colors.gray500 },
  refunded: { label: 'Remboursé', bg: Colors.gray100, text: Colors.gray500 },
};

const STEPS = [
  { key: 'pending_payment', label: 'À payer' },
  { key: 'paid', label: 'Payé' },
  { key: 'confirm', label: 'Confirmations' },
  { key: 'completed', label: 'Terminé' },
] as const;

function stepIndex(status: string): number {
  if (status === 'pending_payment') return 0;
  if (status === 'paid') return 1;
  if (status === 'merchant_confirmed' || status === 'client_confirmed') return 2;
  if (status === 'completed') return 3;
  if (status === 'cancelled' || status === 'expired' || status === 'refunded') return -1;
  return 0;
}

function ReservationStepper({ status }: { status: string }) {
  const idx = stepIndex(status);
  if (idx < 0) return null;
  return (
    <View style={styles.stepper}>
      {STEPS.map((step, i) => {
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
            {i < STEPS.length - 1 && (
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

interface Props {
  onBack: () => void;
  navigation?: any;
}

export const AntiGaspiReservationsScreen: React.FC<Props> = ({ onBack, navigation }) => {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.antiGaspi.myReservations(token);
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
      const interval = setInterval(load, 8000);
      return () => clearInterval(interval);
    }, [load]),
  );

  const confirm = async (id: string) => {
    if (!token) return;
    setConfirming(id);
    try {
      await api.antiGaspi.confirmClient(id, token);
      Alert.alert('Merci !', 'Réception confirmée.');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Confirmation impossible');
    } finally {
      setConfirming(null);
    }
  };

  const canConfirm = (status: string) =>
    ['paid', 'merchant_confirmed'].includes(status);

  const canPay = (status: string) => status === 'pending_payment';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes paniers</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={items}
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
              <Ionicons name="receipt-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>Aucune réservation Anti-Gaspi</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS[item.status] || STATUS.pending_payment;
            return (
              <View style={[styles.card, Shadows.sm]}>
                <View style={styles.cardTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.basket?.title || 'Panier'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {item.basket?.merchant?.businessName ||
                    item.basket?.merchant?.firstName ||
                    'Commerçant'}
                </Text>
                <Text style={styles.price}>{Number(item.price).toLocaleString()} FCFA</Text>

                <ReservationStepper status={item.status} />

                {canPay(item.status) && (
                  <View style={{ marginTop: Spacing.md }}>
                    <Button
                      title="Payer"
                      onPress={() =>
                        navigation?.navigate('AntiGaspiPayment', {
                          reservationId: item.id,
                          amount: Number(item.price),
                        })
                      }
                      fullWidth
                    />
                  </View>
                )}

                {canConfirm(item.status) && !item.clientConfirmedAt && (
                  <View style={{ marginTop: Spacing.md }}>
                    <Button
                      title="Confirmer la réception"
                      onPress={() => confirm(item.id)}
                      loading={confirming === item.id}
                      fullWidth
                    />
                  </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  list: { padding: Spacing.base, paddingBottom: 48 },
  empty: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray400,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  badge: { borderRadius: BorderRadius.md, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 11 },
  meta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginTop: 6,
  },
  price: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.primaryDark,
    marginTop: 4,
  },
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
