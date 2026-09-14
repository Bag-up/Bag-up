import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Image, Modal, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PHONE_COUNTRIES, toE164 } from '../../constants/phoneCountries';
import { VEHICLE_COLORS, isPlausiblePlate } from '../../constants/vehicle';
import { AuthRolePicker, type AuthRole } from '../../components/auth/AuthRolePicker';
import { LOYALTY_SIGNUP_TIERS, tierUi } from '../../constants/loyalty';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_KEY = '@bagup_remembered_login';

interface Props { onLogin: () => void; }

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [phone, setPhone] = useState('');
  const [phoneDial, setPhoneDial] = useState('+221');
  const [showDialPicker, setShowDialPicker] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  /** null = écran choix Connexion / Inscription */
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const isRegister = authMode === 'register';
  const showForm = authMode !== null;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<AuthRole>('client');
  const [availableRoles, setAvailableRoles] = useState<AuthRole[] | null>(null);
  const [discoveringRoles, setDiscoveringRoles] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberAccount, setRememberAccount] = useState(true);
  const [vehicleType, setVehicleType] = useState<'moto' | 'voiture' | 'velo' | 'aucun'>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('Blanc');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [idCardUri, setIdCardUri] = useState<string | null>(null);
  const [idCardBackUri, setIdCardBackUri] = useState<string | null>(null);
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Sénégal');
  const [zone, setZone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [channelAntiGaspi, setChannelAntiGaspi] = useState(true);
  const [channelMarketplace, setChannelMarketplace] = useState(true);
  const [collecteLivraison, setCollecteLivraison] = useState(true);
  const [demarchesAdmin, setDemarchesAdmin] = useState(false);
  const [demarchesFee, setDemarchesFee] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [loginEmail, setLoginEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'phone' | 'email'>('phone');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'identify' | 'code'>('identify');
  const { login, register } = useAuth();
  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          method?: 'phone' | 'email';
          phone?: string;
          dial?: string;
          email?: string;
          role?: AuthRole;
          password?: string;
        };
        if (saved.method === 'email' && saved.email) {
          setLoginMethod('email');
          setLoginEmail(saved.email);
        } else if (saved.phone) {
          setLoginMethod('phone');
          setPhone(saved.phone);
          if (saved.dial) setPhoneDial(saved.dial);
        }
        if (saved.role) setRole(saved.role);
        if (saved.password) setPassword(saved.password);
        setRememberAccount(true);
      })
      .catch(() => {});
  }, []);

  const persistRememberedLogin = async (identifier: string, rememberedPassword: string) => {
    if (!rememberAccount) {
      await AsyncStorage.removeItem(REMEMBER_KEY).catch(() => {});
      return;
    }
    const payload =
      loginMethod === 'email' && !isRegister
        ? { method: 'email' as const, email: identifier, role, password: rememberedPassword }
        : { method: 'phone' as const, phone: phone.trim(), dial: phoneDial, role, password: rememberedPassword };
    await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify(payload)).catch(() => {});
  };

  const licenseRequired = role === 'provider' && vehicleType !== 'velo' && vehicleType !== 'aucun';
  const isCompact = width <= 360 || height <= 740;

  const selectedDial = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.dial === phoneDial) || PHONE_COUNTRIES[0],
    [phoneDial],
  );

  const selectDial = (dial: string, countryName: string) => {
    setPhoneDial(dial);
    setCountry(countryName);
    setShowDialPicker(false);
  };

  const formatPhone = (value: string) => toE164(value, phoneDial);

  useEffect(() => {
    if (authMode !== 'login' || showForgotPassword) return;
    const rawId = loginMethod === 'email' ? loginEmail.trim() : formatPhone(phone).trim();
    const minLen = loginMethod === 'email' ? 5 : 8;
    if (rawId.length < minLen) {
      setAvailableRoles(null);
      return;
    }
    const timer = setTimeout(async () => {
      setDiscoveringRoles(true);
      try {
        const res = await api.auth.discoverRoles(rawId);
        const roles = (res.roles || []).filter(
          (r): r is AuthRole => r === 'client' || r === 'provider' || r === 'merchant',
        );
        setAvailableRoles(roles.length ? roles : null);
        if (roles.length === 1) {
          setRole(roles[0]);
        } else if (roles.length > 1) {
          setRole((current) => (roles.includes(current) ? current : roles[0]));
        }
      } catch {
        setAvailableRoles(null);
      } finally {
        setDiscoveringRoles(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [authMode, showForgotPassword, loginMethod, loginEmail, phone, phoneDial]);

  const pickImage = async (setImage: (uri: string) => void) => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) { Alert.alert('Permission', 'Autorisez l\'accès à la galerie'); return; }
    const picker = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!picker.canceled && picker.assets[0]) {
      setImage(picker.assets[0].uri);
    }
  };

  const handleLogin = async () => {
    // L'inscription utilise toujours le téléphone (affiché dans le formulaire),
    // même si l'onglet "Email" était actif en mode connexion.
    const rawId = (!isRegister && loginMethod === 'email') ? loginEmail.trim() : formatPhone(phone);
    const identifier = rawId.trim();
    const pwd = password.trim();
    if (isRegister) {
      if (!phone.trim()) {
        Alert.alert('Erreur', 'Entrez votre numéro de téléphone');
        return;
      }
      if (!identifier || identifier.length < 8) {
        Alert.alert('Erreur', 'Numéro de téléphone invalide');
        return;
      }
      if (!pwd) {
        Alert.alert('Erreur', 'Entrez un mot de passe');
        return;
      }
      if (pwd.length < 6) {
        Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      if (pwd !== confirmPassword.trim()) {
        Alert.alert('Erreur', 'Les deux mots de passe ne correspondent pas');
        return;
      }
      // Hors Sénégal : pas de SMS — email obligatoire pour la vérif
      if (!identifier.startsWith('+221')) {
        const mail = email.trim();
        if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
          Alert.alert(
            'Email requis',
            'Pour un numéro hors Sénégal, indiquez un email : le code de vérification sera envoyé par email (pas de SMS).',
          );
          return;
        }
      }
    } else if (!identifier || !pwd) {
      Alert.alert(
        'Erreur',
        loginMethod === 'email'
          ? 'Entrez votre email et votre mot de passe'
          : 'Entrez votre numéro et votre mot de passe',
      );
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        if (!firstName.trim()) { Alert.alert('Erreur', 'Entrez votre prénom'); setLoading(false); return; }
        if (!lastName.trim()) { Alert.alert('Erreur', 'Entrez votre nom'); setLoading(false); return; }
        if (role === 'provider') {
          if (!idCardUri || !idCardBackUri || (licenseRequired && !licenseUri)) {
            Alert.alert(
              'Erreur',
              licenseRequired
                ? 'Téléchargez votre pièce d\'identité (recto/verso) et votre permis'
                : 'Téléchargez votre pièce d\'identité (recto/verso)',
            );
            setLoading(false);
            return;
          }
          if (!avatarUri) {
            Alert.alert('Erreur', 'Ajoutez votre photo de profil (obligatoire pour que le client vous reconnaisse)');
            setLoading(false);
            return;
          }
          const isDemarchesOnly = vehicleType === 'aucun';
          const fee = Number(demarchesFee.replace(/\s/g, ''));
          if (isDemarchesOnly && (!Number.isFinite(fee) || fee < 1000 || fee > 50000)) {
            Alert.alert('Erreur', 'Indiquez vos honoraires entre 1 000 et 50 000 FCFA');
            setLoading(false);
            return;
          }
          if (vehicleType !== 'velo' && vehicleType !== 'aucun') {
            if (!vehiclePlate.trim() || !isPlausiblePlate(vehiclePlate)) {
              Alert.alert('Erreur', 'Indiquez une plaque d\'immatriculation valide');
              setLoading(false);
              return;
            }
            if (!vehicleBrand.trim() || !vehicleModel.trim() || !vehicleColor.trim()) {
              Alert.alert('Erreur', 'Renseignez marque, modèle et couleur du véhicule');
              setLoading(false);
              return;
            }
          }
          setUploading(true);
          const idCardRes = await api.uploads.publicRegistrationUpload({ uri: idCardUri, type: 'image/jpeg', name: 'idcard-recto.jpg' }).catch(() => null);
          const idCardBackRes = await api.uploads.publicRegistrationUpload({ uri: idCardBackUri, type: 'image/jpeg', name: 'idcard-verso.jpg' }).catch(() => null);
          const licenseRes = licenseUri
            ? await api.uploads.publicRegistrationUpload({ uri: licenseUri, type: 'image/jpeg', name: 'license.jpg' }).catch(() => null)
            : null;
          const avatarRes = await api.uploads.publicRegistrationUpload({ uri: avatarUri, type: 'image/jpeg', name: 'avatar.jpg' }).catch(() => null);
          setUploading(false);
          if (!avatarRes?.url) {
            Alert.alert('Erreur', 'Impossible d’envoyer la photo de profil. Réessayez.');
            setLoading(false);
            return;
          }
          if (!idCardRes?.url || !idCardBackRes?.url) {
            Alert.alert('Erreur', 'Impossible d’envoyer la pièce d’identité (recto/verso). Réessayez.');
            setLoading(false);
            return;
          }
          if (licenseUri && !licenseRes?.url) {
            Alert.alert('Erreur', 'Impossible d’envoyer le permis. Réessayez.');
            setLoading(false);
            return;
          }
          await register({
            firstName: firstName.trim(), lastName: lastName.trim(), phone: identifier, password: pwd, role,
            email: email || undefined,
            address: address || undefined,
            country: country || undefined,
            vehicleType: vehicleType === 'aucun' ? undefined : vehicleType,
            vehiclePlate: vehicleType !== 'velo' && vehicleType !== 'aucun' ? vehiclePlate.trim().toUpperCase() : undefined,
            vehicleBrand: vehicleType !== 'velo' && vehicleType !== 'aucun' ? vehicleBrand.trim() : undefined,
            vehicleModel: vehicleType !== 'velo' && vehicleType !== 'aucun' ? vehicleModel.trim() : undefined,
            vehicleColor: vehicleType !== 'velo' && vehicleType !== 'aucun' ? vehicleColor.trim() : undefined,
            zone: zone || undefined,
            serviceCategories: isDemarchesOnly
              ? 'demarches_admin'
              : [collecteLivraison && 'collecte_livraison', demarchesAdmin && 'demarches_admin'].filter(Boolean).join(',') || undefined,
            demarchesServiceFee: isDemarchesOnly ? fee : undefined,
            idCardUrl: idCardRes?.url,
            idCardBackUrl: idCardBackRes?.url,
            licenseUrl: licenseRes?.url,
            avatarUrl: avatarRes.url,
            referredBy: referralCode || undefined,
          });
        } else if (role === 'merchant') {
          if (!businessName.trim()) {
            Alert.alert('Erreur', 'Indiquez le nom de votre commerce');
            setLoading(false);
            return;
          }
          if (!channelAntiGaspi && !channelMarketplace) {
            Alert.alert('Erreur', 'Choisissez au moins un service : Anti-Gaspi et/ou Marketplace');
            setLoading(false);
            return;
          }
          const merchantChannels = [
            ...(channelAntiGaspi ? ['antigaspi'] : []),
            ...(channelMarketplace ? ['marketplace'] : []),
          ];
          await register({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: identifier,
            password: pwd,
            role,
            email: email || undefined,
            address: address || undefined,
            country: country || undefined,
            businessName: businessName.trim(),
            businessAddress: businessAddress.trim() || address || undefined,
            merchantChannels,
            referredBy: referralCode || undefined,
          });
        } else {
          await register({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: identifier,
            password: pwd,
            role,
            email: email || undefined,
            address: address || undefined,
            country: country || undefined,
            referredBy: referralCode || undefined,
          });
        }
      } else {
        await login(identifier, pwd, role, rememberAccount);
        await persistRememberedLogin(identifier, pwd);
      }
      onLogin();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Connexion échouée');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (forgotStep === 'identify') {
      if (forgotMethod === 'email') {
        const mail = forgotEmail.trim().toLowerCase();
        if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
          Alert.alert('Erreur', 'Entrez une adresse email valide');
          return;
        }
        setLoading(true);
        try {
          const res = await api.auth.forgotPassword({ email: mail, role });
          const code = __DEV__ ? (res.devToken || null) : null;
          Alert.alert(
            'Code envoyé',
            code
              ? `Mode dev — Votre code : ${code}`
              : (res.message || 'Un code a été envoyé. Vérifiez votre boîte mail (et les spams).'),
          );
          setForgotStep('code');
        } catch (e: any) {
          Alert.alert('Erreur', e.message || 'Échec');
        } finally {
          setLoading(false);
        }
      } else {
        const fullPhone = formatPhone(phone);
        if (!phone.trim() || fullPhone.length < 8) {
          Alert.alert('Erreur', 'Entrez le numéro de téléphone de votre compte');
          return;
        }
        setLoading(true);
        try {
          const res = await api.auth.forgotPassword({ phone: fullPhone, role });
          const code = __DEV__ ? (res.devToken || null) : null;
          Alert.alert(
            'Code envoyé',
            code
              ? `Mode dev — Votre code : ${code}`
              : (res.message || 'Un code a été envoyé par SMS.'),
          );
          setForgotStep('code');
        } catch (e: any) {
          Alert.alert('Erreur', e.message || 'Échec');
        } finally {
          setLoading(false);
        }
      }
    } else if (forgotStep === 'code') {
      if (!resetToken.trim() || !newPassword.trim()) {
        Alert.alert('Erreur', 'Entrez le code reçu et votre nouveau mot de passe');
        return;
      }
      if (newPassword.trim().length < 6) {
        Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      setLoading(true);
      try {
        await api.auth.resetPassword(resetToken.trim(), newPassword.trim());
        Alert.alert('Succès', 'Mot de passe réinitialisé. Vous pouvez vous connecter.');
        setShowForgotPassword(false);
        setForgotStep('identify');
        setForgotMethod('phone');
        setForgotEmail('');
        setResetToken('');
        setNewPassword('');
      } catch (e: any) {
        Alert.alert('Erreur', e.message || 'Échec');
      } finally {
        setLoading(false);
      }
    }
  };

  const goBackToChoice = () => {
    setAuthMode(null);
    setShowForgotPassword(false);
    setForgotStep('identify');
    setForgotMethod('phone');
    setForgotEmail('');
    setResetToken('');
    setNewPassword('');
  };

  const openLogin = () => {
    setAuthMode('login');
    setLoginMethod('phone');
    setShowForgotPassword(false);
    setRole('client');
    setAvailableRoles(null);
  };

  const openRegister = () => {
    setAuthMode('register');
    setLoginMethod('phone');
    setShowForgotPassword(false);
    setRole('client');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientPrimary}
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + Spacing.base, 44),
            paddingBottom: isCompact ? Spacing.xl : Spacing['2xl'],
          },
        ]}
      >
        {showForm ? (
          <TouchableOpacity
            style={[styles.backBtn, { top: Math.max(insets.top + 4, 48) }]}
            onPress={() => {
              if (showForgotPassword) {
                setShowForgotPassword(false);
                setForgotStep('identify');
                setForgotMethod('phone');
                return;
              }
              goBackToChoice();
            }}
            hitSlop={12}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.logoWrap}>
          <View style={styles.logoAnchor}>
            <Image source={require('../../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
        </View>
        <Text style={styles.subtitle}>
          {!showForm
            ? 'Livraison & Services'
            : showForgotPassword
              ? 'Mot de passe oublié'
              : isRegister
                ? 'Rejoignez la communauté'
                : 'Bon retour !'}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0} style={styles.form}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: isCompact ? Spacing.base : 0,
              paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing['3xl']),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {!showForm ? (
            <View style={[styles.card, Shadows.lg, isCompact && styles.cardCompact, styles.choiceCard]}>
              <Text style={styles.choiceTitle}>Bienvenue sur Bag&apos;up</Text>
              <Text style={styles.choiceHint}>Connectez-vous ou créez un compte pour continuer</Text>
              <View style={styles.choiceButtons}>
                <Button title="Se connecter" onPress={openLogin} fullWidth />
                <TouchableOpacity style={styles.secondaryBtn} onPress={openRegister} activeOpacity={0.85}>
                  <Text style={styles.secondaryBtnText}>Créer un compte</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <View style={[styles.card, Shadows.lg, isCompact && styles.cardCompact]}>
            {isRegister ? (
              <>
                <Text style={styles.label}>Je suis</Text>
                <Text style={styles.phoneHint}>Un même numéro peut ouvrir les 3 espaces. Le blocage n’apparaît que si ce type de compte existe déjà.</Text>
                <AuthRolePicker value={role} onChange={setRole} />

                {role === 'client' && (
                  <View style={styles.loyaltySignupCard}>
                    <View style={styles.loyaltySignupHeader}>
                      <View style={[styles.loyaltySignupIcon, { backgroundColor: withAlpha(tierUi('gold').color, 0.16) }]}>
                        <Ionicons name="trophy" size={18} color={tierUi('gold').color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.loyaltySignupTitle}>Votre fidélité récompensée</Text>
                        <Text style={styles.loyaltySignupSub}>
                          Cumulez missions, courses et paniers Anti-Gaspi. Plus vous utilisez Bag&apos;up, plus vos bons augmentent.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.loyaltySignupTiers}>
                      {LOYALTY_SIGNUP_TIERS.map((t) => {
                        const ui = tierUi(t.key);
                        return (
                          <View key={t.key} style={styles.loyaltySignupTier}>
                            <Ionicons name={ui.icon as any} size={14} color={ui.color} />
                            <Text style={styles.loyaltySignupTierName}>{ui.label}</Text>
                            <Text style={styles.loyaltySignupTierMeta}>
                              {t.from === 0 ? 'dès 0' : `${t.from}+`} · {t.perk}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Text style={styles.label}>Prénom</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Votre prénom" value={firstName} onChangeText={setFirstName} placeholderTextColor={Colors.gray400} />
                </View>

                <Text style={styles.label}>Nom</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Votre nom de famille" value={lastName} onChangeText={setLastName} placeholderTextColor={Colors.gray400} />
                </View>

                <Text style={styles.label}>Numéro de téléphone</Text>
                <View style={[styles.phoneRow, isCompact && styles.phoneRowCompact]}>
                  <TouchableOpacity style={[styles.dialBtn, isCompact && styles.dialBtnCompact]} onPress={() => setShowDialPicker(true)} activeOpacity={0.8}>
                    <Text style={styles.dialFlag}>{selectedDial.flag}</Text>
                    <Text style={styles.dialCode}>{selectedDial.dial}</Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.gray500} />
                  </TouchableOpacity>
                  <View style={[styles.inputBox, styles.phoneInputBox]}>
                    <Ionicons name="call-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={phoneDial === '+221' ? '77 123 45 67' : 'Numéro local'}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor={Colors.gray400}
                    />
                  </View>
                </View>
                <Text style={styles.phoneHint}>Indiquez seulement le numéro. L&apos;indicatif est déjà choisi ({selectedDial.name}).</Text>

                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Minimum 6 caractères" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor={Colors.gray400} autoCapitalize="none" autoCorrect={false} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10} accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.phoneHint}>Touchez l&apos;œil pour vérifier que vous ne vous êtes pas trompé.</Text>

                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Retapez le mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} placeholderTextColor={Colors.gray400} autoCapitalize="none" autoCorrect={false} />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn} hitSlop={10} accessibilityLabel={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}>
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>
                  {phoneDial !== '+221' ? 'Email (obligatoire)' : 'Email (optionnel)'}
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="email@exemple.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.gray400} />
                </View>
                {phoneDial !== '+221' ? (
                  <Text style={styles.phoneHint}>
                    Hors Sénégal : le code de vérification sera envoyé par email (pas de SMS).
                  </Text>
                ) : null}

                <Text style={styles.label}>Adresse (optionnel)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="location-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Votre adresse" value={address} onChangeText={setAddress} placeholderTextColor={Colors.gray400} />
                </View>

                <Text style={styles.label}>Pays de résidence</Text>
                <View style={styles.countryChips}>
                  {PHONE_COUNTRIES.slice(0, 8).map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={[styles.countryChip, country === c.name && styles.countryChipActive]}
                      onPress={() => selectDial(c.dial, c.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.countryChipText}>{c.flag} {c.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.countryChip, !PHONE_COUNTRIES.slice(0, 8).some((c) => c.name === country) && country !== 'Sénégal' && styles.countryChipActive]}
                    onPress={() => setShowDialPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.countryChipText}>Autre…</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputBox}>
                  <Ionicons name="globe-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Pays" value={country} onChangeText={setCountry} placeholderTextColor={Colors.gray400} />
                </View>

                {role === 'merchant' && (
                  <>
                    <Text style={styles.label}>Services souhaités</Text>
                    <TouchableOpacity
                      style={[styles.channelCard, channelAntiGaspi && styles.channelCardOn]}
                      onPress={() => setChannelAntiGaspi((v) => !v)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={channelAntiGaspi ? 'checkbox' : 'square-outline'} size={22} color={channelAntiGaspi ? Colors.primary : Colors.gray400} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.channelTitle}>Anti-Gaspi</Text>
                        <Text style={styles.channelHint}>Paniers surplus · gratuit après validation</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.channelCard, channelMarketplace && styles.channelCardOn]}
                      onPress={() => setChannelMarketplace((v) => !v)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={channelMarketplace ? 'checkbox' : 'square-outline'} size={22} color={channelMarketplace ? Colors.primary : Colors.gray400} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.channelTitle}>Marketplace</Text>
                        <Text style={styles.channelHint}>Boutique en ligne · abo 6 500 FCFA/mois</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.label}>Nom du commerce</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="storefront-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Ex: Boulangerie du coin" value={businessName} onChangeText={setBusinessName} placeholderTextColor={Colors.gray400} />
                    </View>
                    <Text style={styles.label}>Adresse du commerce</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="location-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Adresse de retrait / collecte" value={businessAddress} onChangeText={setBusinessAddress} placeholderTextColor={Colors.gray400} />
                    </View>
                    <View style={styles.infoBanner}>
                      <Ionicons name="information-circle" size={16} color={Colors.primary} />
                      <Text style={styles.infoText}>Votre compte sera vérifié par Bag’up avant activation. Vous pourrez suivre le statut dans l’app.</Text>
                    </View>
                  </>
                )}

                {role === 'provider' && (
                  <>
                    <Text style={styles.label}>Photo de profil *</Text>
                    <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setAvatarUri)} activeOpacity={0.8}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.uploadPreview} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="camera-outline" size={28} color={Colors.gray400} />
                          <Text style={styles.uploadText}>Photo obligatoire (visible par le client)</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.label}>Type de véhicule</Text>
                    <View style={styles.vehicleGrid}>
                      {([
                        { id: 'moto' as const, label: 'Moto', icon: 'bicycle' as const },
                        { id: 'voiture' as const, label: 'Voiture', icon: 'car' as const },
                        { id: 'velo' as const, label: 'Vélo', icon: 'walk' as const },
                        { id: 'aucun' as const, label: 'Démarches', icon: 'briefcase-outline' as const },
                      ]).map((opt) => {
                        const on = vehicleType === opt.id;
                        return (
                          <View key={opt.id} style={styles.vehicleGridCell}>
                            <TouchableOpacity
                              style={[styles.vehicleGridCard, on && styles.vehicleSelected]}
                              onPress={() => {
                                setVehicleType(opt.id);
                                if (opt.id === 'aucun') setDemarchesAdmin(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={opt.icon}
                                size={22}
                                color={on ? Colors.primary : Colors.gray400}
                              />
                              <Text
                                style={[styles.vehicleGridLabel, on && styles.vehicleLabelSelected]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.85}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                    {vehicleType === 'aucun' ? (
                      <Text style={styles.phoneHint}>
                        Sans véhicule — inscription pour les démarches administratives uniquement (pas de courses moto/voiture).
                      </Text>
                    ) : null}

                    {vehicleType !== 'velo' && vehicleType !== 'aucun' && (
                      <>
                        <Text style={styles.label}>Plaque d'immatriculation</Text>
                        <View style={styles.inputBox}>
                          <Ionicons name="keypad-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: DK-1234-AB"
                            value={vehiclePlate}
                            onChangeText={setVehiclePlate}
                            autoCapitalize="characters"
                            placeholderTextColor={Colors.gray400}
                          />
                        </View>
                        <Text style={styles.label}>Marque</Text>
                        <View style={styles.inputBox}>
                          <Ionicons name="business-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                          <TextInput style={styles.input} placeholder="Ex: Toyota, Yamaha" value={vehicleBrand} onChangeText={setVehicleBrand} placeholderTextColor={Colors.gray400} />
                        </View>
                        <Text style={styles.label}>Modèle</Text>
                        <View style={styles.inputBox}>
                          <Ionicons name="car-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                          <TextInput style={styles.input} placeholder="Ex: Corolla, NMAX" value={vehicleModel} onChangeText={setVehicleModel} placeholderTextColor={Colors.gray400} />
                        </View>
                        <Text style={styles.label}>Couleur</Text>
                        <View style={styles.vehicleRow}>
                          {VEHICLE_COLORS.slice(0, 5).map((c) => (
                            <TouchableOpacity
                              key={c}
                              style={[styles.vehicleCard, vehicleColor === c && styles.vehicleSelected]}
                              onPress={() => setVehicleColor(c)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.vehicleLabel, vehicleColor === c && styles.vehicleLabelSelected]}>{c}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={[styles.vehicleRow, { marginTop: 8 }]}>
                          {VEHICLE_COLORS.slice(5).map((c) => (
                            <TouchableOpacity
                              key={c}
                              style={[styles.vehicleCard, vehicleColor === c && styles.vehicleSelected]}
                              onPress={() => setVehicleColor(c)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.vehicleLabel, vehicleColor === c && styles.vehicleLabelSelected]}>{c}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={styles.infoBanner}>
                          <Ionicons name="eye-outline" size={18} color={Colors.primary} />
                          <Text style={styles.infoText}>
                            Après acceptation d’une course, le client verra : {vehicleBrand || 'Marque'} {vehicleModel || 'Modèle'} · {vehicleColor} · {vehiclePlate.trim().toUpperCase() || 'PLAQUE'}
                          </Text>
                        </View>
                      </>
                    )}

                    <Text style={styles.label}>Zone d'intervention</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="map-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="Ex: Dakar, Pikine..." value={zone} onChangeText={setZone} placeholderTextColor={Colors.gray400} />
                    </View>

                    {vehicleType === 'aucun' ? (
                      <>
                        <Text style={styles.label}>Honoraires démarches (FCFA) *</Text>
                        <View style={styles.inputBox}>
                          <Ionicons name="pricetag-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Ex: 5000"
                            value={demarchesFee}
                            onChangeText={setDemarchesFee}
                            keyboardType="number-pad"
                            placeholderTextColor={Colors.gray400}
                          />
                        </View>
                        <Text style={styles.phoneHint}>
                          Le client voit ce tarif avant de vous choisir. Bag’up retient 15 % sur ces honoraires seulement. Les frais officiels (timbre, droits) restent séparés.
                        </Text>
                        <Text style={styles.phoneHint}>Abonnement démarches : 4 000 FCFA / mois.</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>Catégories de service</Text>
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setCollecteLivraison(!collecteLivraison)} activeOpacity={0.8}>
                          <Ionicons name={collecteLivraison ? 'checkbox-outline' : 'square-outline'} size={22} color={collecteLivraison ? Colors.primary : Colors.gray400} />
                          <Text style={styles.checkboxLabel}>Collecte / Livraison</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setDemarchesAdmin(!demarchesAdmin)} activeOpacity={0.8}>
                          <Ionicons name={demarchesAdmin ? 'checkbox-outline' : 'square-outline'} size={22} color={demarchesAdmin ? Colors.primary : Colors.gray400} />
                          <Text style={styles.checkboxLabel}>Démarches administratives</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    <Text style={styles.label}>Pièce d'identité (recto)</Text>
                    <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdCardUri)} activeOpacity={0.8}>
                      {idCardUri ? (
                        <Image source={{ uri: idCardUri }} style={styles.uploadPreview} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="card-outline" size={28} color={Colors.gray400} />
                          <Text style={styles.uploadText}>Recto CNI</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.label}>Pièce d'identité (verso)</Text>
                    <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setIdCardBackUri)} activeOpacity={0.8}>
                      {idCardBackUri ? (
                        <Image source={{ uri: idCardBackUri }} style={styles.uploadPreview} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="document-outline" size={28} color={Colors.gray400} />
                          <Text style={styles.uploadText}>Verso CNI</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.label}>
                      Permis de conduire {vehicleType === 'velo' || vehicleType === 'aucun' ? '(optionnel)' : ''}
                    </Text>
                    <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(setLicenseUri)} activeOpacity={0.8}>
                      {licenseUri ? (
                        <Image source={{ uri: licenseUri }} style={styles.uploadPreview} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Ionicons name="document-text-outline" size={28} color={Colors.gray400} />
                          <Text style={styles.uploadText}>
                            {vehicleType === 'velo' || vehicleType === 'aucun'
                              ? 'Télécharger permis (si disponible)'
                              : 'Télécharger permis'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.infoBanner}>
                      <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
                      <Text style={styles.infoText}>Votre compte sera vérifié par un administrateur avant activation.</Text>
                    </View>
                    {(vehicleType === 'velo' || vehicleType === 'aucun') && (
                      <View style={styles.infoBanner}>
                        <Ionicons name={vehicleType === 'aucun' ? 'briefcase-outline' : 'bicycle-outline'} size={18} color={Colors.warning} />
                        <Text style={styles.infoText}>
                          {vehicleType === 'aucun'
                            ? 'Sans véhicule : démarches administratives uniquement. Pour les courses clients, choisissez moto ou voiture.'
                            : 'Vélo / à pied : OK pour livraisons et démarches. Pour les courses clients (type Yango), choisissez moto ou voiture avec plaque et couleur.'}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.label}>Code de parrainage (optionnel)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="gift-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="BAG..." value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" placeholderTextColor={Colors.gray400} />
                </View>

                <View style={styles.buttonWrap}>
                  <Button title={uploading ? 'Envoi des documents...' : "S'inscrire"} onPress={handleLogin} loading={loading || uploading} fullWidth />
                </View>
                <View style={styles.register}>
                  <Text style={styles.registerText}>Déjà un compte ? </Text>
                  <TouchableOpacity onPress={openLogin}>
                    <Text style={styles.registerLink}>Se connecter</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : showForgotPassword ? (
              <>
                <Text style={styles.loginSectionTitle}>Récupérer mon compte</Text>
                {forgotStep === 'identify' ? (
                  <>
                    <Text style={styles.phoneHint}>
                      Utilisez le numéro de votre compte (recommandé). L’email ne marche que s’il a été renseigné sur le profil.
                    </Text>
                    <View style={styles.loginMethodRow}>
                      <TouchableOpacity
                        style={[styles.loginMethodBtn, forgotMethod === 'phone' && styles.loginMethodActive]}
                        onPress={() => setForgotMethod('phone')}
                      >
                        <Text style={[styles.loginMethodText, forgotMethod === 'phone' && styles.loginMethodTextActive]}>Téléphone</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.loginMethodBtn, forgotMethod === 'email' && styles.loginMethodActive]}
                        onPress={() => setForgotMethod('email')}
                      >
                        <Text style={[styles.loginMethodText, forgotMethod === 'email' && styles.loginMethodTextActive]}>Email</Text>
                      </TouchableOpacity>
                    </View>

                    {forgotMethod === 'phone' ? (
                      <>
                        <Text style={styles.label}>Numéro du compte</Text>
                        <View style={[styles.phoneRow, isCompact && styles.phoneRowCompact]}>
                          <TouchableOpacity style={[styles.dialBtn, isCompact && styles.dialBtnCompact]} onPress={() => setShowDialPicker(true)} activeOpacity={0.8}>
                            <Text style={styles.dialFlag}>{selectedDial.flag}</Text>
                            <Text style={styles.dialCode}>{selectedDial.dial}</Text>
                            <Ionicons name="chevron-down" size={14} color={Colors.gray500} />
                          </TouchableOpacity>
                          <View style={[styles.inputBox, styles.phoneInputBox]}>
                            <Ionicons name="call-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                            <TextInput
                              style={styles.input}
                              placeholder={phoneDial === '+221' ? '77 123 45 67' : 'Numéro local'}
                              value={phone}
                              onChangeText={setPhone}
                              keyboardType="phone-pad"
                              placeholderTextColor={Colors.gray400}
                            />
                          </View>
                        </View>
                        <Text style={styles.label}>Espace concerné</Text>
                        <AuthRolePicker value={role} onChange={setRole} compact={isCompact} />
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>Email du compte</Text>
                        <View style={styles.inputBox}>
                          <Ionicons name="mail-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="email@exemple.com"
                            value={forgotEmail}
                            onChangeText={setForgotEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor={Colors.gray400}
                          />
                        </View>
                        <Text style={styles.label}>Espace concerné</Text>
                        <AuthRolePicker value={role} onChange={setRole} compact={isCompact} />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.phoneHint}>
                      Saisissez le code reçu par {forgotMethod === 'phone' ? 'SMS' : 'email'} puis votre nouveau mot de passe.
                    </Text>
                    <Text style={styles.label}>Code de réinitialisation</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="key-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Code reçu"
                        value={resetToken}
                        onChangeText={setResetToken}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        placeholderTextColor={Colors.gray400}
                      />
                    </View>
                    <Text style={styles.label}>Nouveau mot de passe</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPassword}
                        placeholderTextColor={Colors.gray400}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray400} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                <View style={styles.buttonWrap}>
                  <Button
                    title={forgotStep === 'identify' ? 'Envoyer le code' : 'Réinitialiser'}
                    onPress={handleForgotPassword}
                    loading={loading}
                    fullWidth
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowForgotPassword(false);
                    setForgotStep('identify');
                    setForgotMethod('phone');
                  }}
                  style={styles.register}
                >
                  <Text style={styles.registerLink}>Retour à la connexion</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.loginSectionTitle}>Connexion</Text>
                <Text style={styles.phoneHint}>Entrez votre identifiant, choisissez votre espace, puis votre mot de passe.</Text>

                <View style={styles.loginMethodRow}>
                  <TouchableOpacity style={[styles.loginMethodBtn, loginMethod === 'phone' && styles.loginMethodActive]} onPress={() => setLoginMethod('phone')}>
                    <Text style={[styles.loginMethodText, loginMethod === 'phone' && styles.loginMethodTextActive]}>Téléphone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.loginMethodBtn, loginMethod === 'email' && styles.loginMethodActive]} onPress={() => setLoginMethod('email')}>
                    <Text style={[styles.loginMethodText, loginMethod === 'email' && styles.loginMethodTextActive]}>Email</Text>
                  </TouchableOpacity>
                </View>

                {loginMethod === 'phone' ? (
                  <>
                    <Text style={styles.label}>Numéro de téléphone</Text>
                    <View style={[styles.phoneRow, isCompact && styles.phoneRowCompact]}>
                      <TouchableOpacity style={[styles.dialBtn, isCompact && styles.dialBtnCompact]} onPress={() => setShowDialPicker(true)} activeOpacity={0.8}>
                        <Text style={styles.dialFlag}>{selectedDial.flag}</Text>
                        <Text style={styles.dialCode}>{selectedDial.dial}</Text>
                        <Ionicons name="chevron-down" size={14} color={Colors.gray500} />
                      </TouchableOpacity>
                      <View style={[styles.inputBox, styles.phoneInputBox]}>
                        <Ionicons name="call-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder={phoneDial === '+221' ? '77 123 45 67' : 'Numéro local'}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          placeholderTextColor={Colors.gray400}
                        />
                      </View>
                    </View>
                    <Text style={styles.phoneHint}>Indicatif {selectedDial.name} · un même numéro peut avoir plusieurs espaces.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputBox}>
                      <Ionicons name="mail-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="email@exemple.com" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.gray400} />
                    </View>
                  </>
                )}

                <Text style={styles.label}>Votre espace</Text>
                {availableRoles && availableRoles.length > 1 ? (
                  <Text style={styles.roleDiscoverHint}>
                    {availableRoles.length} comptes actifs — choisissez celui à ouvrir
                  </Text>
                ) : null}
                {discoveringRoles ? (
                  <Text style={styles.roleDiscoverHint}>Recherche de vos espaces…</Text>
                ) : null}
                <AuthRolePicker
                  value={role}
                  onChange={setRole}
                  available={availableRoles ?? undefined}
                  compact={isCompact}
                />

                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.gray400} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Votre mot de passe" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor={Colors.gray400} autoCapitalize="none" autoCorrect={false} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={10} accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberAccount((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={rememberAccount ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={rememberAccount ? Colors.primary : Colors.gray400}
                  />
                  <Text style={styles.rememberText}>Mémoriser mon compte sur cet appareil</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.forgot} onPress={() => setShowForgotPassword(true)}>
                  <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>

                <View style={styles.buttonWrap}>
                  <Button title="Se connecter" onPress={handleLogin} loading={loading} fullWidth />
                </View>
                <View style={styles.register}>
                  <Text style={styles.registerText}>Pas de compte ? </Text>
                  <TouchableOpacity onPress={openRegister}>
                    <Text style={styles.registerLink}>S&apos;inscrire</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showDialPicker} transparent animationType="slide" onRequestClose={() => setShowDialPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDialPicker(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Indicatif téléphonique</Text>
            <FlatList
              data={PHONE_COUNTRIES}
              keyExtractor={(item) => `${item.code}-${item.dial}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dialOption, phoneDial === item.dial && country === item.name && styles.dialOptionActive]}
                  onPress={() => selectDial(item.dial, item.name)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dialOptionFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dialOptionName}>{item.name}</Text>
                    <Text style={styles.dialOptionDial}>{item.dial}</Text>
                  </View>
                  {phoneDial === item.dial && country === item.name ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius['3xl'],
    borderBottomRightRadius: BorderRadius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoAnchor: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  logo: {
    width: 96,
    height: 96,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  form: { flex: 1, marginTop: -Spacing.xl },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['3xl'] },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing.xl },
  cardCompact: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.lg },
  choiceCard: { paddingVertical: Spacing['2xl'] },
  choiceTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize['2xl'],
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  choiceHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  choiceButtons: { gap: Spacing.md },
  secondaryBtn: {
    height: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  secondaryBtnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
  },
  label: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray700, marginBottom: Spacing.sm, marginTop: Spacing.md },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200 },
  inputIcon: { marginLeft: Spacing.base },
  input: { flex: 1, height: 54, paddingHorizontal: Spacing.sm, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  eyeBtn: { padding: Spacing.md },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  rememberText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  forgot: { alignSelf: 'flex-end', marginVertical: Spacing.sm },
  forgotText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.primary },
  buttonWrap: { marginTop: Spacing.lg },
  register: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  registerText: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  registerLink: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.primary },
  roleRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  roleCard: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.base, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.gray50 },
  roleCardFull: { marginTop: Spacing.sm, flex: undefined },
  roleSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  roleIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  roleIconSelected: { backgroundColor: Colors.white },
  roleLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  roleLabelSelected: { color: Colors.primary },
  roleHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  channelCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  channelTitle: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  channelHint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  uploadBox: { height: 120, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.gray50, overflow: 'hidden', marginTop: Spacing.sm },
  uploadPreview: { width: '100%', height: '100%' },
  uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: Spacing.xs },
  vehicleRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
    marginHorizontal: -4,
  },
  vehicleGridCell: {
    width: '50%',
    padding: 4,
  },
  vehicleGridCard: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.gray50,
    minHeight: 72,
  },
  vehicleGridLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    textAlign: 'center',
    width: '100%',
  },
  vehicleCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.base, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.gray50 },
  vehicleSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  vehicleLabel: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  vehicleLabelSelected: { color: Colors.primary },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.md, backgroundColor: Colors.gray50, borderRadius: BorderRadius.md, padding: Spacing.base },
  infoText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray600 },
  loyaltySignupCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: withAlpha('#C9A227', 0.35),
    padding: Spacing.base,
  },
  loyaltySignupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  loyaltySignupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltySignupTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  loyaltySignupSub: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
    lineHeight: 16,
  },
  loyaltySignupTiers: { marginTop: Spacing.md, gap: 6 },
  loyaltySignupTier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loyaltySignupTierName: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray800,
    width: 52,
  },
  loyaltySignupTierMeta: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
  checkboxLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray700 },
  loginMethodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  loginMethodBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.base, backgroundColor: Colors.gray100, alignItems: 'center' },
  loginMethodActive: { backgroundColor: Colors.primarySoft, borderWidth: 1.5, borderColor: Colors.primary },
  loginMethodText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  loginMethodTextActive: { color: Colors.primary },
  loginSectionTitle: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
    marginTop: Spacing.xs,
  },
  phoneRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  phoneRowCompact: { alignItems: 'stretch' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 54, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.gray200, backgroundColor: Colors.gray50, maxWidth: 132 },
  dialBtnCompact: { paddingHorizontal: Spacing.sm, maxWidth: 118 },
  dialFlag: { fontSize: 18 },
  dialCode: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.gray900 },
  phoneInputBox: { flex: 1, minWidth: 0 },
  phoneHint: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: Spacing.xs, lineHeight: 16 },
  roleDiscoverHint: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  countryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  countryChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.lg, backgroundColor: Colors.gray100, borderWidth: 1, borderColor: Colors.gray200 },
  countryChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  countryChipText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs, color: Colors.gray700 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '70%', backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius['2xl'], borderTopRightRadius: BorderRadius['2xl'], padding: Spacing.lg },
  modalTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  dialOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  dialOptionActive: { backgroundColor: Colors.primarySoft, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm },
  dialOptionFlag: { fontSize: 22 },
  dialOptionName: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  dialOptionDial: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
});
