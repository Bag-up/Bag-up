import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../services/api';
import { MERCHANT_SUBSCRIPTION_AMOUNT } from '../../constants/marketplace';

export const ShopHubScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [shop, setShop] = useState<any>(null);
  const [missing, setMissing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.marketplace.myShop(token);
      setShop(data);
      setMissing(false);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) {
        setShop(null);
        setMissing(true);
      } else {
        console.error(e);
      }
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const productCount = shop?._count?.products ?? shop?.products?.length ?? 0;
  const subOk = !!shop?.subscriptionActive;

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 56) }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.kicker}>Marketplace</Text>
        <Text style={styles.title}>Ma boutique</Text>
        <Text style={styles.sub}>
          {missing ? 'Créez votre fiche pour vendre sur Bag\'up' : shop?.name || 'Votre espace commerçant'}
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {!missing && !subOk && (
          <TouchableOpacity
            style={styles.subBanner}
            onPress={() => navigation.navigate('ShopSubscription')}
            activeOpacity={0.85}
          >
            <Ionicons name="diamond-outline" size={22} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.subBannerTitle}>Activez votre abonnement</Text>
              <Text style={styles.subBannerText}>
                {MERCHANT_SUBSCRIPTION_AMOUNT.toLocaleString()} FCFA / mois pour être visible et publier vos produits
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        )}

        {missing ? (
          <>
            <View style={styles.stepsCard}>
              <Text style={styles.stepsTitle}>Mise en route</Text>
              <Text style={styles.stepLine}>1. Créez la fiche de votre boutique</Text>
              <Text style={styles.stepLine}>2. Activez l’abonnement pour être visible</Text>
            </View>
            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() => navigation.navigate('ShopEdit')}
              activeOpacity={0.9}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="storefront" size={28} color={Colors.primary} />
              </View>
              <Text style={styles.ctaTitle}>Créer ma boutique</Text>
              <Text style={styles.ctaText}>Nom, logo, description, catégorie et contact</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.pill, subOk ? styles.pillOk : styles.pillWarn]}>
                <Text style={[styles.pillText, subOk ? styles.pillTextOk : styles.pillTextWarn]}>
                  {subOk ? 'Abonnement actif' : 'Abo requis'}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{shop?.status || '—'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ShopEdit')} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={22} color={Colors.primary} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Fiche boutique</Text>
                <Text style={styles.cardSub}>{shop?.city} · {shop?.category}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (!subOk) {
                  Alert.alert(
                    'Abonnement requis',
                    'Activez l’abonnement pour publier et gérer vos produits sur la Marketplace.',
                    [
                      { text: 'Plus tard', style: 'cancel' },
                      { text: 'S’abonner', onPress: () => navigation.navigate('ShopSubscription') },
                    ],
                  );
                  return;
                }
                navigation.navigate('ShopProducts');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="cube-outline" size={22} color={Colors.primary} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Catalogue produits</Text>
                <Text style={styles.cardSub}>
                  {subOk ? `${productCount} produit(s)` : 'Abonnement requis pour publier'}
                </Text>
              </View>
              <Ionicons name={subOk ? 'chevron-forward' : 'lock-closed-outline'} size={18} color={Colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ShopOrders')} activeOpacity={0.85}>
              <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Commandes</Text>
                <Text style={styles.cardSub}>Préparer · suivre · reversements</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ShopSubscription')}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={22} color={Colors.primary} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Abonnement</Text>
                <Text style={styles.cardSub}>{MERCHANT_SUBSCRIPTION_AMOUNT.toLocaleString()} FCFA / mois</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 56, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  kicker: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: withAlpha('#fff', 0.75), letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 28, color: Colors.white, marginTop: 4 },
  sub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: withAlpha('#fff', 0.85), marginTop: 6 },
  content: { padding: Spacing.base, paddingBottom: 40, gap: Spacing.md },
  subBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.accentSoft, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.2),
  },
  subBannerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 14, color: Colors.gray900 },
  subBannerText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray600, marginTop: 2 },
  stepsCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  stepsTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900, marginBottom: Spacing.sm,
  },
  stepLine: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray600, marginBottom: 4, lineHeight: 20,
  },
  ctaCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center',
    ...Shadows.primary, borderWidth: 1, borderColor: Colors.primarySoft,
  },
  ctaIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  ctaTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 18, color: Colors.gray900 },
  ctaText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray500, marginTop: 6, textAlign: 'center' },
  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  pill: { backgroundColor: Colors.gray100, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillOk: { backgroundColor: Colors.successSoft },
  pillWarn: { backgroundColor: Colors.warningSoft },
  pillText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: Colors.gray600 },
  pillTextOk: { color: Colors.success },
  pillTextWarn: { color: Colors.warning },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900 },
  cardSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginTop: 2 },
});
