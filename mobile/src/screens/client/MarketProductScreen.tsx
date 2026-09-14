import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { api, resolveMediaUrl, resolveMediaUrls } from '../../services/api';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';
import { CurrencySwitch } from '../../components/marketplace/CurrencySwitch';
import { Image as ExpoImage } from 'expo-image';

const { width } = Dimensions.get('window');

export const MarketProductScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId as string;
  const { format, currency, setCurrency, isEur, xofPerEur } = useMarketCurrency();
  const [product, setProduct] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      setProduct(await api.marketplace.getProduct(productId));
    } catch (e) {
      console.error(e);
    }
  }, [productId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const photos: string[] = resolveMediaUrls(product?.photoUrls);
  const price = Number(product?.priceXof || 0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }}>
        <View>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {(photos.length ? photos : [null]).map((uri, i) => (
              <View key={i} style={styles.slide}>
                {uri ? (
                  <ExpoImage
                    source={{ uri }}
                    style={styles.slideImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                  />
                ) : (
                  <View style={[styles.slideImg, styles.slideEmpty]}>
                    <Ionicons name="image-outline" size={40} color={Colors.gray400} />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.back, { top: Math.max(insets.top + 8, 52) }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          <TouchableOpacity onPress={() => product?.shopId && navigation.navigate('MarketShop', { shopId: product.shopId })}>
            <Text style={styles.shop}>{product?.shop?.name || 'Boutique'}</Text>
          </TouchableOpacity>
          <Text style={styles.name}>{product?.name || '…'}</Text>
          <Text style={styles.desc}>{product?.description}</Text>

          <View style={styles.priceBlock}>
            <View style={styles.priceTop}>
              <Text style={styles.priceLabel}>À partir de</Text>
              <CurrencySwitch currency={currency} onChange={setCurrency} />
            </View>
            <Text style={styles.price}>{format(price)}</Text>
            <Text style={styles.priceHint}>
              {isEur
                ? `${Math.round(price).toLocaleString('fr-FR')} FCFA`
                : `≈ ${(Math.round((price / xofPerEur) * 100) / 100).toFixed(2)} €`}
              {' · '}Livraison SN +2 500 F · GP diaspora +5 000 F
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <Ionicons name="scale-outline" size={16} color={Colors.primary} />
              <Text style={styles.metaText}>{Number(product?.weightKg || 0)} kg</Text>
            </View>
            <View style={styles.meta}>
              <Ionicons name="layers-outline" size={16} color={Colors.primary} />
              <Text style={styles.metaText}>Stock {product?.stock ?? 0}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + Spacing.base, 28) }]}>
        <Button
          title={product?.stock === 0 ? 'Rupture de stock' : 'Commander'}
          fullWidth
          onPress={() => {
            if (!product || product.stock === 0) return;
            navigation.navigate('MarketCheckout', { productId });
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  slide: { width, height: width * 1.05 },
  slideImg: { width: '100%', height: '100%', backgroundColor: Colors.gray100 },
  slideEmpty: { alignItems: 'center', justifyContent: 'center' },
  back: {
    position: 'absolute', top: 52, left: Spacing.base,
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  dots: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha('#fff', 0.45) },
  dotOn: { backgroundColor: Colors.white, width: 18 },
  body: { padding: Spacing.xl, paddingBottom: 120 },
  shop: {
    fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 12, color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  name: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 26, color: Colors.gray900, marginTop: 6 },
  desc: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 15, color: Colors.gray600,
    lineHeight: 22, marginTop: Spacing.md,
  },
  priceBlock: {
    marginTop: Spacing.xl, padding: Spacing.base, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: withAlpha(Colors.primary, 0.15),
  },
  priceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priceLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: Colors.primaryDark },
  price: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 28, color: Colors.primaryDark, marginTop: 6 },
  priceHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray600, marginTop: 6, lineHeight: 17 },
  metaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.gray200,
  },
  metaText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray700 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: Spacing.base, paddingBottom: 28, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray100,
  },
});
