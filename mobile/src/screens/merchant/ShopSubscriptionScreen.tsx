import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { handleCheckout, pollStatus } from '../../services/checkout';
import { MERCHANT_SUBSCRIPTION_AMOUNT } from '../../constants/marketplace';

interface Props {
  /** Gate d’onboarding : paiement avant validation admin */
  gateMode?: boolean;
  onPaid?: () => void | Promise<void>;
  onLogout?: () => void;
}

export const ShopSubscriptionScreen: React.FC<Props> = ({
  gateMode = false,
  onPaid,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user, refreshUser } = useAuth();
  const [selected, setSelected] = useState('orange_money');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [useCredit, setUseCredit] = useState(false);

  const amount = MERCHANT_SUBSCRIPTION_AMOUNT;
  const availableCredit = user?.credit ?? 0;
  const appliedCredit = useCredit ? Math.min(availableCredit, amount) : 0;
  const netAmount = amount - appliedCredit;

  const pay = async () => {
    if (!token) {
      Alert.alert('Erreur', 'Session expirée');
      return;
    }
    if (netAmount > 0 && (selected === 'orange_money' || selected === 'wave') && !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Entrez votre numéro de téléphone');
      return;
    }
    setLoading(true);
    try {
      const subscription = await api.subscriptions.create(
        {
          type: 'merchant_monthly',
          method: selected,
          creditUsed: appliedCredit || undefined,
        },
        token,
      );

      const finalize = async () => {
        await refreshUser();
        if (gateMode) {
          await onPaid?.();
          Alert.alert(
            'Paiement reçu',
            user?.isVerified
              ? 'Votre boutique peut être visible.'
              : 'Dossier en cours de vérification. Vous serez notifié dès validation.',
          );
          return;
        }
        Alert.alert(
          'Abonnement activé',
          appliedCredit > 0 && netAmount <= 0
            ? 'Réglé avec votre crédit de parrainage. Votre boutique peut être visible.'
            : 'Votre boutique peut être visible.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      };

      if (Number(subscription.amount) <= 0) {
        await api.subscriptions.markSuccess(subscription.id, `CREDIT-${Date.now()}`, token);
        await finalize();
        return;
      }

      const result = await api.subscriptions.initiate(subscription.id, { method: selected }, token);
      const outcome = await handleCheckout(result);

      if (outcome === 'success') {
        await finalize();
      } else if (outcome === 'failed') {
        Alert.alert('Échec', 'Le paiement a échoué');
      } else {
        const status = await pollStatus(async () => {
          const subs: any[] = await api.subscriptions.mine(token);
          const s = subs.find((x) => x.id === subscription.id);
          return s?.status ?? 'pending';
        });
        if (status === 'success') {
          await finalize();
        } else if (status === 'failed') {
          Alert.alert('Échec', 'Le paiement a échoué');
        } else {
          Alert.alert(
            'En attente',
            'Paiement en cours de validation. Votre boutique sera activée dès confirmation.',
          );
        }
      }
    } catch (e: any) {
      Alert.alert('Paiement', e?.message || 'Échec du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        {gateMode ? (
          <TouchableOpacity onPress={onLogout} hitSlop={12}>
            <Ionicons name="log-out-outline" size={22} color={Colors.gray700} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
          </TouchableOpacity>
        )}
        <Text style={styles.topTitle}>Abonnement boutique</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
        keyboardShouldPersistTaps="handled"
      >
        {gateMode && (
          <Text style={styles.gateHint}>
            Payez l’abonnement maintenant. Ensuite notre équipe valide votre dossier commerçant, puis vous accédez à la boutique.
          </Text>
        )}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Mensuel</Text>
          <Text style={styles.amount}>{netAmount.toLocaleString()} FCFA</Text>
          {appliedCredit > 0 && (
            <Text style={styles.creditApplied}>Crédit : -{appliedCredit.toLocaleString()} FCFA</Text>
          )}
          <Text style={styles.amountHint}>Fiche boutique + catalogue + visibilité clients</Text>
        </View>

        {availableCredit > 0 && (
          <TouchableOpacity
            style={[styles.creditRow, useCredit && styles.creditRowOn]}
            onPress={() => setUseCredit(!useCredit)}
            activeOpacity={0.85}
          >
            <Ionicons name="gift" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.creditTitle}>Crédit de parrainage</Text>
              <Text style={styles.creditDesc}>{availableCredit.toLocaleString()} FCFA disponibles</Text>
            </View>
            <View style={[styles.checkbox, useCredit && styles.checkboxOn]}>
              {useCredit && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
          </TouchableOpacity>
        )}

        {netAmount > 0 && (
          <>
        {PAYMENT_METHODS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.method, selected === m.id && styles.methodOn]}
            onPress={() => setSelected(m.id)}
          >
            {m.logo ? (
              <Image source={m.logo} style={styles.logo} resizeMode="contain" />
            ) : (
              <Ionicons name="card-outline" size={22} color={Colors.primary} />
            )}
            <Text style={styles.methodLabel}>{m.label}</Text>
            <View style={[styles.radio, selected === m.id && styles.radioOn]}>
              {selected === m.id && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        {(selected === 'orange_money' || selected === 'wave') && (
          <>
            <Text style={styles.label}>Numéro Mobile Money</Text>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="77 XXX XX XX"
              placeholderTextColor={Colors.gray400}
            />
          </>
        )}

        {selected === 'card' && (
          <View style={styles.cardForm}>
            <View style={styles.diasporaBadge}>
              <Ionicons name="globe" size={14} color={Colors.info} />
              <Text style={styles.diasporaText}>Paiement international — Visa, Mastercard</Text>
            </View>
            <Text style={styles.cardRedirectHint}>
              Vous serez redirigé vers une page de paiement sécurisée. Aucune donnée carte n’est saisie dans l’app.
            </Text>
          </View>
        )}
          </>
        )}

        <View style={styles.submitWrap}>
          <Button
            title={netAmount <= 0 ? 'Activer avec mon crédit' : `Payer ${netAmount.toLocaleString()} FCFA`}
            onPress={pay}
            loading={loading}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200,
  },
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  content: { padding: Spacing.base, paddingBottom: 40 },
  gateHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    lineHeight: 20,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  amountCard: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.lg,
  },
  amountLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: withAlpha('#fff', 0.8), textTransform: 'uppercase' },
  amount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 32, color: Colors.white, marginTop: 4 },
  creditApplied: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: withAlpha('#fff', 0.9), marginTop: 4 },
  amountHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: withAlpha('#fff', 0.85), marginTop: 6, textAlign: 'center' },
  creditRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1.5, borderColor: withAlpha(Colors.primary, 0.3), marginBottom: Spacing.md,
  },
  creditRowOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  creditTitle: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 15, color: Colors.gray900 },
  creditDesc: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginTop: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1.5, borderColor: Colors.gray200, marginBottom: Spacing.sm,
  },
  methodOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  logo: { width: 36, height: 36 },
  methodLabel: { flex: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 15, color: Colors.gray900 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  label: {
    fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray600,
    marginTop: Spacing.md, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: 12,
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 15, color: Colors.gray900,
  },
  phoneInput: { marginBottom: Spacing.lg },
  cardForm: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    marginTop: Spacing.md, marginBottom: Spacing.md, ...Shadows.sm,
  },
  diasporaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: withAlpha(Colors.info, 0.1), paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, marginBottom: Spacing.md, alignSelf: 'flex-start',
  },
  diasporaText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.info },
  cardField: { marginBottom: Spacing.md },
  cardLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 4 },
  cardInput: {
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900,
  },
  cardRow: { flexDirection: 'row' },
  cardSecurity: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  cardSecurityText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  submitWrap: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
