import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fabrything Partner',
  slug: 'fabrything-partner',
  scheme: 'fabrythingpartner',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.fabrything.restaurant',
    supportsTablet: false,
  },
  android: {
    package: 'com.fabrything.restaurant',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#F4A62A',
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
        backgroundColor: '#F4A62A',
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
};

export default config;
