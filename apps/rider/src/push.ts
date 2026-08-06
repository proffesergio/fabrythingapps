import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerForPush } from '@fabrything/core';
import { api } from './providers';

const APP = 'rider' as const;

// Without a handler, expo-notifications silently swallows a push that arrives
// while the app is in the FOREGROUND. A delivery offer expires in 60s
// (DeliveryOffer TTL), so a rider sitting on the home screen would watch their
// offers lapse with no sound and no banner. Backgrounded pushes are unaffected.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPush() {
  try {
    if (Platform.OS === 'android') {
      // Android will not make a sound for a notification unless its channel
      // says so, whatever the payload asks for. Riders work with the phone in
      // a pocket — a silent offer is a missed offer.
      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Delivery offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
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
