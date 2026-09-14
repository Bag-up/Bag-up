import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../services/api';

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  paid: { label: 'À remettre', bg: Colors.warningSoft, text: Colors.warning },
  merchant_confirmed: { label: 'Vous avez confirmé', bg: Colors.infoSoft, text: Colors.info },
  client_confirmed: { label: 'Client a confirmé', bg: Colors.primarySoft, text: Colors.primary },
  completed: { label: 'Terminé · reversé', bg: Colors.successSoft, text: Colors.success },
};

export const MerchantReservationDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reservationId = route.params?.reservationId as string;
  const { token } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!token || !reservationId) return;
    try {
      const data = await api.antiGaspi.reservation(reservationId, token);
      setItem(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de charger le détail');
    } finally {
      setLoading(false);
    }
  }, [token, reservationId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const confirm = async () => {
    if (!token || !item) return;
    setConfirming(true);
    try {
      const updated = await api.antiGaspi.confirmMerchant(item.id, token);
      setItem(updated);
      if (updated?.status === 'completed') {
        Alert.alert('Terminé', 'Panier remis et reversement créé.', [
          { text: 'Voir revenus', onPress: () => navigation.navigate('MerchantMain', { screen: 'MPayouts' }) },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(
          'Confirmé',
          'Remise enregistrée. Le reversement apparaîtra quand le client confirmera aussi.',
        );
      }
    } catch (e: any) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Confirmation impossible');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loading}>
        <Text style={styles.missing}>Retrait introuvable</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const st = STATUS[item.status] || STATUS.paid;
  const canConfirm =
    ['paid', 'client_confirmed'].includes(item.status) && !item.merchantConfirmedAt;
  const clientName = [item.client?.firstName, item.client?.lastName].filter(Boolean).join(' ');
  const phone = item.client?.phone;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détail retrait</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={styles.basketTitle} numberOfLines={2}>
          {item.basket?.title || 'Panier'}
        </Text>
        <View style={[styles.pill, { backgroundColor: Colors.white }]}>
          <Text style={[styles.pillText, { color: st.text }]}>{st.label}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>Montants</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Prix client</Text>
            <Text style={styles.amountValue}>
              {Number(item.basket?.price || 0).toLocaleString()} F
            </Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Commission (15 %)</Text>
            <Text style={styles.amountValueMuted}>
              −{Number(item.commissionAmount || 0).toLocaleString()} F
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.netLabel}>Vous recevez</Text>
            <Text style={styles.netValue}>
              {Number(item.merchantAmount || 0).toLocaleString()} F
            </Text>
          </View>
          {item.payout ? (
            <Text style={styles.payoutHint}>
              Reversement : {item.payout.status === 'success' ? 'versé' : item.payout.status}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>Client</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>{clientName || 'Client'}</Text>
          </View>
          {phone ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(`tel:${phone}`)}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={18} color={Colors.primary} />
              <Text style={[styles.infoText, styles.phoneLink]}>{phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>Retrait</Text>
          {item.basket?.pickupAddress ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>{item.basket.pickupAddress}</Text>
            </View>
          ) : null}
          {item.basket?.description ? (
            <Text style={styles.desc}>{item.basket.description}</Text>
          ) : null}
          <View style={styles.timeline}>
            <TimelineRow
              done={!!item.paidAt || ['paid', 'merchant_confirmed', 'client_confirmed', 'completed'].includes(item.status)}
              label="Payé par le client"
              date={item.paidAt}
            />
            <TimelineRow
              done={!!item.merchantConfirmedAt}
              label="Remise confirmée (vous)"
              date={item.merchantConfirmedAt}
            />
            <TimelineRow
              done={!!item.clientConfirmedAt}
              label="Réception confirmée (client)"
              date={item.clientConfirmedAt}
              last
            />
          </View>
        </View>
      </ScrollView>

      {canConfirm && (
        <View style={styles.footer}>
          <Button
            title="Confirmer la remise"
            onPress={confirm}
            loading={confirming}
            fullWidth
          />
        </View>
      )}
    </View>
  );
};

function TimelineRow({
  done,
  label,
  date,
  last,
}: {
  done: boolean;
  label: string;
  date?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlLeft}>
        <View style={[styles.tlDot, done && styles.tlDotDone]}>
          {done ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
        </View>
        {!last ? <View style={[styles.tlLine, done && styles.tlLineDone]} /> : null}
      </View>
      <View style={styles.tlBody}>
        <Text style={[styles.tlLabel, done && styles.tlLabelDone]}>{label}</Text>
        {date ? (
          <Text style={styles.tlDate}>
            {new Date(date).toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : (
          <Text style={styles.tlDate}>En attente</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  missing: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    color: Colors.gray600,
    marginBottom: Spacing.md,
  },
  link: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    color: Colors.primary,
  },
  header: {
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
  },
  basketTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
  },
  content: { padding: Spacing.base, paddingBottom: 120 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  amountLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  amountValue: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  amountValueMuted: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  divider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.sm },
  netLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  netValue: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  payoutHint: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  phoneLink: { color: Colors.primary, fontFamily: Typography.fontFamily.dmSans.semiBold },
  desc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  timeline: { marginTop: Spacing.sm },
  tlRow: { flexDirection: 'row', minHeight: 52 },
  tlLeft: { width: 24, alignItems: 'center' },
  tlDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotDone: { backgroundColor: Colors.success },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.gray200,
    marginVertical: 2,
  },
  tlLineDone: { backgroundColor: withAlpha(Colors.success, 0.4) },
  tlBody: { flex: 1, paddingLeft: Spacing.sm, paddingBottom: Spacing.md },
  tlLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  tlLabelDone: { color: Colors.gray900 },
  tlDate: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  footer: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
});
