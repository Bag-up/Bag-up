import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';

interface Props {
  onBack: () => void;
  onPublished?: () => void;
}

function defaultPickupWindow() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(Date.now() + 48 * 60 * 60 * 1000);
  if (end.getTime() <= start.getTime() + 60 * 60 * 1000) {
    end.setTime(start.getTime() + 60 * 60 * 1000);
  }
  return { start, end };
}

export const MerchantPublishBasketScreen: React.FC<Props> = ({ onBack, onPublished }) => {
  const insets = useSafeAreaInsets();
  const { token, user, refreshUser } = useAuth();
  const window = defaultPickupWindow();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [pickupAddress, setPickupAddress] = useState(user?.businessAddress || user?.address || '');
  const [contactName, setContactName] = useState(user?.businessName || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const maxActive = 3;

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.antiGaspi
        .merchantBaskets(token)
        .then((list) => {
          const active = (Array.isArray(list) ? list : []).filter((b: any) =>
            ['available', 'reserved'].includes(b.status),
          ).length;
          setActiveCount(active);
        })
        .catch(() => {});
      refreshUser()
        .then((me) => {
          if (!me) return;
          setPickupAddress((prev) => prev || me.businessAddress || me.address || '');
          setContactName((prev) => prev || me.businessName || '');
        })
        .catch(() => {});
    }, [token, refreshUser]),
  );

  const addPhoto = async () => {
    if (!token) return;
    const uri = await pickImageFromLibrary({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
    });
    if (!uri) return;
    setUploading(true);
    try {
      const res = await api.uploads.upload(
        { uri, type: 'image/jpeg', name: `antigaspi-${Date.now()}.jpg` },
        token,
      );
      setPhotoUrl(res.url);
    } catch {
      Alert.alert('Erreur', 'Impossible d’envoyer la photo');
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    if (!token) return;
    if (activeCount >= maxActive) {
      Alert.alert(
        'Limite atteinte',
        `Maximum ${maxActive} articles actifs. Retirez-en un pour en publier un autre.`,
      );
      return;
    }
    const amount = Number(price);
    if (!title.trim()) {
      Alert.alert('Titre requis');
      return;
    }
    if (!photoUrl) {
      Alert.alert('Photo requise', 'Ajoutez une photo du panier / des produits.');
      return;
    }
    if (!amount || amount < 100) {
      Alert.alert('Prix', 'Minimum 100 FCFA');
      return;
    }
    if (!pickupAddress.trim()) {
      Alert.alert('Adresse de retrait requise');
      return;
    }
    if (!contactName.trim()) {
      Alert.alert('Nom du commerce', 'Indiquez le nom affiché au client.');
      return;
    }
    if (!user?.phone) {
      Alert.alert('Contact', 'Aucun téléphone sur le compte. Mettez à jour votre profil.');
      return;
    }

    const { start, end } = defaultPickupWindow();
    setLoading(true);
    try {
      const profilePatch: Record<string, string> = {};
      if (contactName.trim() !== (user?.businessName || '')) {
        profilePatch.businessName = contactName.trim();
      }
      if (pickupAddress.trim() !== (user?.businessAddress || user?.address || '')) {
        profilePatch.businessAddress = pickupAddress.trim();
      }
      if (Object.keys(profilePatch).length) {
        await api.users.updateMe(profilePatch, token).catch(() => null);
        await refreshUser().catch(() => null);
      }

      await api.antiGaspi.createBasket(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          photoUrl,
          price: amount,
          pickupAddress: pickupAddress.trim(),
          pickupStartAt: start.toISOString(),
          pickupEndAt: end.toISOString(),
        },
        token,
      );
      Alert.alert('Publié', 'Votre panier est en ligne.', [
        {
          text: 'OK',
          onPress: () => {
            if (onPublished) onPublished();
            else onBack();
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Publication impossible');
    } finally {
      setLoading(false);
    }
  };

  const commissionHint = (() => {
    const amount = Number(price);
    if (!amount || amount < 100) return null;
    const commission = Math.round(amount * 0.15);
    return { commission, net: amount - commission };
  })();

  const atLimit = activeCount >= maxActive;
  const slots = Array.from({ length: maxActive }, (_, i) => i < activeCount);
  const previewPhoto = photoUrl ? resolveMediaUrl(photoUrl) : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, Spacing['2xl']) }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Nouveau panier</Text>
            <Text style={styles.headerSub}>Surplus Anti-Gaspi</Text>
          </View>
          <View style={styles.headerLeaf}>
            <Ionicons name="leaf" size={18} color={Colors.secondary} />
          </View>
        </View>

        <View style={[styles.quotaCard, atLimit && styles.quotaWarn]}>
          <View style={styles.quotaTop}>
            <Text style={[styles.quotaLabel, atLimit && styles.quotaWarnText]}>
              Articles actifs
            </Text>
            <Text style={[styles.quotaCount, atLimit && styles.quotaWarnText]}>
              {activeCount}/{maxActive}
            </Text>
          </View>
          <View style={styles.slots}>
            {slots.map((filled, i) => (
              <View
                key={i}
                style={[styles.slot, filled && styles.slotFilled, atLimit && filled && styles.slotWarn]}
              />
            ))}
          </View>
          {atLimit ? (
            <Text style={styles.quotaHintWarn}>Retirez un panier pour en publier un autre</Text>
          ) : null}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Photo du panier *</Text>
          <TouchableOpacity
            style={styles.photoBox}
            onPress={addPhoto}
            disabled={atLimit || uploading}
            activeOpacity={0.85}
          >
            {previewPhoto ? (
              <Image source={{ uri: previewPhoto }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={Colors.gray400} />
                <Text style={styles.photoHint}>
                  {uploading ? 'Envoi…' : 'Ajouter une photo des produits'}
                </Text>
              </View>
            )}
            {previewPhoto ? (
              <View style={styles.photoBadge}>
                <Ionicons name="camera" size={14} color={Colors.white} />
                <Text style={styles.photoBadgeText}>Changer</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Panier boulangerie du soir"
            placeholderTextColor={Colors.gray400}
            value={title}
            onChangeText={setTitle}
            editable={!atLimit}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Contenu approximatif (optionnel)"
            placeholderTextColor={Colors.gray400}
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!atLimit}
          />

          <Text style={styles.label}>Prix client (FCFA)</Text>
          <TextInput
            style={styles.input}
            placeholder="2500"
            placeholderTextColor={Colors.gray400}
            keyboardType="number-pad"
            value={price}
            onChangeText={setPrice}
            editable={!atLimit}
          />

          {commissionHint && (
            <View style={styles.commissionCard}>
              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Commission Bag’up (15 %)</Text>
                <Text style={styles.commissionValue}>
                  −{commissionHint.commission.toLocaleString()} F
                </Text>
              </View>
              <View style={styles.commissionDivider} />
              <View style={styles.commissionRow}>
                <Text style={styles.netLabel}>Vous recevez</Text>
                <Text style={styles.netValue}>{commissionHint.net.toLocaleString()} F</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Contact & retrait</Text>
          <Text style={styles.sectionHint}>
            Ces infos sont affichées au client pour venir récupérer le panier.
          </Text>

          <Text style={styles.label}>Nom du commerce</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Boulangerie Almadies"
            placeholderTextColor={Colors.gray400}
            value={contactName}
            onChangeText={setContactName}
            editable={!atLimit}
          />

          <Text style={styles.label}>Téléphone de contact</Text>
          <View style={styles.phoneCard}>
            <Ionicons name="call-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.phoneValue}>{user?.phone || 'Non renseigné'}</Text>
              <Text style={styles.fieldHint}>
                Numéro du compte — visible par le client. Modifiable dans Profil.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Adresse de retrait</Text>
          <TextInput
            style={styles.input}
            placeholder="Adresse du commerce"
            placeholderTextColor={Colors.gray400}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            editable={!atLimit}
          />

          <View style={styles.windowCard}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.windowTitle}>Créneau de retrait</Text>
              <Text style={styles.windowText}>
                {window.start.toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                –{' '}
                {window.end.toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                (validité 48 h)
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
          <Button
            title={atLimit ? 'Limite de 3 atteinte' : 'Publier le panier'}
            onPress={publish}
            loading={loading || uploading}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.white,
  },
  headerSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
    marginTop: 2,
  },
  headerLeaf: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: withAlpha(Colors.white, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaCard: {
    backgroundColor: withAlpha(Colors.white, 0.18),
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: withAlpha(Colors.white, 0.25),
  },
  quotaWarn: {
    backgroundColor: withAlpha(Colors.accent, 0.25),
    borderColor: withAlpha(Colors.white, 0.3),
  },
  quotaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quotaLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  quotaCount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  quotaWarnText: { color: Colors.white },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(Colors.white, 0.25),
  },
  slotFilled: { backgroundColor: Colors.secondary },
  slotWarn: { backgroundColor: Colors.white },
  quotaHintWarn: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  content: { padding: Spacing.base, paddingBottom: 120 },
  label: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    marginTop: Spacing.xl,
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  sectionHint: {
    marginTop: 4,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    lineHeight: 18,
  },
  fieldHint: {
    marginTop: 4,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  photoBox: {
    height: 180,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderStyle: 'dashed',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  photoHint: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  photoBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(Colors.gray900, 0.72),
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
  },
  photoBadgeText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  phoneValue: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.gray900,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray200,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.base,
    color: Colors.gray900,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  commissionCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
  },
  commissionValue: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
  },
  commissionDivider: {
    height: 1,
    backgroundColor: withAlpha(Colors.primary, 0.15),
    marginVertical: Spacing.sm,
  },
  netLabel: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  netValue: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  windowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  windowTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  windowText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  footer: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
});
