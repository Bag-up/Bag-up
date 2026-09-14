import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

interface Props {
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  role?: 'provider' | 'merchant';
  /** Adhésion / abo déjà payé */
  paid?: boolean;
  /** Anti-Gaspi seul : pas d’étape paiement */
  skipPayment?: boolean;
  rejected?: boolean;
  rejectReason?: string | null;
  refundPending?: boolean;
}

export const PendingVerificationScreen: React.FC<Props> = ({
  onLogout,
  onRefresh,
  role = 'provider',
  paid = false,
  skipPayment = false,
  rejected = false,
  rejectReason,
  refundPending = false,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isCompact = height < 720;
  const [checking, setChecking] = useState(false);
  const roleFr = role === 'merchant' ? 'commerçant' : 'prestataire';
  const accessLabel = role === 'merchant' ? 'Accès boutique / Anti-Gaspi' : "Accès à l'application";

  const checkVerification = useCallback(async () => {
    setChecking(true);
    try {
      await onRefresh();
    } catch (e) {
      console.error('checkVerification error:', e);
    } finally {
      setChecking(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    onRefresh().catch((e) => console.error('initial verification refresh error:', e));
    if (rejected) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [onRefresh, rejected]);

  const handleManualCheck = async () => {
    await checkVerification();
  };

  if (rejected) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + Spacing.xl, 32), flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[Colors.accent, '#C45C4A']}
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top + (isCompact ? Spacing.md : Spacing.xl), isCompact ? 36 : 56),
                paddingBottom: isCompact ? Spacing.xl : Spacing['3xl'],
              },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.iconWrap, isCompact && styles.iconWrapCompact]}>
              <Ionicons name="close-circle" size={isCompact ? 36 : 48} color={Colors.white} />
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Dossier non validé</Text>
            <Text style={styles.subtitle}>
              Votre inscription {roleFr} n’a pas été acceptée pour le moment.
              {rejectReason ? `\n\nMotif : ${rejectReason}` : ''}
            </Text>

            {refundPending && (
              <View style={styles.refundCard}>
                <Ionicons name="wallet-outline" size={22} color={Colors.info} />
                <View style={styles.payCardText}>
                  <Text style={styles.refundTitle}>Remboursement en cours</Text>
                  <Text style={styles.payCardBody}>
                    Si vous avez déjà payé, Bag’up traite le remboursement sous 48–72 h (Wave / Orange Money).
                    Contactez le support si besoin.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom + Spacing.xl, 32),
            flexGrow: 1,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={Colors.gradientPrimary}
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top + (isCompact ? Spacing.md : Spacing.xl), isCompact ? 36 : 56),
              paddingBottom: isCompact ? Spacing.xl : Spacing['3xl'],
            },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.iconWrap, isCompact && styles.iconWrapCompact]}>
            <Ionicons name="hourglass" size={isCompact ? 36 : 48} color={Colors.white} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>
            {paid ? 'Paiement reçu — vérification en cours' : 'Compte en attente de validation'}
          </Text>
          <Text style={styles.subtitle}>
            {paid
              ? `Merci ! Notre équipe examine votre dossier ${roleFr}. Vous serez notifié dès validation — ensuite vous pourrez commencer.`
              : `Votre inscription est en cours d'examen. Vous recevrez une notification dès que votre compte sera validé.`}
          </Text>

          <View style={styles.stepsCard}>
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, styles.stepDone]}>
                <Ionicons name="checkmark" size={16} color={Colors.white} />
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepLabel}>Inscription</Text>
                <Text style={styles.stepStatus}>Terminée</Text>
              </View>
            </View>
            <View style={styles.stepLine} />

            {!skipPayment && (
              <>
                <View style={styles.stepRow}>
                  <View style={[styles.stepIcon, paid ? styles.stepDone : styles.stepActive]}>
                    <Ionicons name={paid ? 'checkmark' : 'card'} size={16} color={Colors.white} />
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepLabel}>
                      {role === 'merchant' ? 'Abonnement boutique' : "Frais d'adhésion"}
                    </Text>
                    <Text style={styles.stepStatus}>{paid ? 'Payé' : 'En attente…'}</Text>
                  </View>
                </View>
                <View style={styles.stepLine} />
              </>
            )}

            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, styles.stepActive]}>
                <Ionicons name="time" size={16} color={Colors.white} />
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepLabel}>Vérification admin</Text>
                <Text style={styles.stepStatus}>En cours…</Text>
              </View>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, styles.stepPending]}>
                <Ionicons name={role === 'merchant' ? 'storefront' : 'bicycle'} size={16} color={Colors.gray400} />
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepLabel}>{accessLabel}</Text>
                <Text style={styles.stepStatus}>Après validation</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
            <Text style={styles.infoText}>
              Cette vérification prend généralement moins de 24 h. Le statut est vérifié automatiquement toutes les 15 secondes.
              {paid
                ? ' En cas de refus du dossier, Bag’up rembourse les frais déjà payés.'
                : ''}
            </Text>
          </View>

          {paid && (
            <View style={styles.payCard}>
              <Ionicons name="shield-checkmark-outline" size={22} color={Colors.success} />
              <View style={styles.payCardText}>
                <Text style={styles.payCardTitle}>Paiement confirmé</Text>
                <Text style={styles.payCardBody}>
                  Votre place est réservée. L’accès missions / boutique s’ouvre dès que l’équipe valide votre identité.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.checkBtn}
            onPress={handleManualCheck}
            disabled={checking}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={20} color={Colors.white} />
            <Text style={styles.checkBtnText} numberOfLines={1}>
              {checking ? 'Vérification...' : 'Vérifier mon statut'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius['3xl'],
    borderBottomRightRadius: BorderRadius['3xl'],
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconWrapCompact: { width: 68, height: 68, borderRadius: 34 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  title: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  titleCompact: { fontSize: Typography.fontSize.xl },
  subtitle: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  stepsCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  stepDone: { backgroundColor: Colors.success },
  stepActive: { backgroundColor: Colors.warning },
  stepPending: { backgroundColor: Colors.gray100 },
  stepInfo: { flex: 1 },
  stepLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  stepStatus: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 2 },
  stepLine: { width: 2, height: 16, backgroundColor: Colors.gray200, marginLeft: 15, marginVertical: 2 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.info + '12',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: Spacing.lg,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },
  payCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.success + '14',
    borderWidth: 1,
    borderColor: Colors.success + '40',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: Spacing.md,
    gap: 12,
  },
  refundCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.info + '14',
    borderWidth: 1,
    borderColor: Colors.info + '40',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    gap: 12,
  },
  payCardText: { flex: 1 },
  payCardTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.success,
    marginBottom: 4,
  },
  refundTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.info,
    marginBottom: 4,
  },
  payCardBody: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    lineHeight: 20,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
    gap: 8,
    minHeight: 52,
    ...Shadows.sm,
  },
  checkBtnText: {
    flexShrink: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    backgroundColor: Colors.accent + '1A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    gap: 8,
    minHeight: 52,
  },
  logoutText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
  },
});
