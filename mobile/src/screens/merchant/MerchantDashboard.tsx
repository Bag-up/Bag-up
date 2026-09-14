import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const MerchantDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, reservations] = await Promise.all([
        api.antiGaspi.merchantStats(token),
        api.antiGaspi.merchantReservations(token),
      ]);
      setStats(s);
      const list = Array.isArray(reservations) ? reservations : [];
      setPendingCount(
        list.filter((r: any) =>
          ['paid', 'merchant_confirmed', 'client_confirmed'].includes(r.status),
        ).length,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const displayName = user?.businessName || user?.firstName || 'Commerçant';
  const initial = (displayName[0] || 'C').toUpperCase();

  const shortcuts = [
    {
      icon: 'basket' as const,
      label: 'Mes paniers',
      sub: `${stats?.basketsPublished ?? 0} publiés`,
      color: Colors.primary,
      bg: Colors.primarySoft,
      onPress: () => navigation.navigate('MBaskets'),
    },
    {
      icon: 'checkmark-done' as const,
      label: 'Retraits',
      sub: pendingCount > 0 ? `${pendingCount} en attente` : 'Aucun en cours',
      color: Colors.warning,
      bg: Colors.warningSoft,
      onPress: () => navigation.navigate('MReservations'),
      badge: pendingCount,
    },
    {
      icon: 'wallet' as const,
      label: 'Revenus',
      sub: `${Number(stats?.revenueReceived || 0).toLocaleString()} F`,
      color: Colors.success,
      bg: Colors.successSoft,
      onPress: () => navigation.navigate('MPayouts'),
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, Spacing['3xl']) }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>Anti-Gaspi</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
          </View>
          <View style={styles.leafBadge}>
            <Ionicons name="leaf" size={18} color={Colors.secondary} />
          </View>
        </View>
        <Text style={styles.headerSub}>Vendez vos surplus · commission 15 %</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
        showsVerticalScrollIndicator={false}
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
        <View style={[styles.statsCard, Shadows.sm]}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
              <Ionicons name="wallet-outline" size={16} color={Colors.success} />
            </View>
            <Text style={styles.statValue}>
              {Number(stats?.revenueReceived || 0).toLocaleString()}
              <Text style={styles.statSuffix}> F</Text>
            </Text>
            <Text style={styles.statLabel}>Reçus</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.primary, 0.12) }]}>
              <Ionicons name="basket-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.statValue}>{stats?.basketsPublished ?? 0}</Text>
            <Text style={styles.statLabel}>Publiés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.info, 0.12) }]}>
              <Ionicons name="trending-up" size={16} color={Colors.info} />
            </View>
            <Text style={styles.statValue}>{stats?.basketsSold ?? 0}</Text>
            <Text style={styles.statLabel}>Vendus</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.cta, Shadows.primary]}
          activeOpacity={0.88}
          onPress={() => navigation.getParent()?.navigate('MerchantPublish')}
        >
          <LinearGradient
            colors={Colors.gradientPrimary}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.ctaIcon}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </View>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>Publier un panier</Text>
              <Text style={styles.ctaSub}>Max. 3 articles actifs</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>

        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.alertRow}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MReservations')}
          >
            <View style={styles.alertIcon}>
              <Ionicons name="time" size={18} color={Colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {pendingCount} retrait{pendingCount > 1 ? 's' : ''} à traiter
              </Text>
              <Text style={styles.alertSub}>Confirmez la remise au client</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Raccourcis</Text>
        {shortcuts.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.shortcut, Shadows.sm]}
            activeOpacity={0.85}
            onPress={item.onPress}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
              <Text style={styles.shortcutSub}>{item.sub}</Text>
            </View>
            {item.badge != null && item.badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withAlpha(Colors.white, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: withAlpha(Colors.white, 0.4),
  },
  avatarText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
  },
  greeting: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
  },
  userName: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.white,
  },
  leafBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(Colors.white, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSub: {
    marginTop: Spacing.md,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
  },
  content: { flex: 1 },
  contentInner: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  statSuffix: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  statDivider: { width: 1, backgroundColor: Colors.gray100, marginVertical: 4 },
  cta: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextWrap: { flex: 1 },
  ctaTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  ctaSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: withAlpha(Colors.white, 0.85),
    marginTop: 2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.warningSoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  alertSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray600,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  shortcutSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
});
