import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../services/api';

const STATUS: Record<
  string,
  { label: string; bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  paid: { label: 'À remettre', bg: Colors.warningSoft, text: Colors.warning, icon: 'bag-handle' },
  merchant_confirmed: {
    label: 'Vous avez confirmé',
    bg: Colors.infoSoft,
    text: Colors.info,
    icon: 'checkmark-circle',
  },
  client_confirmed: {
    label: 'Client a confirmé',
    bg: Colors.primarySoft,
    text: Colors.primary,
    icon: 'person',
  },
  completed: {
    label: 'Terminé · reversé',
    bg: Colors.successSoft,
    text: Colors.success,
    icon: 'checkmark-done',
  },
};

export const MerchantReservationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.antiGaspi.merchantReservations(token);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openDetail = (id: string) => {
    navigation.getParent()?.navigate('MerchantReservationDetail', { reservationId: id });
  };

  const confirm = async (id: string) => {
    if (!token) return;
    setConfirming(id);
    try {
      const updated = await api.antiGaspi.confirmMerchant(id, token);
      await load();
      if (updated?.status === 'completed') {
        Alert.alert('Terminé', 'Panier remis et reversement créé.', [
          { text: 'Voir revenus', onPress: () => navigation.navigate('MPayouts') },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert(
          'Confirmé',
          'Remise enregistrée. Le reversement apparaîtra quand le client confirmera aussi.',
        );
      }
    } catch (e: any) {
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Confirmation impossible');
    } finally {
      setConfirming(null);
    }
  };

  const actionable = items.filter(
    (i) => ['paid', 'client_confirmed'].includes(i.status) && !i.merchantConfirmedAt,
  ).length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>Retraits</Text>
        <Text style={styles.headerSub}>
          {actionable > 0
            ? `${actionable} remise${actionable > 1 ? 's' : ''} à confirmer`
            : 'Confirmez la remise au client'}
        </Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun retrait</Text>
              <Text style={styles.emptyText}>
                Quand un client paie un panier, la remise s’affiche ici.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUS[item.status] || STATUS.paid;
            const canConfirm =
              ['paid', 'client_confirmed'].includes(item.status) && !item.merchantConfirmedAt;
            const clientName = [item.client?.firstName, item.client?.lastName]
              .filter(Boolean)
              .join(' ');

            return (
              <TouchableOpacity
                style={[styles.card, Shadows.sm]}
                activeOpacity={0.88}
                onPress={() => openDetail(item.id)}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={22} color={st.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.basket?.title || 'Panier'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.pillText, { color: st.text }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.amount}>
                      {Number(item.merchantAmount).toLocaleString()} F
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
                  </View>
                </View>

                <View style={styles.clientRow}>
                  <Ionicons name="person-outline" size={14} color={Colors.gray500} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {clientName || 'Client'}
                    {item.client?.phone ? ` · ${item.client.phone}` : ''}
                  </Text>
                </View>

                {canConfirm && (
                  <View style={styles.actions}>
                    <Button
                      title="Confirmer la remise"
                      onPress={() => confirm(item.id)}
                      loading={confirming === item.id}
                      fullWidth
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  headerSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
    marginTop: 4,
  },
  list: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginBottom: 6,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
  },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  amount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  meta: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  actions: { marginTop: Spacing.base },
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  emptyText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
