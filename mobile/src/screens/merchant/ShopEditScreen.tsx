import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { SHOP_CATEGORIES } from '../../constants/marketplace';
import { normalizeSocialInput } from '../../utils/socialLinks';

export const ShopEditScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();
  const [existing, setExisting] = useState(false);
  const [name, setName] = useState(user?.businessName || '');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Dakar');
  const [category, setCategory] = useState('artisanat');
  const [phone, setPhone] = useState(user?.phone || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.marketplace
        .myShop(token)
        .then((s: any) => {
          setExisting(true);
          setName(s.name || '');
          setDescription(s.description || '');
          setCity(s.city || 'Dakar');
          setCategory(s.category || 'artisanat');
          setPhone(s.phone || '');
          setWhatsapp(s.whatsapp || '');
          setInstagram(s.instagram || '');
          setFacebook(s.facebook || '');
          setTiktok(s.tiktok || '');
          setLogoUrl(s.logoUrl || null);
          setCoverUrl(s.coverUrl || null);
        })
        .catch((e) => {
          if (!(e instanceof ApiError && e.statusCode === 404)) console.error(e);
        });
    }, [token]),
  );

  const pickImage = async (target: 'logo' | 'cover') => {
    if (!token) return;
    const uri = await pickImageFromLibrary({
      allowsEditing: true,
      aspect: target === 'logo' ? [1, 1] : [16, 9],
      quality: 0.7,
    });
    if (!uri) return;
    setUploading(true);
    try {
      const res = await api.uploads.upload(
        { uri, type: 'image/jpeg', name: `shop-${target}-${Date.now()}.jpg` },
        token,
      );
      if (target === 'logo') setLogoUrl(res.url);
      else setCoverUrl(res.url);
    } catch {
      Alert.alert('Erreur', 'Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!token) return;
    if (!name.trim() || !description.trim() || !phone.trim()) {
      Alert.alert('Champs requis', 'Nom, description et téléphone sont obligatoires');
      return;
    }
    if (description.trim().length > 150) {
      Alert.alert('Description', 'Maximum 150 caractères');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        city: city.trim() || 'Dakar',
        category,
        phone: phone.trim(),
        whatsapp: normalizeSocialInput(whatsapp) ?? (existing ? null : undefined),
        instagram: normalizeSocialInput(instagram) ?? (existing ? null : undefined),
        facebook: normalizeSocialInput(facebook) ?? (existing ? null : undefined),
        tiktok: normalizeSocialInput(tiktok) ?? (existing ? null : undefined),
        logoUrl: logoUrl || undefined,
        coverUrl: coverUrl || undefined,
      };
      if (existing) {
        await api.marketplace.updateShop(payload, token);
        Alert.alert('OK', 'Boutique mise à jour', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await api.marketplace.createShop(payload, token);
        Alert.alert(
          'Boutique créée',
          'Prochaine étape : activez l’abonnement (6 500 FCFA/mois) pour être visible sur la Marketplace.',
          [
            { text: 'Plus tard', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Activer l’abonnement',
              onPress: () => navigation.replace('ShopSubscription'),
            },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Échec enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{existing ? 'Modifier la boutique' : 'Créer la boutique'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.coverBox} onPress={() => pickImage('cover')} disabled={uploading}>
            {resolveMediaUrl(coverUrl) || coverUrl ? (
              <ExpoImage
                source={{ uri: resolveMediaUrl(coverUrl) || coverUrl! }}
                style={styles.coverImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={styles.imgHint}>Photo de couverture</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoBox} onPress={() => pickImage('logo')} disabled={uploading}>
            {resolveMediaUrl(logoUrl) || logoUrl ? (
              <ExpoImage
                source={{ uri: resolveMediaUrl(logoUrl) || logoUrl! }}
                style={styles.logoImg}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons name="camera" size={22} color={Colors.primary} />
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Nom de la boutique</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex. Atelier Wax Dakar" placeholderTextColor={Colors.gray400} />

          <Text style={styles.label}>Description ({description.length}/150)</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 150))}
            placeholder="Présentez votre boutique"
            placeholderTextColor={Colors.gray400}
            multiline
          />

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.chips}>
            {SHOP_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, category === c.id && styles.chipOn]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Ville</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Dakar" placeholderTextColor={Colors.gray400} />

          <Text style={styles.label}>Téléphone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.gray400} />

          <Text style={styles.label}>WhatsApp (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            placeholder="+221 77 …"
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.sectionLabel}>Réseaux sociaux (optionnel)</Text>
          <Text style={styles.hint}>@pseudo ou lien complet</Text>

          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            placeholder="@maboutique"
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>Facebook</Text>
          <TextInput
            style={styles.input}
            value={facebook}
            onChangeText={setFacebook}
            autoCapitalize="none"
            placeholder="Page ou @compte"
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>TikTok</Text>
          <TextInput
            style={[styles.input, styles.lastInput]}
            value={tiktok}
            onChangeText={setTiktok}
            autoCapitalize="none"
            placeholder="@maboutique"
            placeholderTextColor={Colors.gray400}
          />

          <View style={styles.submitWrap}>
            <Button title={existing ? 'Enregistrer' : 'Créer la boutique'} onPress={save} loading={loading || uploading} fullWidth />
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
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200,
  },
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  content: { padding: Spacing.base, paddingBottom: 48 },
  coverBox: {
    height: 140, borderRadius: BorderRadius.lg, backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  imgHint: { fontFamily: Typography.fontFamily.dmSans.medium, color: Colors.primary },
  logoBox: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: Colors.white,
    marginTop: -36, marginLeft: Spacing.base, borderWidth: 2, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...({ elevation: 2 } as any),
  },
  logoImg: { width: '100%', height: '100%' },
  label: {
    fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray600,
    marginTop: Spacing.base, marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900,
    marginTop: Spacing.lg,
  },
  hint: {
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray400,
    marginTop: 4, marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: 12,
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 15, color: Colors.gray900,
  },
  lastInput: { marginBottom: Spacing.lg },
  submitWrap: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  area: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
  },
  chipOn: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray600 },
  chipTextOn: { color: Colors.primary },
});
