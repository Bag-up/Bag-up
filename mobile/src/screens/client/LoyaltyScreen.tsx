import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { tierUi } from '../../constants/loyalty';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface Props {
  onBack: () => void;
  navigation?: any;
}

function formatExpiry(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export const LoyaltyScreen: React.FC<Props> = ({ onBack, navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.loyalty.me(token);
      setData(res);
    } catch (e) {
      console.error('LoyaltyScreen fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchStatus();
    }, [fetchStatus]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, [fetchStatus]);

  const current = data?.currentTier;
  const ui = tierUi(current?.key);
  const next = data?.nextTier;
  const remaining = data?.remainingToNext ?? 0;
  const progress = data?.progressPercent ?? 0;
  const vouchers = data?.availableVouchers || [];
  const gifts = data?.availableGifts || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ma fidélité</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !data ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 48) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          <LinearGradient colors={ui.gradient} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.heroIcon}>
              <Ionicons name={ui.icon as any} size={28} color={Colors.white} />
            </View>
            <Text style={styles.heroLevel}>Niveau {current?.name || 'Ivoire'}</Text>
            <Text style={styles.heroCount}>
              {data?.completedCount ?? 0} activité{(data?.completedCount || 0) > 1 ? 's' : ''} terminée{(data?.completedCount || 0) > 1 ? 's' : ''}
            </Text>
            {next ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.heroNext}>
                  Encore {remaining} pour {next.name}
                </Text>
              </>
            ) : (
              <Text style={styles.heroNext}>Palier maximum atteint — avantages Gold chaque mois</Text>
            )}
          </LinearGradient>

          {(vouchers.length > 0 || gifts.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À utiliser</Text>
              {vouchers.map((v: any) => (
                <View key={v.id} style={[styles.rewardCard, Shadows.sm]}>
                  <View style={[styles.rewardIcon, { backgroundColor: withAlpha(Colors.primary, 0.12) }]}>
                    <Ionicons name="ticket-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>Bon de {Number(v.amount).toLocaleString()} FCFA</Text>
                    <Text style={styles.rewardSub}>
                      Valable jusqu’au {formatExpiry(v.expiresAt) || '—'} · applicable au paiement
                    </Text>
                  </View>
                </View>
              ))}
              {gifts.map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.rewardCard, Shadows.sm]}
                  activeOpacity={0.85}
                  onPress={() => navigation?.navigate('AntiGaspiBrowse')}
                >
                  <View style={[styles.rewardIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
                    <Ionicons name="leaf-outline" size={20} color={Colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>Panier Anti-Gaspi offert</Text>
                    <Text style={styles.rewardSub}>
                      Jusqu’à {Number(g.amount).toLocaleString()} FCFA · Bag'up paie le commerçant
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Les 5 niveaux</Text>
            {(data?.tiers || []).map((tier: any) => {
              const tUi = tierUi(tier.key);
              const unlocked = !!tier.unlocked;
              return (
                <View
                  key={tier.key}
                  style={[
                    styles.tierRow,
                    Shadows.sm,
                    unlocked && styles.tierRowOn,
                    current?.key === tier.key && { borderColor: tUi.color, borderWidth: 1.5 },
                  ]}
                >
                  <View style={[styles.tierIcon, { backgroundColor: withAlpha(tUi.color, unlocked ? 0.16 : 0.08) }]}>
                    <Ionicons name={tUi.icon as any} size={18} color={unlocked ? tUi.color : Colors.gray400} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierName, !unlocked && { color: Colors.gray400 }]}>
                      {tier.name}
                      {current?.key === tier.key ? '  · actuel' : ''}
                    </Text>
                    <Text style={styles.tierMeta}>
                      {tier.minCompleted} activité{tier.minCompleted > 1 ? 's' : ''}
                      {tier.voucherAmount > 0 ? ` · bon ${tier.voucherAmount.toLocaleString()} F` : ''}
                      {tier.monthly ? ' / mois' : ''}
                    </Text>
                    {tier.perks?.slice(0, 2).map((p: string) => (
                      <Text key={p} style={styles.tierPerk}>
                        {unlocked ? '✓' : '·'} {p}
                      </Text>
                    ))}
                  </View>
                  {unlocked ? (
                    <Ionicons name="checkmark-circle" size={20} color={tUi.color} />
                  ) : (
                    <Ionicons name="lock-closed-outline" size={16} color={Colors.gray300} />
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comment ça marche</Text>
            <View style={[styles.helpCard, Shadows.sm]}>
              <Text style={styles.helpText}>
                Chaque mission, course taxi, panier Anti-Gaspi ou commande boutique terminée compte. Les bons sont à montant fixe, valables 30 jours, utilisables quand vous voulez. Au niveau Gold, un bon et un panier offert sont renouvelés chaque mois. Bag'up paie le commerçant pour les paniers cadeaux.
              </Text>
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: Spacing.lg,
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
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.primary,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroLevel: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  heroCount: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.9,
    marginTop: 4,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  heroNext: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    opacity: 0.9,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  rewardSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tierRowOn: { backgroundColor: Colors.white },
  tierIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierName: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  tierMeta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  tierPerk: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  helpCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  helpText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },
});
