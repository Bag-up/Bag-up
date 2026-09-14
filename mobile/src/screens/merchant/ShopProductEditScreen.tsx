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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { MAX_PRODUCT_PHOTOS, MIN_PRODUCT_PHOTOS } from '../../constants/marketplace';

export const ShopProductEditScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId as string | undefined;
  const { token } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [stock, setStock] = useState('1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token || !productId) return;
      api.marketplace
        .getProduct(productId)
        .then((p: any) => {
          setName(p.name || '');
          setDescription(p.description || '');
          setPrice(String(p.priceXof ?? ''));
          setWeight(String(p.weightKg ?? ''));
          setStock(String(p.stock ?? 0));
          setPhotos(Array.isArray(p.photoUrls) ? p.photoUrls : []);
          setStatus(p.status || 'draft');
        })
        .catch(console.error);
    }, [token, productId]),
  );

  const addPhoto = async () => {
    if (!token) return;
    if (photos.length >= MAX_PRODUCT_PHOTOS) {
      Alert.alert('Limite', `Maximum ${MAX_PRODUCT_PHOTOS} photos`);
      return;
    }
    const uri = await pickImageFromLibrary({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!uri) return;
    setUploading(true);
    try {
      const res = await api.uploads.upload(
        { uri, type: 'image/jpeg', name: `product-${Date.now()}.jpg` },
        token,
      );
      setPhotos((prev) => [...prev, res.url]);
    } catch {
      Alert.alert('Erreur', 'Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => setPhotos((prev) => prev.filter((u) => u !== url));

  const save = async (andPublish = false) => {
    if (!token) return;
    if (!name.trim() || !description.trim() || !price || !weight) {
      Alert.alert('Champs requis', 'Nom, description, prix et poids sont obligatoires');
      return;
    }
    if (description.trim().length > 300) {
      Alert.alert('Description', 'Maximum 300 caractères');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        priceXof: Number(price),
        weightKg: Number(weight),
        stock: Number(stock) || 0,
        photoUrls: photos,
      };
      let id = productId;
      if (id) {
        await api.marketplace.updateProduct(id, payload, token);
      } else {
        const created: any = await api.marketplace.createProduct(payload, token);
        id = created.id;
      }
      if (andPublish && id) {
        await api.marketplace.publishProduct(id, token);
        Alert.alert('Publié', 'Produit visible sur le catalogue', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Enregistré', 'Brouillon sauvegardé', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : e?.message || 'Échec';
      Alert.alert('Erreur', typeof msg === 'string' ? msg : 'Échec');
    } finally {
      setLoading(false);
    }
  };

  const archive = async () => {
    if (!token || !productId) return;
    Alert.alert('Archiver', 'Retirer ce produit du catalogue ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.marketplace.archiveProduct(productId, token);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Échec');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{productId ? 'Produit' : 'Nouveau produit'}</Text>
          {productId ? (
            <TouchableOpacity onPress={archive} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={Colors.accent} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 112) }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            {MIN_PRODUCT_PHOTOS} photos min. pour publier · {photos.length}/{MAX_PRODUCT_PHOTOS}
            {status === 'available' ? ' · Publié' : ''}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
            {photos.map((url) => (
              <View key={url} style={styles.photoWrap}>
                <ExpoImage
                  source={{ uri: resolveMediaUrl(url) || url }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <TouchableOpacity style={styles.photoDel} onPress={() => removePhoto(url)}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PRODUCT_PHOTOS && (
              <TouchableOpacity style={styles.photoAdd} onPress={addPhoto} disabled={uploading}>
                <Ionicons name="add" size={28} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>

          <Text style={styles.label}>Nom</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={Colors.gray400} />

          <Text style={styles.label}>Description ({description.length}/300)</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 300))}
            multiline
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>Prix (FCFA)</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={Colors.gray400} />
          <Text style={styles.feeHint}>
            Prix produit uniquement. Au checkout : +2 500 F (livraison SN) ou +5 000 F (GP diaspora), perçus par Bag’up.
          </Text>

          <Text style={styles.label}>Poids estimé (kg)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholderTextColor={Colors.gray400} />

          <Text style={styles.label}>Stock</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholderTextColor={Colors.gray400} />

          <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
            <Button title="Enregistrer brouillon" onPress={() => save(false)} loading={loading || uploading} variant="outline" fullWidth />
            <Button
              title={
                photos.length < MIN_PRODUCT_PHOTOS
                  ? `Publier (encore ${MIN_PRODUCT_PHOTOS - photos.length} photo(s))`
                  : 'Publier'
              }
              onPress={() => {
                if (photos.length < MIN_PRODUCT_PHOTOS) {
                  Alert.alert('Photos', `Ajoutez au moins ${MIN_PRODUCT_PHOTOS} photos pour publier`);
                  return;
                }
                save(true);
              }}
              loading={loading || uploading}
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
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200,
  },
  topTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 16, color: Colors.gray900 },
  content: { padding: Spacing.base, paddingBottom: 48 },
  hint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginBottom: Spacing.md },
  feeHint: {
    marginTop: 6,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 12,
    color: Colors.gray500,
    lineHeight: 18,
  },
  photos: { marginBottom: Spacing.md },
  photoWrap: { marginRight: 10, position: 'relative' },
  photo: { width: 88, height: 88, borderRadius: 12 },
  photoDel: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 88, height: 88, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primarySoft,
  },
  label: {
    fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13, color: Colors.gray600,
    marginTop: Spacing.md, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.base, paddingVertical: 12,
    fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 15, color: Colors.gray900,
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
});
