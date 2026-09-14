import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Image, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://admin.bagup.app/api';

interface Props {
  onBack: () => void;
  conversationId?: string;
  name?: string;
}

export const ChatScreen: React.FC<Props> = ({ onBack, conversationId, name }) => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [headerName, setHeaderName] = useState(name || '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !token) return;
    try {
      const data = await api.messages.conversation(conversationId, token);
      const msgs = data?.messages || (Array.isArray(data) ? data : []);
      setMessages(msgs);

      if (data?.client && data?.provider && user?.id) {
        const other = data.clientId === user.id ? data.provider : data.client;
        const resolved = [other?.firstName, other?.lastName].filter(Boolean).join(' ').trim()
          || other?.firstName
          || other?.phone
          || name
          || 'Conversation';
        setHeaderName(resolved);
      }

      await api.messages.markRead(conversationId, token).catch(() => {});
    } catch (e) {
      console.error('ChatScreen fetch error:', e);
    }
  }, [conversationId, token, user?.id, name]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    const kbShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      clearInterval(interval);
      kbShow.remove();
    };
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || !token) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: `temp-${Date.now()}`, content: text, senderId: user?.id, createdAt: new Date().toISOString() }]);
    try {
      await api.messages.send({ conversationId, content: text }, token);
      fetchMessages();
    } catch (e) {
      console.error('Send error:', e);
    }
  };

  const handleSendPhoto = async () => {
    if (!conversationId || !token) return;
    const uri = await pickImageFromLibrary({ allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!uri) return;

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, content: '', imageUrl: uri, senderId: user?.id, createdAt: new Date().toISOString() }]);
    try {
      const uploadRes = await api.uploads.upload({ uri, type: 'image/jpeg', name: `chat-${Date.now()}.jpg` }, token);
      await api.messages.send({ conversationId, content: '📷 Photo', imageUrl: uploadRes.url }, token);
      fetchMessages();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Envoi de photo échoué');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleSendLocation = async () => {
    if (!conversationId || !token) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission', 'Autorisez l\'accès à la localisation'); return; }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setMessages(prev => [...prev, { id: `temp-${Date.now()}`, content: '📍 Position partagée', locationLat: latitude, locationLng: longitude, senderId: user?.id, createdAt: new Date().toISOString() }]);
      await api.messages.send({ conversationId, content: '📍 Position partagée', locationLat: latitude, locationLng: longitude }, token);
      fetchMessages();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Partage de position échoué');
    }
  };

  const openLocation = (lat: number, lng: number) => {
    const url = Platform.OS === 'ios' ? `maps://app?daddr=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleDeleteMessage = (msgId: string, isMe: boolean) => {
    if (!isMe || !token || msgId.startsWith('temp-')) return;
    Alert.alert(
      'Supprimer le message',
      'Voulez-vous vraiment supprimer ce message ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.messages.delete(msgId, token);
              setMessages(prev => prev.filter(m => m.id !== msgId));
            } catch (e: any) {
              Alert.alert('Erreur', e.message || 'Impossible de supprimer le message');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(headerName || 'U')[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.headerName} numberOfLines={1}>{headerName || 'Conversation'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={Colors.gray300} />
            <Text style={styles.emptyText}>Aucun message</Text>
            <Text style={styles.emptySub}>Démarrez la conversation</Text>
          </View>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderId === user?.id;
          const prevSame = i > 0 && messages[i - 1].senderId === msg.senderId;
          const hasImage = msg.imageUrl || (msg.image_url);
          const hasLocation = msg.locationLat || msg.location_lat;
          const imgUrl = msg.imageUrl || msg.image_url;
          const lat = msg.locationLat || msg.location_lat;
          const lng = msg.locationLng || msg.location_lng;
          return (
            <View key={msg.id || i} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem, prevSame && { marginTop: 2 }]}>
              <TouchableOpacity
                onLongPress={() => handleDeleteMessage(msg.id, isMe)}
                delayLongPress={500}
                activeOpacity={0.8}
              >
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  {hasImage && imgUrl && (
                    <TouchableOpacity onPress={() => {}} activeOpacity={0.9}>
                      <Image source={{ uri: imgUrl.startsWith('http') ? imgUrl : `${API_URL.replace('/api', '')}${imgUrl}` }} style={styles.msgImage} />
                    </TouchableOpacity>
                  )}
                  {hasLocation && lat && lng && (
                    <TouchableOpacity style={styles.locationCard} onPress={() => openLocation(lat, lng)} activeOpacity={0.8}>
                      <Ionicons name="location" size={20} color={isMe ? Colors.white : Colors.primary} />
                      <Text style={[styles.locationText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>Voir la position</Text>
                      <Ionicons name="open-outline" size={14} color={isMe ? Colors.white : Colors.primary} />
                    </TouchableOpacity>
                  )}
                  {msg.content && !hasLocation && (
                    <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>{msg.content}</Text>
                  )}
                  {hasLocation && msg.content && (
                    <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem, { marginTop: 4 }]}>{msg.content}</Text>
                  )}
                </View>
              </TouchableOpacity>
              {!prevSame && <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>{formatTime(msg.createdAt)}</Text>}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSendPhoto} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={22} color={Colors.gray500} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSendLocation} activeOpacity={0.7}>
          <Ionicons name="location-outline" size={22} color={Colors.gray500} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Écrivez un message..."
          placeholderTextColor={Colors.gray400}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!input.trim()} activeOpacity={0.8}>
          <Ionicons name="send" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
      </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.sm, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.md, color: Colors.white },
  headerName: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900, flex: 1 },
  messages: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray400, marginTop: Spacing.md },
  emptySub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray300, marginTop: 4 },
  msgRow: { marginBottom: Spacing.sm, maxWidth: '75%' },
  msgRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.white, borderBottomLeftRadius: 4, ...Shadows.xs },
  bubbleText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md },
  bubbleTextMe: { color: Colors.white },
  bubbleTextThem: { color: Colors.gray900 },
  msgTime: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 10, marginTop: 2, marginHorizontal: 4 },
  msgTimeMe: { color: Colors.gray400 },
  msgTimeThem: { color: Colors.gray300 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray100, gap: Spacing.sm },
  input: { flex: 1, minHeight: 48, maxHeight: 100, backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.gray300 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  msgImage: { width: 200, height: 150, borderRadius: BorderRadius.md, marginBottom: Spacing.xs },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs },
  locationText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm },
});
