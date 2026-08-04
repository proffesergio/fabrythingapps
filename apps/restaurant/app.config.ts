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
  // Each app in this monorepo is a SEPARATE EAS project — separate bundle
  // id, separate store listing, separate build. A single root-level
  // app.json cannot serve all three; `eas build` resolves the config from
  // the app directory it runs in (see .github/workflows/mobile-ci.yml,
  // which sets working-directory: apps/<app>).
  owner: 'newell-team',
  extra: {
    eas: {
      projectId: '3d2bf863-0715-4144-88f9-ee2dcd9edfc2',
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
};

export default config;
