import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerForPush } from '@fabrything/core';
import { api } from './providers';

const APP = 'restaurant' as const;

export async function registerPush() {
  try {
    await registerForPush(api, APP, {
      getPermissions: async () => ({ granted: (await Notifications.getPermissionsAsync()).granted }),
      requestPermissions: async () => ({ granted: (await Notifications.requestPermissionsAsync()).granted }),
      getExpoPushToken: async () => (await Notifications.getExpoPushTokenAsync()).data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
  } catch {
    // best-effort: real token needs an EAS projectId at build time; never crash the app
  }
}
