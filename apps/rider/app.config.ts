import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fabrything Rider',
  slug: 'fabrything-rider',
  scheme: 'fabrythingrider',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.fabrything.rider',
    supportsTablet: false,
  },
  android: {
    package: 'com.fabrything.rider',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#17110E',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    'expo-asset',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Fabrything Rider uses your location to share it with dispatch while you are online.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#17110E',
      },
    ],
  ],
};

export default config;
