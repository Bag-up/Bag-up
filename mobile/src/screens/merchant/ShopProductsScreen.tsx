import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError, resolveMediaUrl } from '../../services/api';

export const ShopProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.marketplace.myProducts(token);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 404) {
        Alert.alert('Boutique', 'Créez d’abord votre boutique', [
          { text: 'OK', onPress: () => navigation.navigate('ShopEdit') },
        ]);
      } else console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [token, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const statusLabel = (s: string) => {
    switch (s) {
      case 'available': return 'Publié';
      case 'draft': return 'Brouillon';
      case 'out_of_stock': return 'Rupture';
      default: return s;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Mes produits</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ShopProductEdit', {})} hitSlop={12}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={40} color={Colors.gray300} />
            <Text style={styles.emptyText}>Aucun produit</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('ShopProductEdit', {})}>
              <Text style={styles.emptyBtnText}>Ajouter un produit</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ShopProductEdit', { productId: item.id })}
            activeOpacity={0.85}
          >
            {resolveMediaUrl(item.photoUrls?.[0]) ? (
              <ExpoImage
                source={{ uri: resolveMediaUrl(item.photoUrls?.[0])! }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Ionicons name="image-outline" size={20} color={Colors.gray400} />
              </View>
            )}
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowSub}>
                {Number(item.priceXof).toLocaleString()} F · {item.photoUrls?.length || 0} photo(s)
              </Text>
              <Text style={styles.badge}>{statusLabel(item.status)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      />
    </View>
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
  list: { padding: Spacing.base, paddingBottom: 40, gap: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray200, marginBottom: Spacing.sm,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbEmpty: { backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: 15, color: Colors.gray900 },
  rowSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 12, color: Colors.gray500, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start', marginTop: 6, fontSize: 11,
    fontFamily: Typography.fontFamily.dmSans.medium, color: Colors.primary,
    backgroundColor: Colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.medium, color: Colors.gray500 },
  emptyBtn: {
    marginTop: 8, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md,
  },
  emptyBtnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, color: Colors.white },
});
