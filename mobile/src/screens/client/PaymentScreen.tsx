import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { handleCheckout, pollStatus } from '../../services/checkout';

interface Props { onBack: () => void; onPay: () => void; missionId?: string; rideId?: string; amount?: number; }

export const PaymentScreen: React.FC<Props> = ({ onBack, onPay, missionId, rideId, amount: amountProp }) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('orange_money');
  const [loading, setLoading] = useState(false);
  const { token, user, refreshUser } = useAuth();
  const availableCredit = user?.credit ?? 0;
  const [useCredit, setUseCredit] = useState(false);
  const [voucher, setVoucher] = useState<any>(null);
  const [useVoucher, setUseVoucher] = useState(true);
  const amount = Number(amountProp) || 0;
  const appliedVoucher = useVoucher && voucher ? Math.min(Number(voucher.amount) || 0, amount) : 0;
  const appliedCredit = useCredit ? Math.min(availableCredit, Math.max(0, amount - appliedVoucher)) : 0;
  const netAmount = amount - appliedVoucher - appliedCredit;
  const refLabel = rideId
    ? `Course #${rideId.slice(0, 8)}`
    : `Mission #${missionId?.slice(0, 8) || 'N/A'}`;
  const refIcon = rideId ? 'navigate' : 'cube';

  useEffect(() => {
    if (!token) return;
    api.loyalty.me(token).then((res) => {
      const best = (res?.availableVouchers || []).sort((a: any, b: any) => Number(b.amount) - Number(a.amount))[0];
      setVoucher(best || null);
    }).catch(() => setVoucher(null));
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}>
        <LinearGradient colors={Colors.gradientPrimary} style={styles.amountCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.amountIcon}><Ionicons name="lock-closed" size={20} color={Colors.white} /></View>
          <Text style={styles.amountLabel}>Montant à payer</Text>
          <Text style={styles.amount}>{netAmount.toLocaleString()} <Text style={styles.amountCurrency}>FCFA</Text></Text>
          {appliedCredit > 0 && (
            <Text style={styles.creditApplied}>Crédit appliqué : -{appliedCredit.toLocaleString()} FCFA</Text>
          )}
          {appliedVoucher > 0 && (
            <Text style={styles.creditApplied}>Bon fidélité : -{appliedVoucher.toLocaleString()} FCFA</Text>
          )}
          <View style={styles.amountDetail}>
            <Ionicons name={refIcon as any} size={12} color={Colors.white} />
            <Text style={styles.amountDetailText}>{refLabel}</Text>
          </View>
        </LinearGradient>

        {voucher && (
          <TouchableOpacity style={[styles.creditCard, Shadows.sm]} onPress={() => setUseVoucher(!useVoucher)} activeOpacity={0.85}>
            <View style={[styles.methodIcon, { backgroundColor: withAlpha(Colors.warning, 0.12) }]}>
              <Ionicons name="trophy" size={22} color={Colors.warning} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodLabel}>Bon fidélité</Text>
              <Text style={styles.methodDesc}>{Number(voucher.amount).toLocaleString()} FCFA · valable 30 jours</Text>
            </View>
            <View style={[styles.checkbox, useVoucher && styles.checkboxOn]}>
              {useVoucher && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
          </TouchableOpacity>
        )}

        {availableCredit > 0 && (
          <TouchableOpacity style={[styles.creditCard, Shadows.sm]} onPress={() => setUseCredit(!useCredit)} activeOpacity={0.85}>
            <View style={[styles.methodIcon, { backgroundColor: withAlpha(Colors.primary, 0.12) }]}>
              <Ionicons name="gift" size={22} color={Colors.primary} />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodLabel}>Crédit de parrainage</Text>
              <Text style={styles.methodDesc}>{availableCredit.toLocaleString()} FCFA disponibles</Text>
            </View>
            <View style={[styles.checkbox, useCredit && styles.checkboxOn]}>
              {useCredit && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
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

                {selected === 'card' && (
          <View style={styles.cardForm}>
            <View style={styles.diasporaBadge}>
              <Ionicons name="globe" size={14} color={Colors.info} />
              <Text style={styles.diasporaText}>Paiement international — Diaspora</Text>
            </View>
            <Text style={styles.cardRedirectHint}>
              Vous serez redirigé vers une page de paiement sécurisée. Aucune donnée carte n’est saisie dans l’app.
            </Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
        <Button title={`Payer ${netAmount.toLocaleString()} FCFA`} onPress={async () => {
          if ((!missionId && !rideId) || !token) {
            Alert.alert('Erreur', rideId ? 'Course introuvable' : 'Mission introuvable');
            return;
          }
          if (!amount || amount <= 0) {
            Alert.alert('Erreur', 'Montant de paiement invalide');
            return;
          }
          setLoading(true);
          try {
            const payment = await api.payments.create(
              {
                amount: netAmount,
                method: selected,
                ...(rideId ? { rideId } : { missionId }),
                creditUsed: appliedCredit || undefined,
                loyaltyRewardId: useVoucher && voucher?.id ? voucher.id : undefined,
              },
              token,
            );

            // Paiement entièrement couvert par le crédit : aucune passerelle requise.
            if (netAmount <= 0) {
              await api.payments.markSuccess(payment.id, `CREDIT-${Date.now()}`, token);
              await refreshUser();
              Alert.alert('Succès', appliedVoucher > 0 ? 'Paiement réglé avec votre bon fidélité' : 'Paiement réglé avec votre crédit');
              onPay();
              return;
            }

            const result = await api.payments.initiate(payment.id, {}, token);
            const outcome = await handleCheckout(result);

            if (outcome === 'success') {
              await refreshUser();
              Alert.alert('Succès', 'Paiement effectué');
              onPay();
            } else if (outcome === 'failed') {
              Alert.alert('Échec', 'Le paiement a échoué');
            } else {
              // En attente de la confirmation de la passerelle (webhook).
              const status = await pollStatus(async () => {
                const p: any = await api.payments.byId(payment.id, token);
                return p.status;
              });
              await refreshUser();
              if (status === 'success') {
                Alert.alert('Succès', 'Paiement confirmé');
                onPay();
              } else if (status === 'failed') {
                Alert.alert('Échec', 'Le paiement a échoué');
              } else {
                Alert.alert('En attente', 'Paiement en cours de validation. Vous serez notifié dès sa confirmation.');
                onPay();
              }
            }
          } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Paiement échoué');
          } finally { setLoading(false); }
        }} loading={loading} fullWidth />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  amountCard: { borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg, ...Shadows.primary },
  amountIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  amountLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.85 },
  amount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['4xl'], color: Colors.white, marginTop: Spacing.xs },
  amountCurrency: { fontSize: Typography.fontSize.lg, opacity: 0.85 },
  amountDetail: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  amountDetailText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white, marginLeft: 4 },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, marginTop: Spacing.xl, marginBottom: Spacing.md },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: 'transparent' },
  methodSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  methodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md, overflow: 'hidden' },
  methodLogo: { width: 44, height: 44 },
  methodInfo: { flex: 1 },
  methodLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  methodDesc: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.gray300, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  footer: { padding: Spacing.lg },
  cardForm: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, ...Shadows.sm },
  creditApplied: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white, marginTop: Spacing.xs, opacity: 0.95 },
  creditCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.lg, borderWidth: 1.5, borderColor: withAlpha(Colors.primary, 0.3) },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.gray300, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  diasporaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: withAlpha(Colors.info, 0.1), paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, marginBottom: Spacing.md, alignSelf: 'flex-start' },
  cardRedirectHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600, lineHeight: 20, marginTop: 4 },
  diasporaText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.info },
  cardField: { marginBottom: Spacing.md },
  cardLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 4 },
  cardInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  cardRow: { flexDirection: 'row' },
  cardSecurity: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  cardSecurityText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
});
