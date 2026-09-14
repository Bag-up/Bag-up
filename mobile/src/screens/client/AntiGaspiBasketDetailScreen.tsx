import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';

interface Props {
  basketId: string;
  onBack: () => void;
  navigation?: any;
}

export const AntiGaspiBasketDetailScreen: React.FC<Props> = ({ basketId, onBack, navigation }) => {
  const { token } = useAuth();
  const [basket, setBasket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.antiGaspi.basket(basketId, token);
      setBasket(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de charger le panier');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [basketId, token, onBack]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reserve = async () => {
    if (!token) return;
    setReserving(true);
    try {
      const reservation = await api.antiGaspi.reserve(basketId, token);
      navigation?.navigate('AntiGaspiPayment', {
        reservationId: reservation.id,
        amount: Number(reservation.price),
      });
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Réservation impossible';
      Alert.alert('Réservation', msg);
    } finally {
      setReserving(false);
    }
  };

  if (loading || !basket) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const merchant = basket.merchant;
  const merchantAvatar = resolveMediaUrl(merchant?.avatarUrl);
  const basketPhoto = resolveMediaUrl(basket.photoUrl);
  const start = new Date(basket.pickupStartAt);
  const end = new Date(basket.pickupEndAt);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panier</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {basketPhoto ? (
          <ExpoImage source={{ uri: basketPhoto }} style={styles.hero} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Ionicons name="basket" size={56} color={Colors.primary} />
          </View>
        )}

        <Text style={styles.title}>{basket.title}</Text>
        <Text style={styles.price}>{Number(basket.price).toLocaleString()} FCFA</Text>

        {basket.description ? <Text style={styles.desc}>{basket.description}</Text> : null}

        <View style={[styles.infoCard, Shadows.sm]}>
          <View style={styles.merchantHero}>
            {merchantAvatar ? (
              <ExpoImage source={{ uri: merchantAvatar }} style={styles.merchantAvatar} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.merchantAvatar, styles.merchantAvatarPh]}>
                <Ionicons name="storefront" size={22} color={Colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.merchantName}>
                {merchant?.businessName || `${merchant?.firstName || ''} ${merchant?.lastName || ''}`.trim()}
              </Text>
              {merchant?.rating != null && Number(merchant.rating) > 0 ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={Colors.warning} />
                  <Text style={styles.ratingText}>{Number(merchant.rating).toFixed(1)}</Text>
                </View>
              ) : (
                <Text style={styles.merchantSub}>Commerçant Bag’up</Text>
              )}
            </View>
            {merchant?.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>Vérifié</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              {merchant?.businessAddress || basket.pickupAddress}
            </Text>
          </View>
          {merchant?.phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>{merchant.phone}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              {start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
              {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} –{' '}
              {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <Text style={styles.note}>
          Après réservation, vous avez quelques minutes pour payer. Le retrait se fait sur place auprès du commerçant.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={basket.status === 'available' ? 'Réserver ce panier' : 'Indisponible'}
          onPress={reserve}
          loading={reserving}
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing['2xl'],
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
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
  },
  content: { padding: Spacing.base, paddingBottom: 120 },
  hero: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
  },
  heroPlaceholder: {
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.gray900,
  },
  price: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  desc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.gray600,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  merchantHero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  merchantAvatar: { width: 48, height: 48, borderRadius: 24 },
  merchantAvatarPh: {
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  merchantSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 12,
    color: Colors.gray700,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 11,
    color: Colors.success,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  note: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
});
