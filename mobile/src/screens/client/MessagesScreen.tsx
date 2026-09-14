import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface Props {
  navigation?: any;
}

export const MessagesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.messages.conversations(token);
      setConversations(data);
    } catch (e) {
      console.error('fetchConversations error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations]),
  );

  const getOtherUser = (conv: any) => {
    if (conv.clientId === user?.id) return conv.provider;
    if (conv.providerId === user?.id) return conv.client;
    return null;
  };

  const getOtherUserName = (conv: any) => {
    const other = getOtherUser(conv);
    if (!other) return 'Utilisateur';
    const full = [other.firstName, other.lastName].filter(Boolean).join(' ').trim();
    return full || other.firstName || other.phone || 'Utilisateur';
  };

  const getLastMessage = (conv: any) => conv.messages?.[0]?.content || conv.lastMessage || 'Démarrez la conversation';

  const getLastMessageAt = (conv: any) => conv.messages?.[0]?.createdAt || conv.lastMessageAt || conv.updatedAt || conv.createdAt;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j`;
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(diff / (1000 * 60));
    return mins > 0 ? `${mins}min` : 'maintenant';
  };

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.convItem}
      activeOpacity={0.7}
      onPress={() => navigation?.navigate('Chat', { conversationId: item.id, name: getOtherUserName(item) })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {getOtherUserName(item).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{getOtherUserName(item)}</Text>
          <Text style={styles.convTime}>{formatTime(getLastMessageAt(item))}</Text>
        </View>
        <Text style={styles.convPreview} numberOfLines={1}>
          {getLastMessage(item)}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 50) }]}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>{conversations.length} conversation{conversations.length > 1 ? 's' : ''}</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.gray300} />
          </View>
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySub}>
            Vos messages avec les prestataires apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 96, 112) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 2,
  },
  list: {
    paddingVertical: Spacing.sm,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.primary,
  },
  convInfo: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  convName: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.gray900,
  },
  convTime: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
  },
  convPreview: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  unreadBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  unreadText: {
    fontFamily: Typography.fontFamily.dmSans.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginLeft: 72,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
    textAlign: 'center',
  },
});
