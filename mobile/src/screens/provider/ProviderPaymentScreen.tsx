import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, BackHandler, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { handleCheckout, pollStatus } from '../../services/checkout';
import { DEMARCHES_SUBSCRIPTION_FCFA, isDemarchesProvider } from '../../constants/demarches';

interface Props {
  onPaid: () => void | Promise<void>;
  onLogout: () => void;
  /** Renouvellement anticipé depuis le dashboard (abonnement encore actif). */
  earlyRenew?: boolean;
  onBack?: () => void;
}

export const ProviderPaymentScreen: React.FC<Props> = ({ onPaid, onLogout, earlyRenew = false, onBack }) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('orange_money');
  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(!!earlyRenew);
  const { token, user, refreshUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const availableCredit = user?.credit ?? 0;
  const [useCredit, setUseCredit] = useState(false);

  const needsRegistration =
    !user?.subscriptionStatus ||
    user?.subscriptionStatus === 'none' ||
    user?.subscriptionStatus === 'trial';
  const isExpired =
    !earlyRenew && (
      user?.subscriptionStatus === 'expired' ||
      (user?.subscriptionStatus === 'active' &&
        !!user?.subscriptionExpiry &&
        new Date(user.subscriptionExpiry) <= new Date()) ||
      user?.subscriptionStatus === 'suspended'
    );
  const subscriptionType = needsRegistration ? 'registration' : 'monthly';
  const amount = isDemarchesProvider(user) ? DEMARCHES_SUBSCRIPTION_FCFA : 5000;
  const appliedCredit = useCredit ? Math.min(availableCredit, amount) : 0;
  const netAmount = amount - appliedCredit;
  const expiryLabel = user?.subscriptionExpiry
    ? new Date(user.subscriptionExpiry).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const title = needsRegistration
    ? "Frais d'adhésion"
    : earlyRenew
      ? 'Renouvellement anticipé'
      : 'Renouvellement mensuel';
  const subtitle = needsRegistration
    ? "Payez l'adhésion maintenant. Ensuite notre équipe valide votre dossier, puis vous accédez aux missions."
    : earlyRenew
      ? 'Prolongez votre abonnement avant expiration pour éviter toute interruption.'
      : 'Votre abonnement a expiré. Renouvelez pour continuer à recevoir des missions.';

  // Première inscription: afficher directement le checkout.
  useEffect(() => {
    if (needsRegistration || earlyRenew) setShowCheckout(true);
  }, [needsRegistration, earlyRenew]);

  // Empêche le retour matériel Android quand il n'y a pas d'écran précédent (gate abonnement).
  useEffect(() => {
    if (earlyRenew || onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [earlyRenew, onBack]);

  const handlePay = async () => {
    if (!token) { Alert.alert('Erreur', 'Session expirée'); return; }
    if (netAmount > 0 && (selected === 'orange_money' || selected === 'wave') && !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Entrez votre numéro de téléphone');
      return;
    }
    setLoading(true);
    try {
      const subscription = await api.subscriptions.create(
        {
          type: subscriptionType,
          method: selected,
          creditUsed: appliedCredit || undefined,
        },
        token,
      );

      const successMsg = needsRegistration
        ? user?.isVerified
          ? "Adhésion payée ! Votre compte est actif."
          : "Paiement reçu ! Votre dossier est en cours de vérification. Vous serez notifié dès validation."
        : 'Abonnement renouvelé pour 1 mois.';

      const finalize = async () => {
        await refreshUser();
        await onPaid();
        Alert.alert(
          'Succès',
          appliedCredit > 0 && netAmount <= 0
            ? 'Adhésion / abonnement réglé avec votre crédit de parrainage.'
            : successMsg,
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
        // En attente de la confirmation de la passerelle (webhook).
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
          Alert.alert('En attente', 'Paiement en cours de validation. Votre compte sera activé dès confirmation.');
        }
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Paiement échoué');
    } finally {
      setLoading(false);
    }
  };

  if (!showCheckout && isExpired) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
          <Text style={styles.headerTitle}>Abonnement</Text>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={Colors.gray700} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.expiredContent, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.expiredIconWrap}>
            <Ionicons name="alert-circle" size={48} color={Colors.warning} />
          </View>
          <Text style={styles.expiredTitle}>Votre abonnement a expiré</Text>
          <Text style={styles.expiredSub}>
            Bonjour {user?.firstName || 'Prestataire'}, votre compte reste connecté mais l&apos;accès aux
            missions est suspendu tant que l&apos;abonnement n&apos;est pas renouvelé.
          </Text>

          <View style={styles.expiredCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={Colors.primary} />
              <Text style={styles.infoText}>{user?.firstName} {user?.lastName || ''}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color={Colors.gray400} />
              <Text style={styles.infoText}>{user?.phone}</Text>
            </View>
            {expiryLabel && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.warning} />
                  <Text style={styles.infoText}>Expiré le {expiryLabel}</Text>
                </View>
              </>
            )}
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.accent} />
              <Text style={[styles.infoText, { color: Colors.accent }]}>Missions désactivées</Text>
            </View>
          </View>

          <View style={styles.expiredTips}>
            <Text style={styles.expiredTipTitle}>Après renouvellement</Text>
            <Text style={styles.expiredTip}>• Réception des nouvelles missions</Text>
            <Text style={styles.expiredTip}>• Accès au dashboard prestataire</Text>
            <Text style={styles.expiredTip}>• Validité d&apos;1 mois après paiement</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
          <Button
            title={`Renouveler · ${amount.toLocaleString()} FCFA`}
            onPress={() => setShowCheckout(true)}
            fullWidth
          />
          <TouchableOpacity onPress={onLogout} style={styles.secondaryLogout} activeOpacity={0.8}>
            <Text style={styles.secondaryLogoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <View style={styles.headerLeft}>
          {(earlyRenew || (!needsRegistration && isExpired && showCheckout)) && (
            <TouchableOpacity
              onPress={() => {
                if (earlyRenew) onBack?.();
                else setShowCheckout(false);
              }}
              style={styles.backBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.gray700} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {needsRegistration ? 'Activer mon compte' : 'Renouveler'}
          </Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.gray700} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}>
        {!needsRegistration && !earlyRenew && (
          <View style={styles.expiredBanner}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={styles.expiredBannerText}>
              Abonnement expiré{expiryLabel ? ` depuis le ${expiryLabel}` : ''}. Choisissez un moyen de paiement pour renouveler.
            </Text>
          </View>
        )}
        {earlyRenew && (
          <View style={[styles.expiredBanner, { backgroundColor: withAlpha(Colors.info, 0.1), borderColor: withAlpha(Colors.info, 0.25) }]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.expiredBannerText}>
              Renouvellement anticipé{expiryLabel ? ` · expire le ${expiryLabel}` : ''}. Votre période sera prolongée après paiement.
            </Text>
          </View>
        )}

        <LinearGradient colors={Colors.gradientPrimary} style={styles.amountCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.amountIcon}>
            <Ionicons name={needsRegistration ? 'shield-checkmark' : 'refresh'} size={24} color={Colors.white} />
          </View>
          <Text style={styles.amountLabel}>{title}</Text>
          <Text style={styles.amount}>{netAmount.toLocaleString()} <Text style={styles.amountCurrency}>FCFA</Text></Text>
          {appliedCredit > 0 && (
            <Text style={styles.creditApplied}>Crédit appliqué : -{appliedCredit.toLocaleString()} FCFA</Text>
          )}
          <Text style={styles.amountSub}>{subtitle}</Text>
        </LinearGradient>

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

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{user?.firstName} {user?.lastName || ''}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={Colors.gray400} />
            <Text style={styles.infoText}>{user?.phone}</Text>
          </View>
          {user?.vehicleType && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Ionicons name="bicycle-outline" size={16} color={Colors.gray400} />
                <Text style={styles.infoText}>{user.vehicleType}</Text>
              </View>
            </>
          )}
        </View>

        {netAmount > 0 && (
          <>
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

        {(selected === 'orange_money' || selected === 'wave') && (
          <View style={styles.phoneForm}>
            <Text style={styles.formLabel}>Numéro de téléphone</Text>
            <View style={styles.phoneInput}>
              <Ionicons name="call-outline" size={18} color={Colors.gray400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+221 77 123 45 67"
                placeholderTextColor={Colors.gray300}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
          </View>
        )}

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
          </>
        )}

        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Avantages de l'abonnement</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.benefitText}>Accès aux missions disponibles</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.benefitText}>Assurance accident après 4 mois continus</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.benefitText}>Reversement des gains après livraison (J+2)</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.benefitText}>0% de commission Bag'up au lancement</Text>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
        <Button
          title={
            netAmount <= 0
              ? 'Activer avec mon crédit'
              : needsRegistration
                ? `Payer ${netAmount.toLocaleString()} FCFA`
                : `Renouveler · ${netAmount.toLocaleString()} FCFA`
          }
          onPress={handlePay}
          loading={loading}
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  expiredContent: { paddingTop: Spacing['2xl'], paddingBottom: Spacing['3xl'], alignItems: 'center' },
  expiredIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: withAlpha(Colors.warning, 0.12), alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  expiredTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['2xl'], color: Colors.gray900, textAlign: 'center', marginBottom: Spacing.sm },
  expiredSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl, paddingHorizontal: Spacing.sm },
  expiredCard: { width: '100%', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, ...Shadows.sm, marginBottom: Spacing.lg },
  expiredTips: { width: '100%', backgroundColor: withAlpha(Colors.primary, 0.06), borderRadius: BorderRadius.lg, padding: Spacing.base, borderWidth: 1, borderColor: withAlpha(Colors.primary, 0.12) },
  expiredTipTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900, marginBottom: Spacing.sm },
  expiredTip: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600, marginBottom: 4 },
  expiredBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: withAlpha(Colors.warning, 0.1), borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.lg, borderWidth: 1, borderColor: withAlpha(Colors.warning, 0.25) },
  expiredBannerText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray700, lineHeight: 20 },
  secondaryLogout: { alignItems: 'center', marginTop: Spacing.md, paddingVertical: Spacing.sm },
  secondaryLogoutText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  amountCard: { borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg, ...Shadows.primary },
  amountIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  amountLabel: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  amount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['4xl'], color: Colors.white, marginTop: Spacing.xs },
  amountCurrency: { fontSize: Typography.fontSize.lg, opacity: 0.85 },
  amountSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.8, textAlign: 'center', marginTop: Spacing.sm },
  creditApplied: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white, marginTop: Spacing.xs, opacity: 0.95 },
  creditCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.lg, borderWidth: 1.5, borderColor: withAlpha(Colors.primary, 0.3) },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.gray300, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  infoCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.lg, ...Shadows.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  infoDivider: { height: 1, backgroundColor: Colors.gray100, marginVertical: Spacing.sm },
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
  phoneForm: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, ...Shadows.sm },
  formLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 8 },
  phoneInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  cardForm: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, ...Shadows.sm },
  diasporaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: withAlpha(Colors.info, 0.1), paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, marginBottom: Spacing.md, alignSelf: 'flex-start' },
  cardRedirectHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray600, lineHeight: 20, marginTop: 4 },
  diasporaText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.info },
  cardField: { marginBottom: Spacing.md },
  cardLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 4 },
  cardInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  cardRow: { flexDirection: 'row' },
  cardSecurity: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  cardSecurityText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  benefitsCard: { backgroundColor: withAlpha(Colors.success, 0.06), borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.md, borderWidth: 1, borderColor: withAlpha(Colors.success, 0.15) },
  benefitsTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900, marginBottom: Spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  benefitText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  footer: { padding: Spacing.lg, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray100 },
});
