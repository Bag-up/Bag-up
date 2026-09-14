import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bagup.rideLiveActivity';
const ANDROID_NOTIF_ID = 'bagup-ride-live';

export type RideLiveSnapshot = {
  rideId: string;
  status: string;
  title: string;
  subtitle: string;
  /** Epoch ms countdown target (arrival). */
  endsAt?: number | null;
};

type Stored = { rideId: string; activityId?: string };

let memory: Stored | null = null;

async function loadStored(): Promise<Stored | null> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    memory = null;
  }
  return memory;
}

async function saveStored(next: Stored | null) {
  memory = next;
  try {
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isActiveRide(status: string) {
  return ['assigned', 'driver_en_route', 'driver_arrived', 'in_progress'].includes(status);
}

async function syncIos(snapshot: RideLiveSnapshot | null) {
  let LiveActivity: typeof import('expo-live-activity') | null = null;
  try {
    LiveActivity = await import('expo-live-activity');
  } catch {
    return;
  }
  if (!LiveActivity?.startActivity) return;

  const stored = await loadStored();
  if (!snapshot || !isActiveRide(snapshot.status)) {
    if (stored?.activityId) {
      try {
        LiveActivity.stopActivity(stored.activityId, {
          title: snapshot?.title || 'Course terminée',
          subtitle: snapshot?.subtitle || '',
          progressBar: { progress: 1 },
        });
      } catch {
        // ignore
      }
    }
    await saveStored(null);
    return;
  }

  const state = {
    title: snapshot.title,
    subtitle: snapshot.subtitle || undefined,
    progressBar: snapshot.endsAt
      ? { date: snapshot.endsAt }
      : { progress: snapshot.status === 'driver_arrived' ? 0.95 : 0.45 },
  };
  const config = {
    backgroundColor: '#FFFFFF',
    titleColor: '#111827',
    subtitleColor: '#4B5563',
    progressViewTint: '#0D8F8F',
    progressViewLabelColor: '#0D8F8F',
    deepLinkUrl: `bagup://ride/${snapshot.rideId}`,
    padding: 16,
    imagePosition: 'right' as const,
  };

  try {
    if (stored?.activityId && stored.rideId === snapshot.rideId) {
      LiveActivity.updateActivity(stored.activityId, state);
      return;
    }
    if (stored?.activityId && stored.rideId !== snapshot.rideId) {
      try {
        LiveActivity.stopActivity(stored.activityId, state);
      } catch {
        // ignore
      }
    }
    const activityId = LiveActivity.startActivity(state, config);
    if (activityId) {
      await saveStored({ rideId: snapshot.rideId, activityId });
    }
  } catch (e) {
    console.warn('[live-activity] iOS sync failed', e);
  }
}

async function syncAndroid(snapshot: RideLiveSnapshot | null) {
  const Notifications = await import('expo-notifications').catch(() => null);
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(ANDROID_NOTIF_ID);
  } catch {
    // ignore
  }
  if (!snapshot || !isActiveRide(snapshot.status)) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ANDROID_NOTIF_ID,
      content: {
        title: snapshot.title,
        body: snapshot.subtitle,
        data: { rideId: snapshot.rideId, type: 'ride_live' },
        sticky: true,
        autoDismiss: false,
        sound: undefined,
        channelId: 'rides',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[live-activity] Android sticky failed', e);
  }
}

/** Lock screen / Dynamic Island (iOS) ou notif persistante (Android). */
export async function syncRideLiveActivity(snapshot: RideLiveSnapshot | null) {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'ios') {
    await syncIos(snapshot);
    return;
  }
  if (Platform.OS === 'android') {
    await syncAndroid(snapshot);
  }
}
