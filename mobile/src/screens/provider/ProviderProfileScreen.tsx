import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Switch, Image, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api, resolveMediaUrl } from '../../services/api';
import { pickImageFromLibrary } from '../../services/pickImage';
import { DeleteAccountButton } from '../../components/DeleteAccountButton';
import { SUPPORT_HELP_MESSAGE } from '../../constants/support';
import { VEHICLE_COLORS, isPlausiblePlate, vehicleModeLabel } from '../../constants/vehicle';

interface Props { onLogout: () => void; }

export const ProviderProfileScreen: React.FC<Props> = ({ onLogout }) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user, token, logout, online, setOnline, refreshUser } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [editVehicleType, setEditVehicleType] = useState<'moto' | 'voiture' | 'velo'>(
    (user?.vehicle?.type || user?.vehicleType || 'moto') as 'moto' | 'voiture' | 'velo',
  );
  const [editPlate, setEditPlate] = useState(user?.vehicle?.plate || '');
  const [editBrand, setEditBrand] = useState(user?.vehicle?.brand || '');
  const [editModel, setEditModel] = useState(user?.vehicle?.model || '');
  const [editColor, setEditColor] = useState(user?.vehicle?.color || 'Blanc');
  const [saving, setSaving] = useState(false);

  const closeEdit = () => {
    Keyboard.dismiss();
    setEditing(false);
    setEditAvatarUri(null);
  };

  const fetchMissions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.missions.provider(token);
      setMissions(data);
    } catch (e) {
      console.error('ProviderProfile fetch error:', e);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMissions();
    }, [fetchMissions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMissions();
    setRefreshing(false);
  }, [fetchMissions]);

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
    if (!editAvatarUri && !user?.avatarUrl) {
      Alert.alert('Erreur', 'Ajoutez votre photo de profil (obligatoire pour le client)');
      return;
    }
    if (editVehicleType !== 'velo') {
      if (!editPlate.trim() || !isPlausiblePlate(editPlate)) {
        Alert.alert('Erreur', 'Indiquez une plaque d\'immatriculation valide');
        return;
      }
      if (!editBrand.trim() || !editModel.trim()) {
        Alert.alert('Erreur', 'Renseignez marque et modèle');
        return;
      }
      if (!editColor.trim()) {
        Alert.alert('Erreur', 'Choisissez la couleur du véhicule');
        return;
      }
    }
    setSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;
      if (editAvatarUri) {
        const uploadRes = await api.uploads.upload(
          { uri: editAvatarUri, type: 'image/jpeg', name: `avatar-${Date.now()}.jpg` },
          token
        );
        avatarUrl = uploadRes.url;
      }
      await api.users.updateMe({
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        avatarUrl,
        vehicleType: editVehicleType,
        vehiclePlate: editVehicleType !== 'velo' ? editPlate.trim().toUpperCase() : null,
        vehicleBrand: editVehicleType !== 'velo' ? editBrand.trim() : null,
        vehicleModel: editVehicleType !== 'velo' ? editModel.trim() : null,
        vehicleColor: editVehicleType !== 'velo' ? editColor : null,
      }, token);
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

  const deliveredCount = missions.filter(m => m.status === 'delivered').length;
  const activeCount = missions.filter(m => ['accepted', 'en_route', 'picked_up', 'in_progress'].includes(m.status)).length;
  const totalEarnings = missions.filter(m => m.status === 'delivered').reduce((sum, m) => sum + Number(m.price || 0), 0);
  const completionRate = missions.length > 0 ? Math.round((deliveredCount / missions.length) * 100) : 0;

  const settings = [
    { icon: 'notifications-outline' as const, label: 'Notifications', toggle: true, value: notifEnabled, onToggle: () => setNotifEnabled(!notifEnabled) },
    { icon: 'location-outline' as const, label: 'Partage de position', toggle: true, value: online, onToggle: () => setOnline(!online) },
    { icon: 'language-outline' as const, label: 'Langue', value: 'Français', onPress: () => Alert.alert('Langue', 'Le français est actuellement la seule langue disponible.') },
    { icon: 'shield-checkmark-outline' as const, label: 'Vérification', value: user?.isVerified ? 'Vérifié' : 'En attente', onPress: () => Alert.alert('Vérification', user?.isVerified ? 'Votre compte est vérifié.' : 'Votre compte est en attente de validation par l\'administrateur.') },
    { icon: 'help-circle-outline' as const, label: 'Aide & support', onPress: () => Alert.alert('Aide & support', SUPPORT_HELP_MESSAGE) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 112) }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <LinearGradient colors={Colors.gradientPrimary} style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 56) }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={styles.editBtn} onPress={() => {
          setEditFirstName(user?.firstName || '');
          setEditLastName(user?.lastName || '');
          setEditEmail(user?.email || '');
          setEditVehicleType((user?.vehicle?.type || user?.vehicleType || 'moto') as 'moto' | 'voiture' | 'velo');
          setEditPlate(user?.vehicle?.plate || '');
          setEditBrand(user?.vehicle?.brand || '');
          setEditModel(user?.vehicle?.model || '');
          setEditColor(user?.vehicle?.color || 'Blanc');
          setEditing(true);
        }} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={18} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {resolveMediaUrl(user?.avatarUrl) ? (
            <Image source={{ uri: resolveMediaUrl(user?.avatarUrl)! }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{(user?.firstName || 'L')[0]?.toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.userName}>{user?.firstName || 'Livreur'}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.white} />
          <Text style={styles.roleText}>Livreur partenaire</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, online ? styles.statusDotOnline : styles.statusDotOffline]} />
          <Text style={styles.statusText}>{online ? 'En ligne' : 'Hors ligne'}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.statsCard, Shadows.sm]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{deliveredCount}</Text>
          <Text style={styles.statLabel}>Livrées</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>En cours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completionRate}%</Text>
          <Text style={styles.statLabel}>Taux</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{(totalEarnings / 1000).toFixed(0)}K</Text>
          <Text style={styles.statLabel}>FCFA</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={[styles.perfCard, Shadows.sm]}>
          <View style={styles.perfRow}>
            <View style={styles.perfIconWrap}><Ionicons name="star" size={18} color={Colors.warning} /></View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Note moyenne</Text>
              <Text style={styles.perfSub}>Basée sur {deliveredCount} livraison{deliveredCount > 1 ? 's' : ''}</Text>
            </View>
            <Text style={styles.perfValue}>4.8</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfRow}>
            <View style={styles.perfIconWrap}><Ionicons name="time-outline" size={18} color={Colors.info} /></View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Temps moyen</Text>
              <Text style={styles.perfSub}>Par mission</Text>
            </View>
            <Text style={styles.perfValue}>32 min</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfRow}>
            <View style={styles.perfIconWrap}><Ionicons name="trending-up" size={18} color={Colors.success} /></View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>Taux de completion</Text>
              <Text style={styles.perfSub}>Missions terminées</Text>
            </View>
            <Text style={styles.perfValue}>{completionRate}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon véhicule</Text>
        <View style={[styles.perfCard, Shadows.sm]}>
          <View style={styles.perfRow}>
            <View style={styles.perfIconWrap}>
              <Ionicons
                name={(user?.vehicle?.type || user?.vehicleType) === 'voiture' ? 'car' : (user?.vehicle?.type || user?.vehicleType) === 'velo' ? 'walk' : 'bicycle'}
                size={18}
                color={Colors.primary}
              />
            </View>
            <View style={styles.perfInfo}>
              <Text style={styles.perfLabel}>
                {vehicleModeLabel(user?.vehicle?.type || user?.vehicleType) || 'Non renseigné'}
              </Text>
              <Text style={styles.perfSub}>
                {[user?.vehicle?.brand, user?.vehicle?.model, user?.vehicle?.color].filter(Boolean).join(' · ') || 'Complétez vos infos véhicule'}
              </Text>
            </View>
            <Text style={styles.perfValue}>{user?.vehicle?.plate || '—'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres</Text>
        {settings.map((s, i) => (
          <TouchableOpacity key={i} style={[styles.settingCard, Shadows.sm]} activeOpacity={0.85} disabled={!!s.toggle} onPress={s.onPress}>
            <View style={styles.settingIconWrap}><Ionicons name={s.icon} size={18} color={Colors.gray600} /></View>
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
                {s.value && <Text style={styles.settingValue}>{s.value}</Text>}
                <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <DeleteAccountButton onDeleted={onLogout} />

      <Text style={styles.version}>Bag'up Livreur v1.0.17</Text>

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
                  <TouchableOpacity style={styles.avatarPicker} onPress={handlePickAvatar} activeOpacity={0.8}>
                    {editAvatarUri ? (
                      <Image source={{ uri: editAvatarUri }} style={styles.avatarPickerImage} />
                    ) : resolveMediaUrl(user?.avatarUrl) ? (
                      <Image source={{ uri: resolveMediaUrl(user?.avatarUrl)! }} style={styles.avatarPickerImage} />
                    ) : (
                      <View style={styles.avatarPickerPlaceholder}>
                        <Ionicons name="person" size={32} color={Colors.gray400} />
                      </View>
                    )}
                    <View style={styles.avatarPickerBadge}>
                      <Ionicons name="camera" size={14} color={Colors.white} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.avatarPickerHint}>Photo obligatoire — visible par le client</Text>
                </View>

                <Text style={styles.editLabel}>Prénom</Text>
                <TextInput style={styles.editInput} value={editFirstName} onChangeText={setEditFirstName} placeholder="Prénom" placeholderTextColor={Colors.gray300} returnKeyType="next" />
                <Text style={styles.editLabel}>Nom</Text>
                <TextInput style={styles.editInput} value={editLastName} onChangeText={setEditLastName} placeholder="Nom" placeholderTextColor={Colors.gray300} returnKeyType="next" />
                <Text style={styles.editLabel}>Email</Text>
                <TextInput style={styles.editInput} value={editEmail} onChangeText={setEditEmail} placeholder="Email" placeholderTextColor={Colors.gray300} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />

                <Text style={styles.editLabel}>Type de véhicule</Text>
                <View style={styles.vehicleTypeRow}>
                  {(['moto', 'voiture', 'velo'] as const).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[
                        styles.vehicleTypeChip,
                        editVehicleType === v && styles.vehicleTypeChipActive,
                      ]}
                      onPress={() => setEditVehicleType(v)}
                    >
                      <Text style={[styles.vehicleTypeChipText, editVehicleType === v && styles.vehicleTypeChipTextActive]}>
                        {vehicleModeLabel(v)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editVehicleType !== 'velo' && (
                  <>
                    <Text style={styles.editLabel}>Plaque</Text>
                    <TextInput style={styles.editInput} value={editPlate} onChangeText={setEditPlate} placeholder="DK-1234-AB" autoCapitalize="characters" placeholderTextColor={Colors.gray300} />
                    <Text style={styles.editLabel}>Marque</Text>
                    <TextInput style={styles.editInput} value={editBrand} onChangeText={setEditBrand} placeholder="Marque" placeholderTextColor={Colors.gray300} />
                    <Text style={styles.editLabel}>Modèle</Text>
                    <TextInput style={styles.editInput} value={editModel} onChangeText={setEditModel} placeholder="Modèle" placeholderTextColor={Colors.gray300} />
                    <Text style={styles.editLabel}>Couleur</Text>
                    <View style={styles.colorWrap}>
                      {VEHICLE_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setEditColor(c)}
                          style={[
                            styles.colorChip,
                            editColor === c && styles.colorChipActive,
                          ]}
                        >
                          <Text style={[styles.colorChipText, editColor === c && styles.colorChipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]} onPress={handleSaveProfile} activeOpacity={0.85} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.editSaveText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 56, paddingBottom: Spacing['2xl'], alignItems: 'center', borderBottomLeftRadius: BorderRadius['3xl'], borderBottomRightRadius: BorderRadius['3xl'] },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['2xl'], color: Colors.white },
  userName: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.xl, color: Colors.white },
  roleBadge: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  roleText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white, marginLeft: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusDotOnline: { backgroundColor: '#4ADE80' },
  statusDotOffline: { backgroundColor: Colors.gray400 },
  statusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.white },
  statsCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: -Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, paddingVertical: Spacing.base },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.gray100 },
  statValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  statLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 10, color: Colors.gray400, marginTop: 2 },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  perfCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base },
  perfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  perfIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  perfInfo: { flex: 1 },
  perfLabel: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  perfSub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  perfValue: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  perfDivider: { height: 1, backgroundColor: Colors.gray100 },
  settingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  settingIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  settingLabel: { flex: 1, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  settingValue: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginRight: Spacing.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.xl, backgroundColor: withAlpha(Colors.accent, 0.1), borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, gap: 8 },
  logoutText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.accent },
  version: { textAlign: 'center', fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: Spacing.lg, marginBottom: Spacing['3xl'] },
  editBtn: { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
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
  vehicleTypeRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  vehicleTypeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray50,
    minHeight: 48,
  },
  vehicleTypeChipActive: { borderColor: Colors.primary, backgroundColor: withAlpha(Colors.primary, 0.08) },
  vehicleTypeChipText: { fontFamily: Typography.fontFamily.dmSans.semiBold, color: Colors.gray600, fontSize: Typography.fontSize.sm },
  vehicleTypeChipTextActive: { color: Colors.primary },
  colorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  colorChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.white,
  },
  colorChipActive: { borderColor: Colors.primary, backgroundColor: withAlpha(Colors.primary, 0.1) },
  colorChipText: { fontSize: 12, color: Colors.gray600 },
  colorChipTextActive: { color: Colors.primary },
  editSaveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveText: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
  avatarPickerContainer: { alignItems: 'center', marginBottom: Spacing.md },
  avatarPicker: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarPickerImage: { width: 90, height: 90, borderRadius: 45 },
  avatarPickerPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  avatarPickerBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  avatarPickerHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: Spacing.sm },
});
