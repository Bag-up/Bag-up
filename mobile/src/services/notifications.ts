import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

export type PushNavPayload = {
  type?: string;
  missionId?: string;
  rideId?: string;
  reservationId?: string;
  orderId?: string;
  status?: string;
  vehicleMode?: string;
  offerId?: string;
};

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

/** Expo Go (SDK 53+) no longer supports remote push on Android. */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Notifications) return Notifications;
  if (Platform.OS === 'web') return null;
  try {
    Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  } catch (e) {
    console.warn('[push] expo-notifications unavailable', e);
    return null;
  }
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId
  );
}

export function playAlertSound() {
  // reserved — system sound via notification channel
}

/**
 * Register Expo push token and send it to the API.
 * No-op in Expo Go (remote push removed since SDK 53) — use a development build.
 */
export async function registerForPushNotifications(authToken: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Avoid calling getExpoPushTokenAsync in Expo Go — it throws a red LogBox error on Android.
  if (isExpoGo()) {
    if (__DEV__) {
      console.log('[push] skip remote push in Expo Go — use npm run build:dev:android');
    }
    return null;
  }

  const Mod = await loadNotifications();
  if (!Mod) return null;

  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) {
      console.warn('[push] physical device required');
      return null;
    }

    const { status: existing } = await Mod.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Mod.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] permission denied');
      return null;
    }

    if (Platform.OS === 'android') {
      await Mod.setNotificationChannelAsync('default', {
        name: "Bag'up",
        importance: Mod.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D8F8F',
      });
      await Mod.setNotificationChannelAsync('rides', {
        name: "Bag'up Courses",
        importance: Mod.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F7E300',
        sound: 'default',
      });
    }

    const pid = projectId();
    const tokenRes = pid
      ? await Mod.getExpoPushTokenAsync({ projectId: pid })
      : await Mod.getExpoPushTokenAsync();
    const expoToken = tokenRes.data;
    if (!expoToken) return null;

    await api.notifications.registerFcmToken(expoToken, authToken);
    return expoToken;
  } catch (e) {
    console.warn('[push] register failed', e);
    return null;
  }
}

export function parsePushData(raw: unknown): PushNavPayload {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  return {
    type: typeof d.type === 'string' ? d.type : undefined,
    missionId: typeof d.missionId === 'string' ? d.missionId : undefined,
    rideId: typeof d.rideId === 'string' ? d.rideId : undefined,
    reservationId: typeof d.reservationId === 'string' ? d.reservationId : undefined,
    orderId: typeof d.orderId === 'string' ? d.orderId : undefined,
    status: typeof d.status === 'string' ? d.status : undefined,
    vehicleMode: typeof d.vehicleMode === 'string' ? d.vehicleMode : undefined,
    offerId: typeof d.offerId === 'string' ? d.offerId : undefined,
  };
}

/** Payload of the notification that opened the app (cold start). */
export async function getInitialPushPayload(): Promise<PushNavPayload | null> {
  if (isExpoGo() || Platform.OS === 'web') return null;
  const Mod = await loadNotifications();
  if (!Mod) return null;
  try {
    const response = await Mod.getLastNotificationResponseAsync();
    if (!response) return null;
    return parsePushData(response.notification.request.content.data);
  } catch {
    return null;
  }
}

/** Attach listeners. Returns cleanup. Call only after login / NavigationContainer ready. */
export function setupNotificationListener(
  onReceive: (notification: unknown) => void,
  onResponse: (payload: PushNavPayload) => void,
): () => void {
  if (isExpoGo() || Platform.OS === 'web') {
    return () => {};
  }

  let receiveSub: { remove: () => void } | null = null;
  let responseSub: { remove: () => void } | null = null;
  let cancelled = false;

  loadNotifications().then((Mod) => {
    if (!Mod || cancelled) return;
    receiveSub = Mod.addNotificationReceivedListener((notification) => {
      onReceive(notification);
    });
    responseSub = Mod.addNotificationResponseReceivedListener((response) => {
      onResponse(parsePushData(response.notification.request.content.data));
    });
  });

  return () => {
    cancelled = true;
    receiveSub?.remove();
    responseSub?.remove();
  };
}

export const pushAvailable = Platform.OS !== 'web' && !isExpoGo();
