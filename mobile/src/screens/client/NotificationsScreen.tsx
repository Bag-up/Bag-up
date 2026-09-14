import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { parsePushData } from '../../services/notifications';

interface Props {
  onBack: () => void;
  navigation?: any;
}

const typeIcons: Record<string, { icon: string; color: string }> = {
  new_mission: { icon: 'cube', color: Colors.info },
  mission_accepted: { icon: 'checkmark-circle', color: Colors.success },
  status_update: { icon: 'cube', color: Colors.primary },
  new_message: { icon: 'chatbubble', color: Colors.info },
  payment_success: { icon: 'card', color: Colors.success },
  payment_failed: { icon: 'close-circle', color: Colors.accent },
  subscription_expiring: { icon: 'time', color: Colors.warning },
  dispute_update: { icon: 'alert-circle', color: Colors.accent },
  rating_reminder: { icon: 'star', color: Colors.warning },
  general: { icon: 'notifications', color: Colors.gray500 },
  loyalty: { icon: 'trophy', color: Colors.warning },
  new_ride: { icon: 'car', color: Colors.primary },
  ride_offer: { icon: 'timer', color: Colors.warning },
  ride_assigned: { icon: 'navigate', color: Colors.success },
};

function parseStoredData(raw: unknown) {
  if (!raw) return {};
  if (typeof raw === 'object') return parsePushData(raw);
  if (typeof raw === 'string') {
    try {
      return parsePushData(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return {};
}

export const NotificationsScreen: React.FC<Props> = ({ onBack, navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.notifications.mine(token);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchNotifications error:', e);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }, [fetchNotifications]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!token) return;
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await api.notifications.markAllRead(token);
    } catch (e) {
      console.error('markAllRead error:', e);
      setNotifications(previous);
    }
  };

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.notifications.markRead(id, token);
    } catch (e) {
      console.error('markRead error:', e);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)));
    }
  };

  const openNotification = async (item: any) => {
    if (!item.isRead) {
      await handleMarkRead(item.id);
    }
    const payload = parseStoredData(item.data);
    if (!navigation) return;

    if (payload.rideId || payload.type === 'new_ride' || payload.type === 'ride_offer' || payload.type === 'ride_assigned') {
      if (user?.role === 'provider') {
        navigation.navigate('ProviderMain', {
          screen: payload.type === 'ride_offer' || payload.type === 'new_ride' || !payload.type
            ? 'PDashboard'
            : 'PMissions',
          params: payload.rideId ? { focusRideId: payload.rideId } : undefined,
        });
      } else if (payload.rideId) {
        navigation.navigate('RideRequest', { rideId: payload.rideId });
      }
      return;
    }
    if (payload.type === 'new_mission' && user?.role === 'provider') {
      navigation.navigate('ProviderMain', {
        screen: 'PDashboard',
        params: payload.missionId ? { focusMissionId: payload.missionId } : undefined,
      });
      return;
    }
    if (payload.missionId) {
      navigation.navigate('Tracking', { missionId: payload.missionId });
      return;
    }
    if (payload.orderId) {
      navigation.navigate('MarketOrderDetail', { orderId: payload.orderId });
      return;
    }
    if (payload.type === 'loyalty') {
      navigation.navigate('Loyalty');
      return;
    }
    if (payload.reservationId || payload.type === 'antigaspi') {
      if (user?.role === 'merchant') {
        navigation.navigate('MerchantMain', { screen: 'MReservations' });
      } else {
        navigation.navigate('AntiGaspiReservations');
      }
      return;
    }
    if (payload.type === 'marketplace_order' || payload.type === 'marketplace_payout') {
      navigation.navigate('MarketOrders');
      return;
    }
    if (payload.type === 'new_message') {
      navigation.navigate('Messages');
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderItem = ({ item }: { item: any }) => {
    const cfg = typeIcons[item.type] || typeIcons.general;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
        activeOpacity={0.8}
        onPress={() => openNotification(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: withAlpha(cfg.color as any, 0.12) }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color as any} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.sm, 56) }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.8}>
            <Text style={styles.markAllBtn}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Math.max(insets.bottom + 96, 112) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={32} color={Colors.gray300} />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySub}>Vos notifications apparaîtront ici</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  markAllBtn: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  badgeRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  badge: { alignSelf: 'flex-start', backgroundColor: withAlpha(Colors.primary, 0.1), paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  badgeText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.primary },
  notifCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginTop: Spacing.sm, ...Shadows.sm },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  notifIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle: { flex: 1, fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.sm },
  notifBody: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500, marginTop: 4 },
  notifTime: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray300, marginTop: 6 },
  emptyState: { alignItems: 'center', paddingTop: Spacing['3xl'] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  emptyTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray400 },
  emptySub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray300, marginTop: 4 },
});
