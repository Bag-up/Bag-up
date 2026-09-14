import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Switch,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { merchantChannelsLabel } from '../../constants/merchantChannels';
import { useAuth } from '../../context/AuthContext';
import { api, resolveMediaUrl } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { DeleteAccountButton } from '../../components/DeleteAccountButton';
import { SUPPORT_HELP_MESSAGE } from '../../constants/support';

interface Props {
  onLogout: () => void;
}

export const MerchantProfileScreen: React.FC<Props> = ({ onLogout }) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user, token, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editBusinessName, setEditBusinessName] = useState(user?.businessName || '');
  const [editBusinessAddress, setEditBusinessAddress] = useState(user?.businessAddress || '');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditEmail(user?.email || '');
    setEditBusinessName(user?.businessName || '');
    setEditBusinessAddress(user?.businessAddress || user?.address || '');
    setEditAvatarUri(null);
    setEditing(true);
  };

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditing(false);
    setEditAvatarUri(null);
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, p, r] = await Promise.all([
        api.antiGaspi.merchantStats(token),
        api.antiGaspi.merchantPayouts(token),
        api.antiGaspi.merchantReservations(token),
      ]);
      setStats(s);
      setPayouts(Array.isArray(p) ? p : []);
      const reservations = Array.isArray(r) ? r : [];
      setPending(
        reservations.filter((x: any) =>
          ['paid', 'merchant_confirmed', 'client_confirmed'].includes(x.status),
        ),
      );
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

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: () => {
          logout();
          onLogout();
        },
      },
    ]);
  };

  const handlePickAvatar = async () => {
    const uri = await pickImageFromLibrary({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (uri) setEditAvatarUri(uri);
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;
      if (editAvatarUri) {
        const uploadRes = await api.uploads.upload(
          { uri: editAvatarUri, type: 'image/jpeg', name: `avatar-${Date.now()}.jpg` },
          token,
        );
        avatarUrl = uploadRes.url;
      }
      await api.users.updateMe(
        {
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim() || undefined,
          businessName: editBusinessName.trim() || undefined,
          businessAddress: editBusinessAddress.trim() || undefined,
          avatarUrl,
        },
        token,
      );
      await refreshUser?.();
      Alert.alert('Succès', 'Profil mis à jour');
      setEditing(false);
      setEditAvatarUri(null);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Mise à jour échouée');
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    user?.businessName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    'Commerçant';
  const initial = (displayName[0] || 'C').toUpperCase();

  const settings = [
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      toggle: true as const,
      value: notifEnabled,
      onToggle: () => setNotifEnabled(!notifEnabled),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Vérification',
      value: user?.isVerified ? 'Vérifié' : 'En attente',
      onPress: () =>
        Alert.alert(
          'Vérification',
          user?.isVerified
            ? 'Votre compte commerçant est vérifié.'
            : "Votre compte est en attente de validation par l'administrateur.",
        ),
    },
    {
      icon: 'language-outline' as const,
      label: 'Langue',
      value: 'Français',
      onPress: () =>
        Alert.alert('Langue', 'Le français est actuellement la seule langue disponible.'),
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Aide & support',
      onPress: () =>
        Alert.alert(
          'Aide & support',
          SUPPORT_HELP_MESSAGE,
        ),
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={18} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {resolveMediaUrl(user?.avatarUrl) ? (
            <Image source={{ uri: resolveMediaUrl(user?.avatarUrl)! }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <View style={styles.rolePill}>
          <Ionicons name="storefront" size={12} color={Colors.primary} />
          <Text style={styles.roleText}>Commerçant · {merchantChannelsLabel(user?.merchantChannels)}</Text>
        </View>
        {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
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
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={Colors.primary} />
        ) : (
          <>
            <View style={[styles.statsCard, Shadows.sm]}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats?.basketsSold ?? 0}</Text>
                <Text style={styles.statLabel}>Vendus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {Number(stats?.revenueReceived || 0).toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>FCFA reçus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pending.length}</Text>
                <Text style={styles.statLabel}>En cours</Text>
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Ventes en cours</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MReservations')}>
                <Text style={styles.link}>Retraits</Text>
              </TouchableOpacity>
            </View>
            {pending.length === 0 ? (
              <View style={[styles.emptyCard, Shadows.sm]}>
                <Ionicons name="leaf-outline" size={22} color={Colors.gray400} />
                <Text style={styles.emptyCardText}>Aucune vente en attente</Text>
              </View>
            ) : (
              pending.slice(0, 4).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.rowCard, Shadows.sm]}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.getParent()?.navigate('MerchantReservationDetail', {
                      reservationId: item.id,
                    })
                  }
                >
                  <View style={[styles.rowIcon, { backgroundColor: Colors.warningSoft }]}>
                    <Ionicons name="time" size={18} color={Colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.basket?.title || 'Panier'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {item.status === 'paid'
                        ? 'Payé — à remettre'
                        : item.status === 'merchant_confirmed'
                          ? 'En attente client'
                          : 'Finalisation'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
                </TouchableOpacity>
              ))
            )}

            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionTitle}>Reversements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MPayouts')}>
                <Text style={styles.link}>Tout voir</Text>
              </TouchableOpacity>
            </View>
            {payouts.length === 0 ? (
              <View style={[styles.emptyCard, Shadows.sm]}>
                <Ionicons name="wallet-outline" size={22} color={Colors.gray400} />
                <Text style={styles.emptyCardText}>Aucun reversement encore</Text>
              </View>
            ) : (
              payouts.slice(0, 3).map((item) => (
                <View key={item.id} style={[styles.rowCard, Shadows.sm]}>
                  <View style={[styles.rowIcon, { backgroundColor: Colors.successSoft }]}>
                    <Ionicons name="cash-outline" size={18} color={Colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.reservation?.basket?.title || 'Panier'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {item.status === 'success' ? 'Versé' : item.status}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: Colors.success }]}>
                    +{Number(item.amount).toLocaleString()} F
                  </Text>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: Spacing.lg, marginBottom: Spacing.md }]}>
              Paramètres
            </Text>
            {settings.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.settingCard, Shadows.sm]}
                activeOpacity={0.85}
                disabled={!!s.toggle}
                onPress={s.onPress}
              >
                <View style={styles.settingIconWrap}>
                  <Ionicons name={s.icon} size={18} color={Colors.gray600} />
                </View>
                <Text style={styles.settingLabel}>{s.label}</Text>
                {s.toggle ? (
                  <Switch
                    value={s.value}
                    onValueChange={s.onToggle}
                    trackColor={{ false: Colors.gray200, true: withAlpha(Colors.primary, 0.3) }}
                    thumbColor={s.value ? Colors.primary : Colors.gray400}
                  />
                ) : (
                  <>
                    {s.value ? <Text style={styles.settingValue}>{s.value}</Text> : null}
                    <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
                  </>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
        <DeleteAccountButton onDeleted={onLogout} />
        <Text style={styles.version}>Bag’up Commerçant v1.0.17</Text>
      </ScrollView>

      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.editOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEdit} />
          <KeyboardAvoidingView
            style={styles.editKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <View
              style={[
                styles.editSheet,
                {
                  maxHeight: Math.min(windowHeight * 0.92, windowHeight - insets.top - 24),
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Modifier mon profil</Text>
                <TouchableOpacity onPress={closeEdit} hitSlop={12}>
                  <Ionicons name="close" size={22} color={Colors.gray400} />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces
                contentContainerStyle={styles.editScrollContent}
              >
                <View style={styles.avatarPickerContainer}>
                  <TouchableOpacity
                    style={styles.avatarPicker}
                    onPress={handlePickAvatar}
                    activeOpacity={0.8}
                  >
                    {editAvatarUri ? (
                      <Image source={{ uri: editAvatarUri }} style={styles.avatarPickerImage} />
                    ) : resolveMediaUrl(user?.avatarUrl) ? (
                      <Image source={{ uri: resolveMediaUrl(user?.avatarUrl)! }} style={styles.avatarPickerImage} />
                    ) : (
                      <View style={styles.avatarPickerPlaceholder}>
                        <Ionicons name="storefront" size={32} color={Colors.gray400} />
                      </View>
                    )}
                    <View style={styles.avatarPickerBadge}>
                      <Ionicons name="camera" size={14} color={Colors.white} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.avatarPickerHint}>Appuyez pour changer la photo</Text>
                </View>

                <Text style={styles.editLabel}>Nom du commerce</Text>
                <TextInput
                  style={styles.editInput}
                  value={editBusinessName}
                  onChangeText={setEditBusinessName}
                  placeholder="Ex: Boulangerie du coin"
                  placeholderTextColor={Colors.gray300}
                />
                <Text style={styles.editLabel}>Prénom</Text>
                <TextInput
                  style={styles.editInput}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="Prénom"
                  placeholderTextColor={Colors.gray300}
                />
                <Text style={styles.editLabel}>Nom</Text>
                <TextInput
                  style={styles.editInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Nom"
                  placeholderTextColor={Colors.gray300}
                />
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Email"
                  placeholderTextColor={Colors.gray300}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.editLabel}>Adresse du commerce</Text>
                <TextInput
                  style={styles.editInput}
                  value={editBusinessAddress}
                  onChangeText={setEditBusinessAddress}
                  placeholder="Adresse de retrait"
                  placeholderTextColor={Colors.gray300}
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]}
                onPress={handleSaveProfile}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.editSaveText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  editBtn: {
    position: 'absolute',
    top: Spacing['3xl'],
    right: Spacing.base,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(Colors.white, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: withAlpha(Colors.white, 0.25),
    borderWidth: 3,
    borderColor: withAlpha(Colors.white, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  avatarImage: { width: 76, height: 76, borderRadius: 28 },
  avatarText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
  },
  name: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.white,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  roleText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  phone: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: withAlpha(Colors.white, 0.85),
    marginTop: Spacing.sm,
  },
  scroll: { flex: 1 },
  scrollInner: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    marginTop: -Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  statLabel: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  statDivider: { width: 1, backgroundColor: Colors.gray100 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  link: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
  },
  emptyCardText: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  rowMeta: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  rowAmount: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  settingValue: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
    marginRight: Spacing.sm,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.accentSoft,
  },
  logoutText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
  },
  version: {
    textAlign: 'center',
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: Spacing.lg,
  },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editKeyboard: { width: '100%', justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    minHeight: 280,
  },
  editScrollContent: { paddingBottom: Spacing.md, flexGrow: 1 },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  editLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    backgroundColor: Colors.gray50,
    minHeight: 48,
  },
  editSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveText: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  avatarPickerContainer: { alignItems: 'center', marginBottom: Spacing.md },
  avatarPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarPickerImage: { width: 90, height: 90, borderRadius: 45 },
  avatarPickerPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarPickerHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: Spacing.sm,
  },
});
