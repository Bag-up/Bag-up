import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Dimensions,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { api, resolveMediaUrl } from '../../services/api';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';
import { CurrencySwitch } from '../../components/marketplace/CurrencySwitch';

const MARKET_PROMO = require('../../../assets/market-promo.jpg');

type ContentPromo = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string;
  linkType?: string;
  linkTarget?: string | null;
};

const { width } = Dimensions.get('window');
const CARD_W = (width - Spacing.lg * 2 - Spacing.md) / 2;
const POPULAR_W = 148;
const SHOP_CARD_W = 148;

type MarketProduct = {
  id: string;
  name: string;
  priceXof: number | string;
  photoUrls?: string[];
  shopName: string;
  shopId: string;
  shopCategory?: string;
  shopCity?: string;
};

const MARKET_CATEGORIES: {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  match?: string[];
}[] = [
  { id: 'all', label: 'Tous', icon: 'grid' },
  { id: 'alimentaire', label: 'Alimentation', icon: 'nutrition', match: ['alimentaire'] },
  { id: 'artisanat', label: 'Maison', icon: 'home', match: ['artisanat'] },
  { id: 'mode', label: 'Mode', icon: 'shirt', match: ['mode'] },
  { id: 'cosmetique', label: 'Beauté', icon: 'flower', match: ['cosmetique'] },
  { id: 'autre', label: 'Autre', icon: 'apps', match: ['autre'] },
];

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const MarketHomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { format, currency, setCurrency } = useMarketCurrency();
  const [shops, setShops] = useState<any[]>([]);
  const [promos, setPromos] = useState<ContentPromo[]>([]);
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, promoList] = await Promise.all([
        api.marketplace.listShops('Dakar'),
        api.content.promos().catch(() => []),
      ]);
      setShops(Array.isArray(list) ? list : []);
      setPromos(Array.isArray(promoList) ? promoList : []);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const activePromo = promos[0];
  const promoImage = resolveMediaUrl(activePromo?.imageUrl);

  const handlePromoPress = () => {
    const linkType = activePromo?.linkType || 'none';
    if (linkType === 'none' || !activePromo) {
      Alert.alert(
        'Offres du moment',
        'Les promotions marketplace ne sont pas encore activées. Elles arriveront bientôt — en attendant, parcourez le catalogue normalement.',
      );
      return;
    }
    if (linkType === 'market_home') {
      setCategoryId('all');
      return;
    }
    if (linkType === 'shop' && activePromo.linkTarget) {
      navigation.navigate('MarketShop', { shopId: activePromo.linkTarget });
      return;
    }
    if (linkType === 'product' && activePromo.linkTarget) {
      navigation.navigate('MarketProduct', { productId: activePromo.linkTarget });
      return;
    }
    if (linkType === 'url' && activePromo.linkTarget) {
      Linking.openURL(activePromo.linkTarget).catch(() => {
        Alert.alert('Lien', 'Impossible d’ouvrir ce lien.');
      });
      return;
    }
    Alert.alert('Offres du moment', 'Cette offre n’est pas encore disponible.');
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const products = useMemo<MarketProduct[]>(
    () =>
      shops.flatMap((s) =>
        (s.products || []).map((p: any) => ({
          ...p,
          shopName: s.name,
          shopId: s.id,
          shopCategory: s.category,
          shopCity: s.city,
        })),
      ),
    [shops],
  );

  const filteredShops = useMemo(() => {
    const cat = MARKET_CATEGORIES.find((c) => c.id === categoryId);
    const q = normalizeSearch(query);
    return shops.filter((shop) => {
      if (cat && cat.id !== 'all' && cat.match && !cat.match.includes(shop.category)) {
        return false;
      }
      if (!q) return true;
      const haystack = normalizeSearch(
        [shop.name, shop.category, shop.city, shop.description].filter(Boolean).join(' '),
      );
      return haystack.includes(q);
    });
  }, [shops, categoryId, query]);

  const filteredProducts = useMemo(() => {
    const cat = MARKET_CATEGORIES.find((c) => c.id === categoryId);
    const q = normalizeSearch(query);
    return products.filter((p) => {
      if (cat && cat.id !== 'all' && cat.match && !cat.match.includes(p.shopCategory || '')) {
        return false;
      }
      if (!q) return true;
      const haystack = normalizeSearch([p.name, p.shopName, p.shopCategory, p.shopCity].filter(Boolean).join(' '));
      return haystack.includes(q);
    });
  }, [products, categoryId, query]);

  const popularProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const recommendedShops = useMemo(() => filteredShops.slice(0, 8), [filteredShops]);
  const gridProducts = useMemo(() => filteredProducts.slice(0, 20), [filteredProducts]);

  const listHeader = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {MARKET_CATEGORIES.map((cat) => {
          const active = categoryId === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryItem}
              activeOpacity={0.85}
              onPress={() => setCategoryId(cat.id)}
            >
              <View style={[styles.categoryCircle, active && styles.categoryCircleActive]}>
                <Ionicons name={cat.icon} size={20} color={active ? Colors.white : Colors.primary} />
              </View>
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]} numberOfLines={1}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.promoCard, Shadows.md]}
        activeOpacity={0.92}
        onPress={handlePromoPress}
      >
        <View style={[styles.promoBg, { backgroundColor: '#14532D' }]}>
          <ExpoImage
            source={promoImage ? { uri: promoImage } : MARKET_PROMO}
            style={styles.promoBgImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey="market-promo"
            transition={0}
          />
          <LinearGradient
            colors={['rgba(10,40,30,0.88)', 'rgba(20,70,45,0.55)', 'rgba(0,0,0,0.15)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.promoGradient}
          >
            <View style={styles.promoCopy}>
              <Text style={styles.promoKicker}>
                {(activePromo?.title || 'TOP OFFRES DU MOMENT').toUpperCase()}
              </Text>
              <Text style={styles.promoTitle}>
                {activePromo?.subtitle || 'Jusqu’à -50% chez nos boutiques'}
              </Text>
              <View style={styles.promoBtn}>
                <Text style={styles.promoBtnText}>{activePromo?.ctaLabel || 'Découvrir'}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>

      {popularProducts.length > 0 && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>Produits populaires</Text>
            <TouchableOpacity onPress={() => setCategoryId('all')} hitSlop={8}>
              <Text style={styles.blockLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hStrip}>
            {popularProducts.map((item) => (
              <TouchableOpacity
                key={`pop-${item.id}`}
                style={[styles.popularCard, Shadows.sm]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('MarketProduct', { productId: item.id })}
              >
                {resolveMediaUrl(item.photoUrls?.[0]) ? (
                  <ExpoImage
                    source={{ uri: resolveMediaUrl(item.photoUrls?.[0])! }}
                    style={styles.popularImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={100}
                  />
                ) : (
                  <View style={[styles.popularImg, styles.imgEmpty]}>
                    <Ionicons name="image-outline" size={24} color={Colors.gray400} />
                  </View>
                )}
                <Text style={styles.popularPrice}>{format(Number(item.priceXof))}</Text>
                <Text style={styles.popularName} numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {recommendedShops.length > 0 && (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitle}>Boutiques recommandées</Text>
            <Text style={styles.blockMeta}>{recommendedShops.length}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hStrip}>
            {recommendedShops.map((shop) => (
              <TouchableOpacity
                key={shop.id}
                style={[styles.shopCard, Shadows.sm]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('MarketShop', { shopId: shop.id })}
              >
                {resolveMediaUrl(shop.logoUrl || shop.coverUrl) ? (
                  <ExpoImage
                    source={{ uri: resolveMediaUrl(shop.logoUrl || shop.coverUrl)! }}
                    style={styles.shopImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={100}
                  />
                ) : (
                  <View style={[styles.shopImg, styles.imgEmpty]}>
                    <Ionicons name="storefront" size={26} color={Colors.primary} />
                  </View>
                )}
                <Text style={styles.shopName} numberOfLines={1}>
                  {shop.name}
                </Text>
                <View style={styles.shopMetaRow}>
                  <Ionicons name="location-outline" size={12} color={Colors.gray400} />
                  <Text style={styles.shopMeta} numberOfLines={1}>
                    {shop.category || shop.city || 'Dakar'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.blockHeader}>
        <Text style={styles.blockTitle}>Catalogue</Text>
        <Text style={styles.blockMeta}>{gridProducts.length} produit{gridProducts.length > 1 ? 's' : ''}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, Spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>B</Text>
          </View>
          <Text style={styles.pageTitle}>Marketplace</Text>
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MarketOrders')}
        >
          <Ionicons name="cart" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, Shadows.sm]}>
        <Ionicons name="search" size={18} color={Colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un produit, une boutique…"
          placeholderTextColor={Colors.gray400}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Ionicons name="location" size={13} color={Colors.primary} />
          <Text style={styles.metaChipText}>Dakar</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="pricetag-outline" size={13} color={Colors.primary} />
          <Text style={styles.metaChipText}>Prix tout compris</Text>
        </View>
        <CurrencySwitch currency={currency} onChange={setCurrency} />
      </View>

      <FlatList
        key={`market-${categoryId}-${query}`}
        data={gridProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 88, 104) }]}
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
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={shops.length ? 'cube-outline' : 'storefront-outline'} size={42} color={Colors.gray300} />
            <Text style={styles.emptyTitle}>
              {shops.length
                ? query
                  ? 'Aucun résultat'
                  : 'Catalogue en préparation'
                : 'Bientôt disponible'}
            </Text>
            <Text style={styles.emptyText}>
              {shops.length
                ? query
                  ? `Rien pour « ${query.trim()} ». Essayez une autre recherche.`
                  : 'Les commerçants pilotes préparent leurs produits.'
                : 'Les commerçants pilotes préparent leurs catalogues.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, Shadows.sm]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('MarketProduct', { productId: item.id })}
          >
            {resolveMediaUrl(item.photoUrls?.[0]) ? (
              <ExpoImage
                source={{ uri: resolveMediaUrl(item.photoUrls?.[0])! }}
                style={styles.cardImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={100}
              />
            ) : (
              <View style={[styles.cardImg, styles.imgEmpty]}>
                <Ionicons name="image-outline" size={28} color={Colors.gray400} />
              </View>
            )}
            <Text style={styles.cardPrice}>{format(Number(item.priceXof))}</Text>
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.cardShopRow}>
              <Ionicons name="location-outline" size={12} color={Colors.primary} />
              <Text style={styles.cardShop} numberOfLines={1}>
                {item.shopName}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 14,
    color: Colors.primaryDark,
  },
  pageTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.xs,
  },
  searchBar: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    paddingVertical: 10,
  },
  metaRow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 12,
    color: Colors.gray700,
  },
  list: { paddingHorizontal: Spacing.lg, flexGrow: 1 },
  categoryRow: {
    gap: Spacing.md,
    paddingBottom: Spacing.base,
    paddingRight: Spacing.sm,
  },
  categoryItem: { width: 68, alignItems: 'center', gap: 6 },
  categoryCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 11,
    color: Colors.gray600,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
  },
  promoCard: {
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  promoBg: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius['2xl'],
  },
  promoBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  promoGradient: {
    minHeight: 148,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoCopy: { flex: 1, paddingRight: Spacing.sm, maxWidth: '72%' },
  promoKicker: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: 11,
    color: withAlpha('#fff', 0.9),
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  promoTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  promoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  promoBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primaryDark,
  },
  block: { marginBottom: Spacing.lg },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  blockTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  blockLink: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  blockMeta: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  hStrip: { gap: Spacing.sm, paddingRight: Spacing.sm },
  popularCard: {
    width: POPULAR_W,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    paddingBottom: Spacing.sm,
  },
  popularImg: {
    width: '100%',
    height: 110,
    backgroundColor: Colors.gray100,
  },
  popularPrice: {
    marginTop: 8,
    marginHorizontal: 10,
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primaryDark,
  },
  popularName: {
    marginTop: 2,
    marginHorizontal: 10,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    minHeight: 34,
  },
  shopCard: {
    width: SHOP_CARD_W,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.sm,
  },
  shopImg: {
    width: '100%',
    height: 88,
    borderRadius: 14,
    backgroundColor: Colors.gray100,
  },
  shopName: {
    marginTop: 8,
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  shopMeta: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 11,
    color: Colors.gray500,
  },
  row: { gap: Spacing.md },
  card: {
    width: CARD_W,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  cardImg: { width: '100%', height: CARD_W * 0.9, backgroundColor: Colors.gray100 },
  imgEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardPrice: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primaryDark,
    marginTop: 10,
    marginHorizontal: 10,
  },
  cardName: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    marginHorizontal: 10,
    marginTop: 2,
    minHeight: 34,
  },
  cardShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  cardShop: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 11,
    color: Colors.gray500,
  },
  empty: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 24, paddingBottom: 40 },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: 17,
    color: Colors.gray700,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 13,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 6,
  },
});
