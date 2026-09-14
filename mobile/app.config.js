/**
 * Config Expo — mode crash-test retire Maps / plugins lourds.
 */
const appJson = require('./app.json');

const androidMapsKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  'AIzaSyB4ZzStzHqkSuHeQ2Ae-Wup1Z64BhTF7uQ';
const iosMapsKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY ||
  'AIzaSyCEP2CFaBOmY3PTXa5GNJMtLSP5pxAAI28';
const webMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY || '';
const crashTest =
  process.env.EXPO_PUBLIC_CRASH_TEST === '1' ||
  process.env.APP_ENV === 'crash-test';

module.exports = ({ config }) => {
  const expo = JSON.parse(JSON.stringify(appJson.expo || config));

  if (crashTest) {
    // Package Android différent = nouvelle icône (pas l'APK Play qui crash)
    // slug reste "bagup" pour matcher extra.eas.projectId
    expo.name = "Bag'up DIAG";
    expo.version = '1.0.1-diag';
    expo.plugins = ['expo-font', 'expo-splash-screen'];
    expo.android = {
      ...expo.android,
      package: 'sn.bagup.diag',
      versionCode: 99,
      adaptiveIcon: expo.android?.adaptiveIcon,
      usesCleartextTraffic: true,
      edgeToEdgeEnabled: false,
      permissions: [],
      intentFilters: [],
      config: {},
    };
    delete expo.ios?.config?.googleMapsApiKey;
    expo.ios = {
      ...expo.ios,
      bundleIdentifier: 'sn.bagup.diag',
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        ...(expo.ios?.infoPlist || {}),
        CFBundleDisplayName: "Bag'up DIAG",
      },
    };
    expo.updates = { enabled: false };
    delete expo.runtimeVersion;
    return { expo };
  }

  expo.ios = {
    ...expo.ios,
    config: {
      ...(expo.ios?.config || {}),
      usesNonExemptEncryption: expo.ios?.config?.usesNonExemptEncryption ?? false,
      googleMapsApiKey: iosMapsKey,
    },
  };

  expo.android = {
    ...expo.android,
    usesCleartextTraffic: false,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || expo.android?.googleServicesFile || './google-services.json',
    config: {
      ...(expo.android?.config || {}),
      googleMaps: { apiKey: androidMapsKey },
    },
  };

  // API en HTTPS uniquement en production
  const plugins = [...(expo.plugins || [])];
  plugins.push([
    'expo-build-properties',
    {
      android: {
        usesCleartextTraffic: false,
      },
    },
  ]);
  expo.plugins = plugins;

  expo.extra = {
    ...(expo.extra || {}),
    googleMapsWebApiKey: webMapsKey,
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://admin.bagup.app/api',
  };

  return { expo };
};
