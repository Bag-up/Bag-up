import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

/**
 * Accueil commerçant quand Anti-Gaspi + Marketplace sont actifs.
 * Deux portes claires pour éviter de confondre les canaux.
 */
export const MerchantHubScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const displayName = user?.businessName || user?.firstName || 'Commerçant';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 56) }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.kicker}>Espace commerçant</Text>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.sub}>Choisissez un canal pour continuer</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.card, Shadows.sm]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('MAntiGaspi')}
        >
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(Colors.secondary, 0.2) }]}>
            <Ionicons name="leaf" size={28} color={Colors.secondary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Anti-Gaspi</Text>
            <Text style={styles.cardDesc}>
              Publiez des paniers surplus, gérez les retraits et vos revenus Anti-Gaspi.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, Shadows.sm]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('MShop')}
        >
          <View style={[styles.iconWrap, { backgroundColor: Colors.primarySoft }]}>
            <Ionicons name="storefront" size={28} color={Colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Boutique Marketplace</Text>
            <Text style={styles.cardDesc}>
              Produits, commandes et abonnement de votre boutique en ligne.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  kicker: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
  },
  title: {
    marginTop: 4,
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  sub: {
    marginTop: 6,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
  },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  cardDesc: {
    marginTop: 4,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    lineHeight: 20,
  },
});
