import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../services/api';
import { handleCheckout, pollStatus } from '../../services/checkout';

interface Props {
  onBack: () => void;
  onPaid: () => void;
  reservationId: string;
  amount: number;
  navigation?: any;
}

export const AntiGaspiPaymentScreen: React.FC<Props> = ({
  onBack,
  onPaid,
  reservationId,
  amount,
  navigation,
}) => {
  const [selected, setSelected] = useState('orange_money');
  const [loading, setLoading] = useState(false);
  const [gift, setGift] = useState<any>(null);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    api.loyalty.me(token).then((res) => {
      const eligible = (res?.availableGifts || []).find((g: any) => Number(g.amount) >= amount);
      setGift(eligible || null);
    }).catch(() => setGift(null));
  }, [token, amount]);

  const pay = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.antiGaspi.pay(reservationId, { method: selected }, token);
      const outcome = await handleCheckout(result);

      if (outcome === 'awaiting') {
        const ok = await pollStatus(async () => {
          const r = await api.antiGaspi.reservation(reservationId, token);
          if (r.status === 'paid' || r.status === 'completed') return 'success';
          if (['cancelled', 'expired', 'refunded'].includes(r.status)) return 'failed';
          return 'processing';
        });
        if (ok !== 'success') {
          Alert.alert('Paiement', 'Le paiement n\'a pas été confirmé. Réessayez.');
          return;
        }
      } else if (outcome === 'failed' || result.status === 'failed') {
        Alert.alert('Paiement', 'Le paiement a échoué.');
        return;
      }

      Alert.alert('Payé !', 'Présentez-vous chez le commerçant pendant le créneau de retrait.', [
        {
          text: 'OK',
          onPress: () => {
            onPaid();
            navigation?.navigate('AntiGaspiReservations');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Paiement impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payer le panier</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing.xl }}
        >
          <LinearGradient
            colors={Colors.gradientPrimary}
            style={styles.amountCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.amountLabel}>Montant Anti-Gaspi</Text>
            <Text style={styles.amount}>
              {amount.toLocaleString()} <Text style={styles.amountCurrency}>FCFA</Text>
            </Text>
          </LinearGradient>

          {gift && (
            <TouchableOpacity
              style={[styles.methodCard, Shadows.sm, { borderColor: Colors.success, borderWidth: 1.5, marginBottom: Spacing.lg }]}
              activeOpacity={0.85}
              onPress={async () => {
                if (!token) return;
                setLoading(true);
                try {
                  await api.antiGaspi.claimGift(reservationId, gift.id, token);
                  Alert.alert('Panier offert', 'Bag\'up paie le commerçant. Présentez-vous pendant le créneau de retrait.', [
                    {
                      text: 'OK',
                      onPress: () => {
                        onPaid();
                        navigation?.navigate('AntiGaspiReservations');
                      },
                    },
                  ]);
                } catch (e: any) {
                  Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Cadeau impossible à utiliser');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <View style={[styles.methodIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
                <Ionicons name="leaf" size={22} color={Colors.success} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodLabel}>Panier offert (fidélité)</Text>
                <Text style={styles.methodDesc}>Jusqu’à {Number(gift.amount).toLocaleString()} FCFA · vous ne payez rien</Text>
              </View>
              <Ionicons name="gift" size={18} color={Colors.success} />
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Mode de paiement</Text>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodCard, selected === m.id && styles.methodSelected, Shadows.sm]}
              onPress={() => setSelected(m.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.methodIcon, !m.logo && { backgroundColor: withAlpha(m.color, 0.12) }]}>
                {m.logo ? (
                  <Image source={m.logo} style={styles.methodLogo} resizeMode="contain" />
                ) : (
                  <Ionicons name={m.icon || 'card'} size={22} color={m.color} />
                )}
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.methodDesc}>{m.desc}</Text>
              </View>
              <View style={[styles.radio, selected === m.id && styles.radioSelected]}>
                {selected === m.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Payer maintenant" onPress={pay} loading={loading} fullWidth />
        </View>
      </KeyboardAvoidingView>
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
  content: { flex: 1, padding: Spacing.base },
  amountCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.9,
  },
  amount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  amountCurrency: { fontSize: Typography.fontSize.lg },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.gray100,
  },
  methodSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  methodLogo: { width: 44, height: 44 },
  methodInfo: { flex: 1, marginLeft: Spacing.md },
  methodLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.gray900,
  },
  methodDesc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  footer: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
});
