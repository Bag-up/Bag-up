import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, resolveMediaUrl } from '../../services/api';
import { handleCheckout, pollStatus } from '../../services/checkout';
import { useMarketCurrency } from '../../hooks/useMarketCurrency';
import { CurrencySwitch } from '../../components/marketplace/CurrencySwitch';
import { searchLocations } from '../../constants/senegalLocations';
import { geocodeAddress } from '../../services/location';

type DeliveryMode = 'bagup_courier' | 'handoff_tiers' | 'handoff_gp';

const DELIVERY_MODES: {
  id: DeliveryMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  feeLabel: string;
}[] = [
  {
    id: 'bagup_courier',
    icon: 'bicycle',
    label: 'Livreur Bag’up',
    hint: 'Livraison à votre adresse au Sénégal. Forfait +2 500 F.',
    feeLabel: '+2 500 F',
  },
  {
    id: 'handoff_tiers',
    icon: 'people',
    label: 'Remise à un tiers',
    hint: 'Bag’up livre à un proche au Sénégal. Forfait +2 500 F.',
    feeLabel: '+2 500 F',
  },
  {
    id: 'handoff_gp',
    icon: 'airplane',
    label: 'Remise GP diaspora',
    hint: 'Remise à un GP / convoyeur. Forfait +5 000 F.',
    feeLabel: '+5 000 F',
  },
];

