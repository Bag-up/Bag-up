import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const DISMISS_KEY = '@bagup_update_dismissed';
const ANDROID_PACKAGE = 'sn.bagup.app';
const IOS_APP_ID = '6793175800';

function parseVersion(value: string) {
  return value
    .split('.')
    .map((part) => parseInt(part.replace(/\D/g, ''), 10) || 0);
}

function isNewer(latest: string, current: string) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] || 0;
    const right = b[i] || 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

function currentAppVersion() {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '0.0.0'
  );
}

function storeDeepLinks(iosUrl?: string, androidUrl?: string) {
  if (Platform.OS === 'ios') {
    return {
      primary: `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`,
      fallback: iosUrl || `https://apps.apple.com/app/id${IOS_APP_ID}`,
    };
  }
  return {
    primary: `market://details?id=${ANDROID_PACKAGE}`,
    fallback: androidUrl || `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  };
}

async function openStore(iosUrl?: string, androidUrl?: string) {
  const { primary, fallback } = storeDeepLinks(iosUrl, androidUrl);
  try {
    const can = await Linking.canOpenURL(primary);
    if (can) {
      await Linking.openURL(primary);
      return;
    }
  } catch {
    // fall through
  }
  await Linking.openURL(fallback).catch(() => {});
}

export function AppUpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const [force, setForce] = useState(false);
  const [message, setMessage] = useState('');
  const [storeUrlIos, setStoreUrlIos] = useState('');
  const [storeUrlAndroid, setStoreUrlAndroid] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [otaAvailable, setOtaAvailable] = useState(false);
  const [applying, setApplying] = useState(false);
  const checkingRef = useRef(false);

  const checkOta = useCallback(async () => {
    try {
      if (__DEV__ || !Updates.isEnabled) return false;
      const result = await Updates.checkForUpdateAsync();
      return !!result.isAvailable;
    } catch {
      return false;
    }
  }, []);

  const checkRelease = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const current = currentAppVersion();
      const [release, hasOta] = await Promise.all([
        api.content.appRelease().catch(() => null),
        checkOta(),
      ]);
      setOtaAvailable(hasOta);

      const storeNewer =
        !!release?.latestVersion && isNewer(release.latestVersion, current);

      if (!storeNewer && !hasOta) {
        setVisible(false);
        return;
      }

      if (storeNewer && release) {
        const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (!release.force && dismissed === release.latestVersion && !hasOta) return;
        setForce(!!release.force);
        setLatestVersion(release.latestVersion);
        setStoreUrlIos(release.iosUrl || '');
        setStoreUrlAndroid(release.androidUrl || '');
        setMessage(
          hasOta
            ? `Une mise à jour est prête à être installée (v${release.latestVersion}).`
            : release.message ||
                `Une nouvelle version de Bag'up (${release.latestVersion}) est disponible sur le store.`,
        );
      } else {
        setForce(false);
        setLatestVersion('');
        setMessage('Une mise à jour Bag’up est prête. Installez-la maintenant sans passer par le store.');
      }
      setVisible(true);
    } catch {
      // ignore
    } finally {
      checkingRef.current = false;
    }
  }, [checkOta]);

  useEffect(() => {
    checkRelease();
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') checkRelease();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [checkRelease]);

  const applyUpdate = async () => {
    if (applying) return;
    setApplying(true);
    try {
      if (!__DEV__ && Updates.isEnabled) {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return;
        }
      }
      // Pas d’OTA (ou déjà à jour côté JS) → fiche store native
      await openStore(storeUrlIos, storeUrlAndroid);
    } catch {
      await openStore(storeUrlIos, storeUrlAndroid);
    } finally {
      setApplying(false);
    }
  };

  const dismiss = async () => {
    if (force || applying) return;
    try {
      if (latestVersion) {
        await AsyncStorage.setItem(DISMISS_KEY, latestVersion);
      }
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const primaryLabel = applying
    ? 'Installation…'
    : otaAvailable
      ? 'Installer maintenant'
      : 'Mettre à jour';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-download-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.body}>{message}</Text>
          {latestVersion ? (
            <Text style={styles.versionMeta}>Version {latestVersion}</Text>
          ) : null}
          {!otaAvailable ? (
            <Text style={styles.hint}>
              Vous serez redirigé vers {Platform.OS === 'ios' ? 'l’App Store' : 'le Play Store'} pour installer la version.
            </Text>
          ) : (
            <Text style={styles.hint}>Installation directe dans l’app, puis redémarrage automatique.</Text>
          )}
          <TouchableOpacity
            style={[styles.primary, applying && styles.primaryDisabled]}
            onPress={applyUpdate}
            activeOpacity={0.85}
            disabled={applying}
          >
            {applying ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>
          {!force ? (
            <TouchableOpacity onPress={dismiss} style={styles.later} activeOpacity={0.8} disabled={applying}>
              <Text style={styles.laterText}>Plus tard</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E6F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.gray900,
  },
  body: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },
  versionMeta: {
    marginTop: Spacing.xs,
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  hint: {
    marginTop: Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    lineHeight: 16,
  },
  primary: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.85 },
  primaryText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
  },
  later: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm },
  laterText: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
  },
});
