import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { formatPhoneDisplay, isSenegalPhone, phoneCountryForE164 } from '../../constants/phoneCountries';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Props {
  phone: string;
  onVerified: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const OtpVerificationScreen: React.FC<Props> = ({ phone, onVerified, onSkip, onBack }) => {
  const insets = useSafeAreaInsets();
  const { token, user, refreshUser, pendingOtp } = useAuth();
  const resolvedPhone = (phone || user?.phone || '').trim();
  const displayPhone = formatPhoneDisplay(resolvedPhone);
  const phoneCountry = phoneCountryForE164(resolvedPhone);
  const usesEmail = resolvedPhone ? !isSenegalPhone(resolvedPhone) : false;

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [channel, setChannel] = useState<'sms' | 'email'>(usesEmail ? 'email' : 'sms');
  const [destination, setDestination] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [needsEmail, setNeedsEmail] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const autoSendStarted = useRef(false);

  useEffect(() => {
    if (user?.phoneVerified) {
      onVerified();
      return;
    }
    if (!resolvedPhone || !token) return;
    if (usesEmail && !user?.email && !emailInput.trim()) {
      setNeedsEmail(true);
      setChannel('email');
      return;
    }
    if (pendingOtp?.sent) {
      if (pendingOtp.channel) setChannel(pendingOtp.channel);
      if (pendingOtp.destination) setDestination(pendingOtp.destination);
      if (__DEV__ && pendingOtp.devCode) setDevCode(pendingOtp.devCode);
      setResendTimer(60);
      setError(null);
      autoSendStarted.current = true;
      return;
    }
    if (autoSendStarted.current) return;
    autoSendStarted.current = true;
    sendOtp();
  }, [resolvedPhone, token, user?.phoneVerified, user?.email, pendingOtp?.sent]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const sendOtp = async (overrideEmail?: string) => {
    setError(null);
    setLoading(true);
    try {
      const emailToSend =
        usesEmail || channel === 'email'
          ? (overrideEmail || emailInput || user?.email || '').trim() || undefined
          : undefined;
      const res = await api.auth.sendOtp(resolvedPhone, token, emailToSend);
      setResendTimer(60);
      setNeedsEmail(false);
      if (res.channel) setChannel(res.channel);
      if (res.destination) setDestination(res.destination);
      if (res.devCode) {
        setDevCode(res.devCode);
        setCode(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      } else {
        setDevCode(null);
      }
      if (emailToSend) {
        await refreshUser().catch(() => null);
      }
    } catch (e: any) {
      const msg = e.message || 'Envoi du code échoué';
      if (msg.includes('déjà vérifié') || msg.includes('already verified')) {
        onVerified();
        return;
      }
      if (/email requis|email obligatoire|adresse email/i.test(msg)) {
        setNeedsEmail(true);
        setChannel('email');
        setError(msg);
        return;
      }
      if (msg.includes('Aucun compte') && token) {
        try {
          const updated = await refreshUser();
          if (updated?.phoneVerified) {
            onVerified();
            return;
          }
        } catch {
          /* fallthrough */
        }
      }
      setError(msg);
      const isNetwork = e instanceof ApiError && e.statusCode === 0;
      if (!isNetwork) {
        Alert.alert('Envoi du code', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (newCode.every((c) => c !== '') && newCode.join('').length === 6) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (fullCode: string) => {
    setLoading(true);
    try {
      await api.auth.verifyOtp(resolvedPhone, fullCode, token);
      Alert.alert(
        'Succès',
        channel === 'email'
          ? 'Votre compte a été vérifié avec succès.'
          : 'Votre numéro a été vérifié avec succès.',
      );
      onVerified();
    } catch (e: any) {
      const msg = e.message || 'Code incorrect';
      if (e.devCode) {
        setDevCode(e.devCode);
        setError(null);
        Alert.alert('Nouveau code', `3 essais échoués. Nouveau code: ${e.devCode}`);
      } else {
        setError(msg);
        Alert.alert('Erreur', msg);
      }
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendTimer === 0) {
      sendOtp();
    }
  };

  const handleVerifyPress = () => {
    const fullCode = code.join('');
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    }
  };

  const handleSkip = async () => {
    if (!__DEV__) {
      Alert.alert('Vérification obligatoire', 'Vous devez saisir le code reçu pour continuer.');
      return;
    }
    try {
      await api.auth.skipOtp(resolvedPhone, token);
      onVerified();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de passer la vérification');
    }
  };

  const handleSubmitEmail = () => {
    const mail = emailInput.trim();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      Alert.alert('Email invalide', 'Indiquez une adresse email valide pour recevoir le code.');
      return;
    }
    sendOtp(mail);
  };

  const isEmailChannel = channel === 'email' || usesEmail;
  const destLabel = destination
    || (isEmailChannel
      ? (emailInput || user?.email || 'votre email')
      : `${phoneCountry ? `${phoneCountry.flag} ` : ''}${displayPhone}`);

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradientPrimary} style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.base, 44) }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {onBack ? (
          <TouchableOpacity
            style={[styles.backBtn, { top: Math.max(insets.top + 4, 48) }]}
            onPress={onBack}
            hitSlop={12}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.iconWrap}>
          <Ionicons
            name={isEmailChannel ? 'mail-outline' : 'phone-portrait-outline'}
            size={40}
            color={Colors.white}
          />
        </View>
        <Text style={styles.title}>
          {isEmailChannel ? 'Vérification email' : 'Vérification SMS'}
        </Text>
        <Text style={styles.subtitle}>
          {isEmailChannel
            ? `Entrez le code à 6 chiffres envoyé à\n${destLabel}`
            : `Entrez le code à 6 chiffres envoyé au\n${destLabel}`}
        </Text>
        <Text style={styles.subtitleHint}>
          {isEmailChannel
            ? 'Hors Sénégal : pas de SMS — le code arrive par email (vérifiez aussi les spams).'
            : 'Sénégal : code envoyé par SMS.'}
        </Text>
      </LinearGradient>

      <View style={styles.form}>
        <View style={[styles.card, Shadows.lg]}>
          {needsEmail ? (
            <View style={styles.emailBlock}>
              <Text style={styles.emailLabel}>Votre email pour recevoir le code</Text>
              <View style={styles.emailInputBox}>
                <Ionicons name="mail-outline" size={20} color={Colors.gray400} />
                <TextInput
                  style={styles.emailInput}
                  placeholder="email@exemple.com"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={Colors.gray400}
                  editable={!loading}
                />
              </View>
              <TouchableOpacity
                style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
                onPress={handleSubmitEmail}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={loading ? [Colors.gray300, Colors.gray400] : Colors.gradientPrimary}
                  style={styles.verifyBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.verifyBtnText}>
                    {loading ? 'Envoi...' : 'Envoyer le code'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={20} color={Colors.accent} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {__DEV__ && devCode && !error && (
                <View style={styles.devBanner}>
                  <Ionicons name="code-slash-outline" size={18} color={Colors.info} />
                  <Text style={styles.devText}>Mode dev — Saisissez le code: {devCode}</Text>
                </View>
              )}
              <View style={styles.codeRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputs.current[index] = ref; }}
                    style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(index, value)}
                    onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
                onPress={handleVerifyPress}
                disabled={loading || code.join('').length !== 6}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={loading || code.join('').length !== 6 ? [Colors.gray300, Colors.gray400] : Colors.gradientPrimary}
                  style={styles.verifyBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.verifyBtnText}>
                    {loading ? 'Vérification...' : 'Vérifier'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>Vous n&apos;avez pas reçu le code ? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0}>
                  <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
                    {resendTimer > 0 ? `Renvoyer (${resendTimer}s)` : 'Renvoyer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {__DEV__ && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Plus tard (dev)</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Syne_700Bold',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DM Sans_400Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  subtitleHint: {
    fontSize: 12,
    fontFamily: 'DM Sans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    lineHeight: 17,
  },
  form: {
    flex: 1,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emailBlock: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  emailLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    marginBottom: Spacing.sm,
  },
  emailInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.gray50,
    marginBottom: Spacing.md,
    height: 54,
  },
  emailInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.gray200,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'DM Sans_700Bold',
    color: Colors.gray900,
    backgroundColor: Colors.gray50,
  },
  codeInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  verifyBtn: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  verifyBtnGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontSize: 16,
    fontFamily: 'DM Sans_700Bold',
    color: Colors.white,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  resendText: {
    fontSize: 13,
    fontFamily: 'DM Sans_400Regular',
    color: Colors.gray500,
  },
  resendLink: {
    fontSize: 13,
    fontFamily: 'DM Sans_600SemiBold',
    color: Colors.primary,
  },
  resendLinkDisabled: {
    color: Colors.gray400,
  },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(Colors.accent, 0.08), borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, flexWrap: 'wrap' },
  errorText: { flex: 1, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.accent, marginLeft: 8 },
  retryBtn: { backgroundColor: Colors.accent, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: 8 },
  retryText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.sm, color: Colors.white },
  devBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(Colors.info, 0.08), borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  devText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.sm, color: Colors.info, marginLeft: 8 },
  skipBtn: {
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'DM Sans_400Regular',
    color: Colors.gray400,
  },
});