export const MarketCheckoutScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId as string;
  const { token, user } = useAuth();
  const { format, currency, setCurrency, isEur, xofPerEur, fxMarginPercent } = useMarketCurrency();

  const [product, setProduct] = useState<any>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('bagup_courier');
  const [recipientName, setRecipientName] = useState(
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
  );
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [recipientRelation, setRecipientRelation] = useState('');
  const [address, setAddress] = useState(user?.address || '');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [selected, setSelected] = useState('orange_money');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);

  const isHandoff = deliveryMode === 'handoff_tiers' || deliveryMode === 'handoff_gp';

  useEffect(() => {
    api.marketplace.getProduct(productId).then(setProduct).catch(console.error);
  }, [productId]);

  const selectMode = (mode: DeliveryMode) => {
    setDeliveryMode(mode);
    setQuote(null);
    if (mode === 'handoff_tiers' || mode === 'handoff_gp') {
      setRecipientName('');
      setRecipientPhone('');
      setRecipientRelation('');
      setAddress('');
      setDeliveryCoords(null);
    } else {
      setRecipientName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
      setRecipientPhone(user?.phone || '');
      setRecipientRelation('');
    }
  };

  const resolveCoords = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setDeliveryCoords(null);
      return null;
    }
    const local = searchLocations(trimmed)[0];
    if (local) {
      const coords = { lat: local.lat, lng: local.lng };
      setDeliveryCoords(coords);
      return coords;
    }
    const geo = await geocodeAddress(trimmed);
    if (geo[0]) {
      const coords = { lat: geo[0].lat, lng: geo[0].lng };
      setDeliveryCoords(coords);
      return coords;
    }
    setDeliveryCoords(null);
    return null;
  }, []);

  const refreshQuote = useCallback(async () => {
    if (!token) {
      setQuote(null);
      return;
    }
    if (!address.trim()) {
      setQuote(null);
      return;
    }
    setQuoting(true);
    try {
      const coords = deliveryCoords || (await resolveCoords(address));
      if (!coords) {
        setQuote(null);
        Alert.alert(
          'Adresse',
          'Choisissez une adresse au Sénégal reconnue (quartier, ville).',
        );
        return;
      }
      const q = await api.marketplace.quote(
        {
          productId,
          deliveryMode,
          deliveryAddress: address.trim(),
          deliveryCountry: 'SN',
          deliveryLat: coords.lat,
          deliveryLng: coords.lng,
          quantity: 1,
          deliverToSelf: !isHandoff,
        },
        token,
      );
      setQuote(q);
    } catch (e: any) {
      setQuote(null);
      Alert.alert('Devis', e?.message || 'Impossible de calculer la livraison');
    } finally {
      setQuoting(false);
    }
  }, [
    token,
    address,
    productId,
    deliveryCoords,
    resolveCoords,
    deliveryMode,
    isHandoff,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (address.trim().length >= 5) {
        void resolveCoords(address).then(() => refreshQuote());
      } else {
        setQuote(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [address, deliveryMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    if (!token) return;
    if (!recipientName.trim()) {
      Alert.alert('Destinataire', 'Indiquez le nom de la personne qui reçoit le colis');
      return;
    }
    if (!recipientPhone.trim()) {
      Alert.alert('Destinataire', 'Indiquez le numéro de téléphone du destinataire');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Adresse', 'Indiquez l’adresse au Sénégal');
      return;
    }
    if (isHandoff && !recipientRelation.trim()) {
      Alert.alert(
        'Destinataire',
        deliveryMode === 'handoff_gp'
          ? 'Précisez le lien / référence GP'
          : 'Précisez votre lien avec le destinataire (famille, ami…)',
      );
      return;
    }
    const coords = deliveryCoords || (await resolveCoords(address));
    if (!coords) {
      Alert.alert('Adresse', 'Impossible de localiser cette adresse au Sénégal');
      return;
    }
    if (!quote) {
      await refreshQuote();
      return;
    }
    if ((selected === 'orange_money' || selected === 'wave') && !phoneNumber.trim()) {
      Alert.alert('Téléphone', 'Numéro Mobile Money requis');
      return;
    }
    setLoading(true);
    try {
      const order: any = await api.marketplace.createOrder(
        {
          productId,
          deliveryMode,
          deliveryAddress: address.trim(),
          deliveryCountry: 'SN',
          deliveryLat: coords.lat,
          deliveryLng: coords.lng,
          quantity: 1,
          deliverToSelf: !isHandoff,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientRelation: isHandoff ? recipientRelation.trim() : undefined,
        },
        token,
      );
      const result = await api.marketplace.payOrder(order.id, { method: selected }, token);
      const outcome = await handleCheckout(result);

      const finalize = async () => {
        const msg =
          deliveryMode === 'handoff_gp'
            ? 'Remise GP diaspora. Un livreur Bag’up acheminera le colis vers le GP.'
            : deliveryMode === 'handoff_tiers'
              ? 'Un livreur Bag’up remettra le colis au destinataire au Sénégal.'
              : 'Un livreur Bag’up collectera puis livrera votre commande.';
        Alert.alert('Commande confirmée', msg, [
          { text: 'OK', onPress: () => navigation.navigate('MarketOrders') },
        ]);
      };

      if (outcome === 'success') {
        await finalize();
      } else if (outcome === 'awaiting' && result.paymentId) {
        const status = await pollStatus(async () => {
          const p: any = await api.payments.byId(result.paymentId!, token);
          return (p?.status || 'pending') as 'pending' | 'processing' | 'success' | 'failed';
        });
        if (status === 'success') await finalize();
        else Alert.alert('Paiement', 'En attente de confirmation. Vérifiez plus tard.');
      } else if (outcome === 'failed') {
        Alert.alert('Paiement', 'Le paiement a échoué');
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Commande impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 8) : 0}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Paiement</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]} keyboardShouldPersistTaps="handled">
          <View style={styles.productRow}>
            {resolveMediaUrl(product?.photoUrls?.[0]) ? (
              <ExpoImage
                source={{ uri: resolveMediaUrl(product?.photoUrls?.[0])! }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.thumb, { backgroundColor: Colors.primarySoft }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.pname}>{product?.name}</Text>
              <Text style={styles.pshop}>{product?.shop?.name}</Text>
            </View>
          </View>

          <Text style={styles.label}>Mode de remise</Text>
          <View style={styles.modeGrid}>
            {DELIVERY_MODES.map((m) => {
              const on = deliveryMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeCard, on && styles.modeCardOn]}
                  onPress={() => selectMode(m.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={m.icon} size={18} color={on ? Colors.primary : Colors.gray400} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{m.label}</Text>
                    <Text style={styles.modeFee}>{m.feeLabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.whoHint}>
            {DELIVERY_MODES.find((m) => m.id === deliveryMode)?.hint}
          </Text>

          <Text style={styles.label}>Nom du destinataire</Text>
          <TextInput
            style={styles.input}
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Prénom et nom"
            placeholderTextColor={Colors.gray400}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Téléphone du destinataire</Text>
          <TextInput
            style={styles.input}
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            placeholder="+221 77 …"
            placeholderTextColor={Colors.gray400}
            keyboardType="phone-pad"
          />

          {isHandoff ? (
            <>
              <Text style={styles.label}>
                {deliveryMode === 'handoff_gp' ? 'Référence GP / lien' : 'Lien avec le destinataire'}
              </Text>
              <TextInput
                style={styles.input}
                value={recipientRelation}
                onChangeText={setRecipientRelation}
                placeholder={deliveryMode === 'handoff_gp' ? 'Ex. GP Dakar–Paris, cousin…' : 'Famille, ami…'}
                placeholderTextColor={Colors.gray400}
              />
            </>
          ) : null}

          <Text style={styles.label}>Adresse au Sénégal</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={address}
            onChangeText={(t) => {
              setAddress(t);
              setDeliveryCoords(null);
            }}
            placeholder="Ex. Almadies, Dakar — Plateau, Thiès…"
            placeholderTextColor={Colors.gray400}
            multiline
          />
          {deliveryCoords ? (
            <Text style={styles.gpsOk}>Position GPS prête</Text>
          ) : (
            address.trim().length >= 5 && <Text style={styles.gpsWait}>Localisation en cours…</Text>
          )}

          <View style={styles.summary}>
            <View style={styles.summaryHead}>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>
              <CurrencySwitch currency={currency} onChange={setCurrency} />
            </View>
            <Text style={styles.fxHint}>
              Prix produit + frais livraison · ≈ 1 € = {Math.round(xofPerEur).toLocaleString('fr-FR')} F
              {fxMarginPercent != null ? ` (marge change ${fxMarginPercent} %)` : ''}
            </Text>
            {quoting && <Text style={styles.muted}>Calcul…</Text>}
            {quote && (
              <>
                <View style={styles.line}>
                  <Text style={styles.lineL}>Produit</Text>
                  <View style={styles.lineRCol}>
                    <Text style={styles.lineR}>{format(Number(quote.productTotalXof))}</Text>
                    {isEur ? (
                      <Text style={styles.eur}>{Number(quote.productTotalXof).toLocaleString('fr-FR')} FCFA</Text>
                    ) : (
                      <Text style={styles.eur}>≈ {Number(quote.productEur).toFixed(2)} €</Text>
                    )}
                  </View>
                </View>
                <View style={styles.line}>
                  <Text style={styles.lineL}>
                    Frais livraison ({quote.deliveryModeLabel || 'livraison'})
                  </Text>
                  <View style={styles.lineRCol}>
                    <Text style={styles.lineR}>{format(Number(quote.deliveryFeeXof))}</Text>
                    {isEur ? (
                      <Text style={styles.eur}>{Number(quote.deliveryFeeXof).toLocaleString('fr-FR')} FCFA</Text>
                    ) : (
                      <Text style={styles.eur}>≈ {Number(quote.deliveryEur).toFixed(2)} €</Text>
                    )}
                  </View>
                </View>
                <View style={[styles.line, styles.totalLine]}>
                  <Text style={styles.totalL}>Total</Text>
                  <View style={styles.lineRCol}>
                    <Text style={styles.totalR}>{format(Number(quote.totalXof))}</Text>
                    {isEur ? (
                      <Text style={styles.eur}>{Number(quote.totalXof).toLocaleString('fr-FR')} FCFA</Text>
                    ) : (
                      <Text style={styles.eur}>≈ {Number(quote.totalEur).toFixed(2)} €</Text>
                    )}
                  </View>
                </View>
              </>
            )}
            {!quote && !quoting && (
              <Text style={styles.muted}>Saisissez une adresse au Sénégal pour voir le total.</Text>
            )}
          </View>

          <View style={styles.trust}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
            <Text style={styles.trustText}>Paiement sécurisé · Colis préparé sous 48 h · Livraison Bag'up</Text>
          </View>

          <Text style={styles.label}>Paiement</Text>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.method, selected === m.id && styles.methodOn]}
              onPress={() => setSelected(m.id)}
            >
              {m.logo ? (
                <Image source={m.logo} style={styles.logo} resizeMode="contain" />
              ) : (
                <Ionicons name="card-outline" size={22} color={Colors.primary} />
              )}
              <Text style={styles.methodLabel}>{m.label}</Text>
              <View style={[styles.radio, selected === m.id && styles.radioOn]}>
                {selected === m.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}

          {(selected === 'orange_money' || selected === 'wave') && (
            <>
              <Text style={styles.label}>Numéro Mobile Money</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.gray400}
              />
            </>
          )}

          <View style={{ marginTop: Spacing.xl }}>
            <Button
              title={quote ? `Payer ${format(Number(quote.totalXof))}` : 'Calculer puis payer'}
              onPress={pay}
              loading={loading || quoting}
              fullWidth
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  content: { padding: Spacing.base, paddingBottom: 48 },
  productRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  pname: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  pshop: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray500, marginTop: 4 },
  whoRow: { flexDirection: 'row', gap: Spacing.sm },
  whoCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.gray200,
  },
  whoCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  whoLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 14, color: Colors.gray500 },
  whoLabelOn: { color: Colors.primary },
  whoHint: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500,
    marginTop: 8, lineHeight: 17,
  },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  modeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  modeCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  modeLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 12,
    color: Colors.gray500,
  },
  modeLabelOn: { color: Colors.primary },
  modeFee: {
    marginTop: 2,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 11,
    color: Colors.gray400,
  },
  fxHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 11,
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },
  lineRCol: { alignItems: 'flex-end' },
  label: {
    fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray600,
    marginBottom: 6, marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: 12,
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 15, color: Colors.gray900,
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  gpsOk: {
    fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: Colors.success, marginTop: 6,
  },
  gpsWait: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginTop: 6,
  },
  summary: {
    marginTop: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.gray100,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md, gap: 8 },
  summaryTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900 },
  line: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineL: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, color: Colors.gray600 },
  lineR: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 14, color: Colors.gray900 },
  totalLine: {
    borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 10, marginTop: 4, marginBottom: 0,
  },
  totalL: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 16, color: Colors.gray900 },
  totalR: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 18, color: Colors.primaryDark },
  eur: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray500, marginTop: 2 },
  muted: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, color: Colors.gray500 },
  trust: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md,
    paddingHorizontal: 4,
  },
  trustText: {
    flex: 1, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, color: Colors.gray600, lineHeight: 17,
  },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base,
    borderWidth: 1.5, borderColor: Colors.gray200, marginBottom: Spacing.sm,
  },
  methodOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  logo: { width: 36, height: 36 },
  methodLabel: { flex: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: 15, color: Colors.gray900 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
});
