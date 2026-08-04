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
  // Each app in this monorepo is a SEPARATE EAS project — separate bundle
  // id, separate store listing, separate build. A single root-level
  // app.json cannot serve all three; `eas build` resolves the config from
  // the app directory it runs in (see .github/workflows/mobile-ci.yml,
  // which sets working-directory: apps/<app>).
  owner: 'newell-team',
  extra: {
    eas: {
      // Run `npx eas-cli@latest init` inside apps/rider to create this app's
      // own EAS project and paste the id it prints here.
      projectId: process.env.EAS_PROJECT_ID_RIDER,
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
