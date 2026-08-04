import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fabrything',
  // Must match the slug of the EAS project `extra.eas.projectId` points at,
  // or `eas build` refuses with a project-config mismatch. This app is the
  // flagship, so it owns the plain `fabrything` project; the other two are
  // `fabrything-rider` and `fabrything-partner`.
  slug: 'fabrything',
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
  // Each app in this monorepo is a SEPARATE EAS project — separate bundle
  // id, separate store listing, separate build. A single root-level
  // app.json cannot serve all three; `eas build` resolves the config from
  // the app directory it runs in (see .github/workflows/mobile-ci.yml,
  // which sets working-directory: apps/<app>).
  owner: 'newell-team',
  extra: {
    eas: {
      projectId: '92040208-7e5b-4457-ae2b-f985a31cb97f',
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
