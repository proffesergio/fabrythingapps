import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fabrything',
  slug: 'fabrything-customer',
  scheme: 'fabrythingcustomer',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.fabrything.customer',
    supportsTablet: false,
  },
  android: {
    package: 'com.fabrything.customer',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#E8452B',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#E8452B',
      },
    ],
  ],
};

export default config;
