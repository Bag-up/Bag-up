import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, TextInput, Modal, Keyboard, KeyboardAvoidingView, Platform, Image, ActivityIndicator, useWindowDimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../constants/theme';
import { tierUi } from '../constants/loyalty';
import { useAuth } from '../context/AuthContext';
import { api, resolveMediaUrl } from '../services/api';
import { pickImageFromLibrary } from '../services/pickImage';
import { DeleteAccountButton } from '../components/DeleteAccountButton';
import { SUPPORT_HELP_MESSAGE } from '../constants/support';

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  en_route: 'En route',
  picked_up: 'Récupérée',
  in_progress: 'En cours',
  delivered: 'Terminée',
  cancelled: 'Annulée',
  dossier_deposed: 'Dossier déposé',
  admin_processing: 'En attente admin',
  document_ready: 'Document prêt',
  document_collected: 'Document retiré',
  returned_to_client: 'Restitué',
};

interface Props { onLogout: () => void; navigation?: any; }

export const ProfileScreen: React.FC<Props> = ({ onLogout, navigation }) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user, token, logout, refreshUser } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editAddress, setEditAddress] = useState(user?.address || '');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const avatarUri = resolveMediaUrl(user?.avatarUrl);

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditing(false);
    setEditAvatarUri(null);
  };

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUri]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [m, p, l] = await Promise.all([
        api.missions.mine(token),
        api.payments.mine(token),
        api.loyalty.me(token).catch(() => null),
      ]);
      setMissions(m);
      setPayments(p);
      setLoyalty(l);
    } catch (e) {
      console.error('ProfileScreen fetch error:', e);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => { logout(); onLogout(); } },
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
      
      // Upload nouvel avatar si sélectionné
      if (editAvatarUri) {
        setUploadingAvatar(true);
        const uploadRes = await api.uploads.upload(
          { uri: editAvatarUri, type: 'image/jpeg', name: `avatar-${Date.now()}.jpg` },
          token
        );
        avatarUrl = uploadRes.url;
        setUploadingAvatar(false);
      }

      await api.users.updateMe({
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        address: editAddress,
        avatarUrl,
      }, token);
      await refreshUser?.();
      Alert.alert('Succès', 'Profil mis à jour');
      setEditing(false);
      setEditAvatarUri(null);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Mise à jour échouée');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const completedMissions = missions.filter(m => ['delivered', 'returned_to_client'].includes(m.status)).length;
  const totalSpent = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.amount), 0);

  const settings = [
    { icon: 'notifications-outline' as const, label: 'Notifications', value: '', onPress: () => navigation?.navigate('Notifications') },
    { icon: 'card-outline' as const, label: 'Historique des paiements', value: '', onPress: () => navigation?.navigate('Payments') },
    { icon: 'language-outline' as const, label: 'Langue', value: 'Français', onPress: () => Alert.alert('Langue', 'Le français est actuellement la seule langue disponible.') },
    { icon: 'help-circle-outline' as const, label: 'Aide & support', value: '', onPress: () => Alert.alert('Aide & support', SUPPORT_HELP_MESSAGE) },
  ];

  return (
    <View style={styles.container}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <LinearGradient colors={Colors.gradientPrimary} style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 56) }]}>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={18} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {avatarUri && !avatarFailed ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatarImage}
              resizeMode="cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <Ionicons name="person" size={36} color={Colors.white} />
          )}
        </View>
        <Text style={styles.userName}>{user?.firstName || 'Utilisateur'}</Text>
        <Text style={styles.userPhone}>{user?.phone || ''}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name={user?.role === 'provider' ? 'bicycle' : 'person'} size={12} color={Colors.white} />
          <Text style={styles.roleText}>{user?.role === 'provider' ? 'Prestataire' : 'Client'}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.statsCard, Shadows.sm]}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.primary, 0.12) }]}>
            <Ionicons name="cube-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.statValue}>{missions.length}</Text>
          <Text style={styles.statLabel}>Missions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.success, 0.12) }]}>
            <Ionicons name="checkmark-done-outline" size={18} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{completedMissions}</Text>
          <Text style={styles.statLabel}>Terminées</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: withAlpha(Colors.warning, 0.12) }]}>
            <Ionicons name="wallet-outline" size={18} color={Colors.warning} />
          </View>
          <Text style={styles.statValue}>{totalSpent.toLocaleString()}</Text>
          <Text style={styles.statLabel}>FCFA</Text>
        </View>
      </View>

      {user?.role === 'client' && (
        <TouchableOpacity
          style={[styles.loyaltyCard, Shadows.sm]}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate('Loyalty')}
        >
          <View style={[styles.loyaltyIcon, { backgroundColor: withAlpha(tierUi(loyalty?.currentTier?.key).color, 0.16) }]}>
            <Ionicons name={tierUi(loyalty?.currentTier?.key).icon as any} size={20} color={tierUi(loyalty?.currentTier?.key).color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loyaltyTitle}>
              Fidélité · {loyalty?.currentTier?.name || 'Ivoire'}
            </Text>
            <Text style={styles.loyaltySub}>
              {loyalty?.nextTier
                ? `Encore ${loyalty.remainingToNext} pour ${loyalty.nextTier.name}`
                : 'Niveau Gold — avantages chaque mois'}
            </Text>
            {!!loyalty?.nextTier && (
              <View style={styles.loyaltyTrack}>
                <View style={[styles.loyaltyFill, { width: `${loyalty.progressPercent || 0}%`, backgroundColor: tierUi(loyalty?.currentTier?.key).color }]} />
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes paiements</Text>
        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={28} color={Colors.gray300} /></View>
            <Text style={styles.emptyText}>Aucun paiement</Text>
          </View>
        ) : (
          payments.slice(0, 5).map((p) => (
            <View key={p.id} style={[styles.paymentCard, Shadows.sm]}>
              <View style={[styles.paymentIcon, p.status === 'success' ? styles.paymentIconSuccess : styles.paymentIconPending]}>
                <Ionicons name={p.status === 'success' ? 'checkmark' : 'time'} size={16} color={p.status === 'success' ? Colors.success : Colors.gray400} />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentAmount}>{Number(p.amount).toLocaleString()} FCFA</Text>
                <Text style={styles.paymentMethod}>{p.method}</Text>
              </View>
              <View style={[styles.paymentStatus, p.status === 'success' ? styles.statusSuccess : styles.statusPending]}>
                <Text style={styles.paymentStatusText}>{p.status === 'success' ? 'Réussi' : p.status === 'failed' ? 'Échoué' : 'En cours'}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres</Text>
        {settings.map((s, i) => (
          <TouchableOpacity key={i} style={[styles.settingCard, Shadows.sm]} activeOpacity={0.85} onPress={s.onPress}>
            <View style={styles.settingIconWrap}><Ionicons name={s.icon} size={18} color={Colors.gray600} /></View>
            <Text style={styles.settingLabel}>{s.label}</Text>
            {s.value ? <Text style={styles.settingValue}>{s.value}</Text> : null}
            <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <DeleteAccountButton onDeleted={onLogout} />

      <Text style={styles.version}>Bag'up v1.0.17</Text>
      </ScrollView>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={closeEdit}>
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
                  <View style={styles.avatarPickerWrap}>
                    <TouchableOpacity style={styles.avatarPicker} onPress={handlePickAvatar} activeOpacity={0.8}>
                      {editAvatarUri ? (
                        <Image source={{ uri: editAvatarUri }} style={styles.avatarPickerImage} resizeMode="cover" />
                      ) : avatarUri && !avatarFailed ? (
                        <Image
                          source={{ uri: avatarUri }}
                          style={styles.avatarPickerImage}
                          resizeMode="cover"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        <View style={styles.avatarPickerPlaceholder}>
                          <Ionicons name="person" size={36} color={Colors.gray400} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.avatarPickerBadge} onPress={handlePickAvatar} activeOpacity={0.85}>
                      <Ionicons name="camera" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.avatarPickerHint}>Appuyez pour changer la photo</Text>
                </View>

                <Text style={styles.editLabel}>Prénom</Text>
                <TextInput style={styles.editInput} value={editFirstName} onChangeText={setEditFirstName} placeholder="Prénom" placeholderTextColor={Colors.gray300} returnKeyType="next" />
                <Text style={styles.editLabel}>Nom</Text>
                <TextInput style={styles.editInput} value={editLastName} onChangeText={setEditLastName} placeholder="Nom" placeholderTextColor={Colors.gray300} returnKeyType="next" />
                <Text style={styles.editLabel}>Email</Text>
                <TextInput style={styles.editInput} value={editEmail} onChangeText={setEditEmail} placeholder="Email" placeholderTextColor={Colors.gray300} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
                <Text style={styles.editLabel}>Adresse</Text>
                <TextInput style={styles.editInput} value={editAddress} onChangeText={setEditAddress} placeholder="Adresse" placeholderTextColor={Colors.gray300} returnKeyType="done" />
              </ScrollView>

              <TouchableOpacity style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]} onPress={handleSaveProfile} activeOpacity={0.85} disabled={saving}>
                {saving || uploadingAvatar ? (
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
  header: { paddingTop: 60, paddingBottom: Spacing['2xl'], alignItems: 'center', borderBottomLeftRadius: BorderRadius['3xl'], borderBottomRightRadius: BorderRadius['3xl'] },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  avatarText: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['2xl'], color: Colors.white },
  userName: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.xl, color: Colors.white },
  roleBadge: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  roleText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white, marginLeft: 4 },
  statsCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: -Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, paddingVertical: Spacing.base },
  loyaltyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  loyaltyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  loyaltySub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  loyaltyTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gray100,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  loyaltyFill: { height: '100%', borderRadius: 3 },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.gray100 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.xl, color: Colors.gray900 },
  statLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 4 },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray400 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  paymentIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  paymentIconSuccess: { backgroundColor: withAlpha(Colors.success, 0.12) },
  paymentIconPending: { backgroundColor: Colors.gray100 },
  paymentInfo: { flex: 1 },
  paymentAmount: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  paymentMethod: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 2 },
  paymentStatus: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  statusSuccess: { backgroundColor: withAlpha(Colors.success, 0.12) },
  statusPending: { backgroundColor: Colors.gray100 },
  paymentStatusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray700 },
  settingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  settingIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  settingLabel: { flex: 1, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  settingValue: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginRight: Spacing.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.xl, backgroundColor: withAlpha(Colors.accent, 0.1), borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, gap: 8 },
  logoutText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.accent },
  version: { textAlign: 'center', fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: Spacing.lg, marginBottom: Spacing['3xl'] },
  editBtn: { position: 'absolute', top: 60, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  userPhone: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.8, marginTop: 2 },
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
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  editTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  editLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginBottom: 4, marginTop: Spacing.sm },
  editInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900, backgroundColor: Colors.gray50, minHeight: 48 },
  editSaveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveText: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarPickerContainer: { alignItems: 'center', marginBottom: Spacing.md },
  avatarPickerWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  avatarPicker: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarPickerImage: { width: 90, height: 90, borderRadius: 45 },
  avatarPickerPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  avatarPickerBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white, zIndex: 2, elevation: 3 },
  avatarPickerHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: Spacing.sm },
});
