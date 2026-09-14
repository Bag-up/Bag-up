import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const payoutLabels: Record<string, string> = {
  held: 'En attente (J+2)',
  eligible: 'À verser',
  paid_out: 'Versé',
  cancelled: 'Annulé',
};

const payoutColors: Record<string, string> = {
  held: Colors.warning,
  eligible: Colors.info,
  paid_out: Colors.success,
  cancelled: Colors.gray400,
};

export const ProviderEarningsScreen: React.FC = () => {
  const { token } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMissions = useCallback(async () => {
    if (!token) return;
    try {
      const [data, rides] = await Promise.all([
        api.missions.provider(token),
        api.rides.driver(token).catch(() => []),
      ]);
      // Courses : le client paie Bag'up (pas le chauffeur). Le gain n'apparaît
      // en « En attente J+2 » qu'après paiement réussi (payoutStatus renseigné).
      const rideItems = (Array.isArray(rides) ? rides : [])
        .filter((r: any) => r.status === 'completed' && r.payoutStatus)
        .map((r: any) => ({
          ...r,
          kind: 'ride',
          status: 'delivered',
          price: r.finalPrice ?? r.estimatedPrice,
          providerAmount: r.providerAmount ?? r.finalPrice ?? r.estimatedPrice,
          payoutStatus: r.payoutStatus,
          pickupAddress: r.pickupAddress,
          deliveryAddress: r.dropoffAddress,
          serviceType: 'Course',
          createdAt: r.completedAt || r.createdAt,
        }));
      setMissions([...(Array.isArray(data) ? data : []), ...rideItems]);
    } catch (e) {
      console.error('ProviderEarnings fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [fetchMissions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMissions();
    setRefreshing(false);
  }, [fetchMissions]);

  const deliveredMissions = useMemo(
    () => missions.filter((m) => m.status === 'delivered'),
    [missions],
  );

  const amountOf = (m: any) => Number(m.providerAmount ?? m.price ?? 0);

  const totalEarnings = deliveredMissions.reduce((sum, m) => sum + amountOf(m), 0);
  const paidOut = deliveredMissions
    .filter((m) => m.payoutStatus === 'paid_out')
    .reduce((sum, m) => sum + amountOf(m), 0);
  const pending = deliveredMissions
    .filter((m) => m.payoutStatus === 'held' || m.payoutStatus === 'eligible' || !m.payoutStatus)
    .reduce((sum, m) => sum + amountOf(m), 0);
  const eligible = deliveredMissions
    .filter((m) => m.payoutStatus === 'eligible')
    .reduce((sum, m) => sum + amountOf(m), 0);

  const thisMonth = deliveredMissions.filter((m) => {
    const d = new Date(m.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthEarnings = thisMonth.reduce((sum, m) => sum + amountOf(m), 0);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const dailyEarnings = last7Days.map((d) => {
    const dayMissions = deliveredMissions.filter((m) => {
      const md = new Date(m.createdAt);
      return md.toDateString() === d.toDateString();
    });
    return {
      date: d,
      amount: dayMissions.reduce((sum, m) => sum + amountOf(m), 0),
      count: dayMissions.length,
    };
  });

  const maxDaily = Math.max(...dailyEarnings.map((d) => d.amount), 1);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={Colors.gradientPrimary} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerIcon}>
          <Ionicons name="wallet" size={28} color={Colors.white} />
        </View>
        <Text style={styles.headerLabel}>Gains livrés</Text>
        <Text style={styles.headerAmount}>
          {totalEarnings.toLocaleString()} <Text style={styles.headerCurrency}>FCFA</Text>
        </Text>
        <Text style={styles.headerSub}>
          {deliveredMissions.length} mission{deliveredMissions.length > 1 ? 's' : ''} · versé {paidOut.toLocaleString()} F
        </Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, Shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{paidOut.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Versé (FCFA)</Text>
        </View>
        <View style={[styles.statCard, Shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.warning, 0.12) }]}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
          </View>
          <Text style={styles.statValue}>{pending.toLocaleString()}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={[styles.statCard, Shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.info, 0.12) }]}>
            <Ionicons name="calendar-outline" size={18} color={Colors.info} />
          </View>
          <Text style={styles.statValue}>{monthEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Ce mois</Text>
        </View>
      </View>

      {eligible > 0 && (
        <View style={styles.eligibleBanner}>
          <Ionicons name="cash-outline" size={18} color={Colors.info} />
          <Text style={styles.eligibleText}>
            {eligible.toLocaleString()} FCFA prêts à être versés par Bag&apos;Up
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7 derniers jours</Text>
        <View style={[styles.chartCard, Shadows.sm]}>
          {dailyEarnings.map((d, i) => (
            <View key={i} style={styles.chartBarWrap}>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${(d.amount / maxDaily) * 100}%`,
                      backgroundColor: d.amount > 0 ? Colors.primary : Colors.gray200,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartDay}>
                {d.date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
              </Text>
              <Text style={styles.chartAmount}>{d.amount > 0 ? `${d.amount}` : ''}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historique des gains</Text>
        {loading ? (
          <Text style={styles.emptyText}>Chargement...</Text>
        ) : deliveredMissions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cash-outline" size={32} color={Colors.gray300} />
            </View>
            <Text style={styles.emptyText}>Aucun gain pour le moment</Text>
            <Text style={styles.emptySub}>Vos missions livrées apparaîtront ici</Text>
          </View>
        ) : (
          deliveredMissions.map((m) => {
            const status = m.payoutStatus || 'held';
            const color = payoutColors[status] || Colors.gray400;
            return (
              <View key={m.id} style={[styles.earningCard, Shadows.sm]}>
                <View style={[styles.earningIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                  <Ionicons
                    name={status === 'paid_out' ? 'checkmark-done' : status === 'eligible' ? 'wallet' : 'time'}
                    size={18}
                    color={color}
                  />
                </View>
                <View style={styles.earningInfo}>
                  <Text style={styles.earningType}>{m.serviceType}</Text>
                  <Text style={styles.earningDate}>
                    {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={[styles.payoutBadge, { color }]}>{payoutLabels[status] || status}</Text>
                </View>
                <View style={styles.earningRight}>
                  <Text style={styles.earningAmount}>+{amountOf(m).toLocaleString()}</Text>
                  <Text style={styles.earningCurrency}>FCFA</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56,
    paddingBottom: Spacing['2xl'],
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius['3xl'],
    borderBottomRightRadius: BorderRadius['3xl'],
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  headerLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.85,
  },
  headerAmount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['3xl'],
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  headerCurrency: { fontSize: Typography.fontSize.lg, opacity: 0.85 },
  headerSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.7,
    marginTop: Spacing.xs,
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginTop: -Spacing.xl, gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center' },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  statLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 10, color: Colors.gray400, marginTop: 4, textAlign: 'center' },
  eligibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: withAlpha(Colors.info, 0.1),
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: withAlpha(Colors.info, 0.2),
  },
  eligibleText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 140,
  },
  chartBarWrap: { flex: 1, alignItems: 'center' },
  chartBarContainer: { height: 80, width: 20, justifyContent: 'flex-end', marginBottom: Spacing.xs },
  chartBar: { width: '100%', borderRadius: BorderRadius.sm, minHeight: 4 },
  chartDay: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 10, color: Colors.gray400 },
  chartAmount: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 9, color: Colors.primary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray500 },
  emptySub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 4 },
  earningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  earningIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  earningInfo: { flex: 1 },
  earningType: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    textTransform: 'capitalize',
  },
  earningDate: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  payoutBadge: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, marginTop: 4 },
  earningRight: { alignItems: 'flex-end' },
  earningAmount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.md, color: Colors.success },
  earningCurrency: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400 },
});
