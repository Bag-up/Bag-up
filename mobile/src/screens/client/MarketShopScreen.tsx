import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { api, resolveMediaUrl } from '../../services/api';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';
import { socialProfileUrl } from '../../utils/socialLinks';

const { width } = Dimensions.get('window');

export const MarketShopScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const shopId = route.params?.shopId as string;
  const { format } = useMarketCurrency();
  const [shop, setShop] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setShop(await api.marketplace.getShop(shopId));
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [shopId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const products = shop?.products || [];

  const socials = [
    { key: 'whatsapp' as const, icon: 'logo-whatsapp' as const, label: 'WhatsApp', value: shop?.whatsapp },
    { key: 'instagram' as const, icon: 'logo-instagram' as const, label: 'Instagram', value: shop?.instagram },
    { key: 'facebook' as const, icon: 'logo-facebook' as const, label: 'Facebook', value: shop?.facebook },
    { key: 'tiktok' as const, icon: 'logo-tiktok' as const, label: 'TikTok', value: shop?.tiktok },
  ].filter((s) => !!s.value?.trim());

  const openSocial = async (network: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok', value: string) => {
    const url = socialProfileUrl(network, value);
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
      >
        <View style={styles.coverWrap}>
          {resolveMediaUrl(shop?.coverUrl) ? (
            <ExpoImage
              source={{ uri: resolveMediaUrl(shop?.coverUrl)! }}
              style={styles.cover}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={Colors.gradientPrimary} style={styles.cover} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.coverShade} />
          <TouchableOpacity style={[styles.back, { top: Math.max(insets.top + 8, 52) }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.coverText}>
            <Text style={styles.shopName}>{shop?.name || '…'}</Text>
            <Text style={styles.shopMeta}>{shop?.category} · {shop?.city}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {shop?.description ? (
            <Text style={styles.desc}>{shop.description}</Text>
          ) : null}

          {socials.length > 0 && (
            <View style={styles.socialRow}>
              {socials.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.socialBtn}
                  onPress={() => openSocial(s.key, s.value)}
                  accessibilityLabel={s.label}
                >
                  <Ionicons name={s.icon} size={20} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.section}>Produits</Text>
          <View style={styles.grid}>
            {products.map((p: any) => (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('MarketProduct', { productId: p.id })}
              >
                {resolveMediaUrl(p.photoUrls?.[0]) ? (
                  <ExpoImage
                    source={{ uri: resolveMediaUrl(p.photoUrls?.[0])! }}
                    style={styles.img}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={100}
                  />
                ) : (
                  <View style={[styles.img, styles.imgEmpty]} />
                )}
                <Text style={styles.pname} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.pprice}>{format(Number(p.priceXof))}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!products.length && (
            <Text style={styles.empty}>Aucun produit publié pour le moment.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  coverWrap: { height: 220, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverShade: { ...StyleSheet.absoluteFillObject },
  back: {
    position: 'absolute', top: 52, left: Spacing.base,
    width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha('#000', 0.35),
    alignItems: 'center', justifyContent: 'center',
  },
  coverText: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.lg },
  shopName: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 28, color: Colors.white },
  shopMeta: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: withAlpha('#fff', 0.85), marginTop: 4 },
  body: { padding: Spacing.base, paddingBottom: 40 },
  desc: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray600,
    lineHeight: 21, marginBottom: Spacing.lg,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: withAlpha(Colors.primary, 0.2),
  },
  section: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  card: {
    width: (width - Spacing.base * 2 - Spacing.md) / 2,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.gray100,
  },
  img: { width: '100%', height: 140, backgroundColor: Colors.gray100 },
  imgEmpty: { backgroundColor: Colors.primarySoft },
  pname: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 13, color: Colors.gray900, margin: 10, minHeight: 34 },
  pprice: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 14, color: Colors.primaryDark, marginHorizontal: 10, marginBottom: 12 },
  empty: { fontFamily: Typography.fontFamily.dmSans.regular, color: Colors.gray500, textAlign: 'center', marginTop: 24 },
});
