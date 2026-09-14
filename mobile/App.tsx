import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, useWindowDimensions, InteractionManager, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts, Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SplashScreen } from './src/screens/auth/SplashScreen';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { HomeScreen } from './src/screens/client/HomeScreen';
import { MessagesScreen } from './src/screens/client/MessagesScreen';
import { CreateRequestScreen } from './src/screens/client/CreateRequestScreen';
import { PaymentScreen } from './src/screens/client/PaymentScreen';
import { PaymentsScreen } from './src/screens/client/PaymentsScreen';
import { ActivityScreen } from './src/screens/client/ActivityScreen';
import { ChatScreen } from './src/screens/client/ChatScreen';
import { NotificationsScreen } from './src/screens/client/NotificationsScreen';
import {
  registerForPushNotifications,
  setupNotificationListener,
  getInitialPushPayload,
  parsePushData,
  type PushNavPayload,
} from './src/services/notifications';
import { AntiGaspiBrowseScreen } from './src/screens/client/AntiGaspiBrowseScreen';
import { AntiGaspiBasketDetailScreen } from './src/screens/client/AntiGaspiBasketDetailScreen';
import { AntiGaspiPaymentScreen } from './src/screens/client/AntiGaspiPaymentScreen';
import { AntiGaspiReservationsScreen } from './src/screens/client/AntiGaspiReservationsScreen';
import { ProviderDashboard } from './src/screens/provider/ProviderDashboard';
import { DemarchesHome } from './src/screens/provider/DemarchesHome';
import { isDemarchesProvider } from './src/constants/demarches';
import { ProviderMissionsScreen } from './src/screens/provider/ProviderMissionsScreen';
import { ProviderEarningsScreen } from './src/screens/provider/ProviderEarningsScreen';
import { ProviderProfileScreen } from './src/screens/provider/ProviderProfileScreen';
import { PendingVerificationScreen } from './src/screens/provider/PendingVerificationScreen';
import { ProviderPaymentScreen } from './src/screens/provider/ProviderPaymentScreen';
import { MerchantDashboard } from './src/screens/merchant/MerchantDashboard';
import { MerchantHubScreen } from './src/screens/merchant/MerchantHubScreen';
import { MerchantBasketsScreen } from './src/screens/merchant/MerchantBasketsScreen';
import { MerchantPublishBasketScreen } from './src/screens/merchant/MerchantPublishBasketScreen';
import { MerchantReservationsScreen } from './src/screens/merchant/MerchantReservationsScreen';
import { MerchantPayoutsScreen } from './src/screens/merchant/MerchantPayoutsScreen';
import { MerchantProfileScreen } from './src/screens/merchant/MerchantProfileScreen';
import { MerchantReservationDetailScreen } from './src/screens/merchant/MerchantReservationDetailScreen';
import { ShopHubScreen } from './src/screens/merchant/ShopHubScreen';
import { ShopEditScreen } from './src/screens/merchant/ShopEditScreen';
import { ShopProductsScreen } from './src/screens/merchant/ShopProductsScreen';
import { ShopProductEditScreen } from './src/screens/merchant/ShopProductEditScreen';
import { ShopSubscriptionScreen } from './src/screens/merchant/ShopSubscriptionScreen';
import { ShopOrdersScreen } from './src/screens/merchant/ShopOrdersScreen';
import { ShopOrderDetailScreen } from './src/screens/merchant/ShopOrderDetailScreen';
import { MarketHomeScreen } from './src/screens/client/MarketHomeScreen';
import { MarketShopScreen } from './src/screens/client/MarketShopScreen';
import { MarketProductScreen } from './src/screens/client/MarketProductScreen';
import { MarketCheckoutScreen } from './src/screens/client/MarketCheckoutScreen';
import { MarketOrdersScreen } from './src/screens/client/MarketOrdersScreen';
import { MarketOrderDetailScreen } from './src/screens/client/MarketOrderDetailScreen';
import { OtpVerificationScreen } from './src/screens/auth/OtpVerificationScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LoyaltyScreen } from './src/screens/client/LoyaltyScreen';
import { TermsOfServiceScreen } from './src/screens/TermsOfServiceScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UserLocationProvider } from './src/context/UserLocationContext';
import { AppUpdatePrompt } from './src/components/AppUpdatePrompt';
import { MARKETPLACE_ENABLED } from './src/constants/marketplace';
import { resolveMerchantChannels } from './src/constants/merchantChannels';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// Maps chargé à la demande (évite crash natif / bundling web react-native-maps)
const TrackingScreenLazy = React.lazy(() =>
  import('./src/screens/client/TrackingScreen').then((m) => ({ default: m.TrackingScreen })),
);
const RideRequestScreenLazy = React.lazy(() =>
  import('./src/screens/client/RideRequestScreen').then((m) => ({ default: m.RideRequestScreen })),
);

function MapSuspenseFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#0D8F8F" />
    </View>
  );
}

function TrackingScreen(props: any) {
  return (
    <React.Suspense fallback={<MapSuspenseFallback />}>
      <TrackingScreenLazy {...props} />
    </React.Suspense>
  );
}

function RideRequestScreen(props: any) {
  return (
    <React.Suspense fallback={<MapSuspenseFallback />}>
      <RideRequestScreenLazy {...props} />
    </React.Suspense>
  );
}

type RootStackParamList = {
  Login: undefined;
  OtpVerification: undefined;
  PendingVerification: undefined;
  ProviderSubscriptionGate: undefined;
  MerchantSubscriptionGate: undefined;
  ProviderPayment: undefined;
  ProviderMain: undefined;
  MerchantMain: undefined;
  MerchantPublish: undefined;
  MerchantReservationDetail: { reservationId: string } | undefined;
  ShopEdit: undefined;
  ShopProducts: undefined;
  ShopProductEdit: { productId?: string } | undefined;
  ShopSubscription: undefined;
  ShopOrders: undefined;
  ShopOrderDetail: { orderId: string };
  ClientMain: undefined;
  CreateRequest: { serviceType?: string; prefilledDelivery?: string; prefilledDeliveryCoords?: { lat: number; lng: number } } | undefined;
  RideRequest: { rideId?: string } | undefined;
  Tracking: { missionId?: string } | undefined;
  Payments: undefined;
  Loyalty: undefined;
  Payment: { missionId?: string; rideId?: string; amount?: number } | undefined;
  Chat: { conversationId?: string; name?: string } | undefined;
  Notifications: undefined;
  AntiGaspiBrowse: undefined;
  AntiGaspiBasket: { basketId: string };
  AntiGaspiPayment: { reservationId: string; amount: number };
  AntiGaspiReservations: undefined;
  MarketHome: undefined;
  MarketShop: { shopId: string };
  MarketProduct: { productId: string };
  MarketCheckout: { productId: string };
  MarketOrders: undefined;
  MarketOrderDetail: { orderId: string };
  TermsOfService: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function useTabScreenOptions(itemCount: number) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const compactWidth = width <= 360;
    const compactHeight = height <= 700;
    const crowded = itemCount >= 5;
    const labelFontSize = crowded ? (compactWidth ? 9 : 10) : 11;
    const iconSize = crowded ? (compactWidth ? 18 : 20) : 22;
    const tabHeight = crowded || compactHeight ? 64 : 72;
    const bottomPadding = Math.max(insets.bottom, compactHeight ? 8 : 12);

    return {
      headerShown: false,
      tabBarActiveTintColor: '#0D8F8F',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarHideOnKeyboard: true,
      tabBarAllowFontScaling: false,
      tabBarLabelStyle: {
        fontSize: labelFontSize,
        lineHeight: labelFontSize + 2,
        marginBottom: compactWidth ? 1 : 2,
      },
      tabBarItemStyle: {
        paddingHorizontal: crowded ? 0 : 2,
      },
      tabBarIconStyle: {
        marginBottom: compactWidth ? 0 : 2,
      },
      tabBarStyle: {
        backgroundColor: '#FFF',
        borderTopWidth: 0,
        height: tabHeight + bottomPadding,
        paddingTop: crowded ? 6 : 8,
        paddingBottom: bottomPadding,
      },
      tabBarLabelPosition: 'below-icon' as const,
      tabBarIcon: ({ color, focused, size }: { color: string; focused: boolean; size: number }) => null,
      tabBarBadgeStyle: undefined,
      sceneStyle: {
        backgroundColor: '#F8FAFB',
      },
      iconSize,
    };
  }, [height, insets.bottom, itemCount, width]);
}

function ClientTabs() {
  const tabOptions = useTabScreenOptions(4);
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home" options={{ tabBarLabel: 'Accueil', tabBarIcon: ({ color }) => <Ionicons name="home" size={tabOptions.iconSize} color={color} /> }}>
        {({ navigation }) => <HomeScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Activity" options={{ tabBarLabel: 'Commandes', tabBarIcon: ({ color }) => <Ionicons name="receipt" size={tabOptions.iconSize} color={color} /> }}>
        {({ navigation }) => <ActivityScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Messages" options={{ tabBarLabel: 'Messages', tabBarIcon: ({ color }) => <Ionicons name="chatbubble" size={tabOptions.iconSize} color={color} /> }}>
        {({ navigation }) => <MessagesScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color }) => <Ionicons name="person" size={tabOptions.iconSize} color={color} /> }}>
        {({ navigation }) => <ProfileScreen onLogout={() => {}} navigation={navigation} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function ProviderTabs() {
  const { user } = useAuth();
  const demarches = isDemarchesProvider(user);
  const tabOptions = useTabScreenOptions(4);
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="PDashboard"
        component={demarches ? DemarchesHome : ProviderDashboard}
        options={{
          tabBarLabel: demarches ? 'Démarches' : 'Accueil',
          tabBarIcon: ({ color }) => <Ionicons name={demarches ? 'briefcase' : 'grid'} size={tabOptions.iconSize} color={color} />,
        }}
      />
      <Tab.Screen name="PMissions" component={ProviderMissionsScreen} options={{ tabBarLabel: demarches ? 'Dossiers' : 'Missions', tabBarIcon: ({ color }) => <Ionicons name={demarches ? 'folder-open' : 'bicycle'} size={tabOptions.iconSize} color={color} /> }} />
      <Tab.Screen name="PRevenus" component={ProviderEarningsScreen} options={{ tabBarLabel: 'Revenus', tabBarIcon: ({ color }) => <Ionicons name="wallet" size={tabOptions.iconSize} color={color} /> }} />
      <Tab.Screen name="PProfile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color }) => <Ionicons name="person" size={tabOptions.iconSize} color={color} /> }}>
        {() => <ProviderProfileScreen onLogout={() => {}} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MerchantTabs() {
  const { user } = useAuth();
  const channels = resolveMerchantChannels(user?.merchantChannels);
  const showMarket = channels.marketplace;
  const showAntiGaspi = channels.antigaspi;
  const dual = showMarket && showAntiGaspi;

  let tabCount = 1; // Profil
  if (dual) tabCount += 4; // Accueil hub + Paniers + Retrait + Boutique
  else if (showAntiGaspi) tabCount += 4; // Accueil + Paniers + Retrait + Revenus
  else if (showMarket) tabCount += 1; // Boutique
  const tabOptions = useTabScreenOptions(Math.max(tabCount, 2));
  const hiddenTab = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      {dual ? (
        <Tab.Screen
          name="MHub"
          component={MerchantHubScreen}
          options={{
            tabBarLabel: 'Accueil',
            tabBarIcon: ({ color }) => <Ionicons name="grid" size={tabOptions.iconSize} color={color} />,
          }}
        />
      ) : showAntiGaspi ? (
        <Tab.Screen
          name="MDashboard"
          component={MerchantDashboard}
          options={{
            tabBarLabel: 'Accueil',
            tabBarIcon: ({ color }) => <Ionicons name="grid" size={tabOptions.iconSize} color={color} />,
          }}
        />
      ) : showMarket ? (
        <Tab.Screen
          name="MShopHome"
          component={ShopHubScreen}
          options={{
            tabBarLabel: 'Boutique',
            tabBarIcon: ({ color }) => <Ionicons name="storefront" size={tabOptions.iconSize} color={color} />,
          }}
        />
      ) : null}

      {dual && (
        <Tab.Screen
          name="MAntiGaspi"
          component={MerchantDashboard}
          options={{ tabBarLabel: 'Anti-Gaspi', ...hiddenTab }}
        />
      )}

      {showAntiGaspi && (
        <>
          <Tab.Screen
            name="MBaskets"
            component={MerchantBasketsScreen}
            options={{
              tabBarLabel: 'Paniers',
              tabBarIcon: ({ color }) => <Ionicons name="basket" size={tabOptions.iconSize} color={color} />,
            }}
          />
          <Tab.Screen
            name="MReservations"
            component={MerchantReservationsScreen}
            options={{
              tabBarLabel: 'Retrait',
              tabBarIcon: ({ color }) => <Ionicons name="checkmark-done" size={tabOptions.iconSize} color={color} />,
            }}
          />
          {!dual && (
            <Tab.Screen
              name="MPayouts"
              component={MerchantPayoutsScreen}
              options={{
                tabBarLabel: 'Revenus',
                tabBarIcon: ({ color }) => <Ionicons name="wallet" size={tabOptions.iconSize} color={color} />,
              }}
            />
          )}
          {dual && (
            <Tab.Screen name="MPayouts" component={MerchantPayoutsScreen} options={hiddenTab} />
          )}
        </>
      )}

      {dual && (
        <Tab.Screen
          name="MShop"
          component={ShopHubScreen}
          options={{
            tabBarLabel: 'Boutique',
            tabBarIcon: ({ color }) => <Ionicons name="storefront" size={tabOptions.iconSize} color={color} />,
          }}
        />
      )}

      <Tab.Screen
        name="MProfile"
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={tabOptions.iconSize} color={color} />,
        }}
      >
        {() => <MerchantProfileScreen onLogout={() => {}} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const { user, token, isLoading: authLoading, logout, refreshUser } = useAuth();
  const navRef = useRef<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding')
      .then((seen) => { if (seen === 'true') setShowOnboarding(false); })
      .finally(() => setOnboardingLoaded(true));
  }, []);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    AsyncStorage.setItem('hasSeenOnboarding', 'true').catch(() => {});
  };

  const [fontsLoaded, fontError] = useFonts({
    Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold,
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    // Play Store / réseau lent : expo-google-fonts peut rester bloqué sans error.
    const t = setTimeout(() => setFontsTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    refreshUser().catch(() => {});
  }, [token]);

  const fontsReady = !!fontsLoaded || !!fontError || fontsTimedOut;
  const appReady = fontsReady && !authLoading && onboardingLoaded;

  useEffect(() => {
    if (!appReady) return;
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  // Filet de sécurité : ne jamais rester collé au splash natif.
  useEffect(() => {
    const t = setTimeout(() => {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Push: after auth + interactions settle — avoids Android blanking Home tiles under Modal/FCM race
  useEffect(() => {
    if (!token || !user?.phoneVerified) return;
    let cancelled = false;
    let interactionTask: { cancel: () => void } | null = null;
    const t = setTimeout(() => {
      if (cancelled) return;
      interactionTask = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        registerForPushNotifications(token).catch(() => {});
      });
    }, Platform.OS === 'android' ? 1500 : 800);

    const navigateFromPush = (payload: PushNavPayload) => {
      const nav = navRef.current;
      if (!nav) return;

      if (payload.type === 'ride_taken' || payload.type === 'ride_offer_cancelled') {
        if (user?.role === 'provider') {
          Alert.alert(
            payload.type === 'ride_taken' ? 'Course déjà prise' : 'Course annulée',
            payload.type === 'ride_taken'
              ? 'Un autre chauffeur a accepté cette course.'
              : 'Cette offre n’est plus disponible.',
          );
          nav.navigate('ProviderMain', { screen: 'PDashboard' });
        }
        return;
      }

      const isRidePush =
        !!payload.rideId ||
        payload.type === 'new_ride' ||
        payload.type === 'ride_offer' ||
        payload.type === 'ride_assigned' ||
        payload.type === 'ride_cancelled' ||
        payload.type === 'ride_status';

      if (isRidePush) {
        if (user?.role === 'provider') {
          const screen =
            payload.type === 'new_ride' ||
            payload.type === 'ride_offer' ||
            payload.type === undefined
              ? 'PDashboard'
              : 'PMissions';
          nav.navigate('ProviderMain', {
            screen,
            params: payload.rideId ? { focusRideId: payload.rideId } : undefined,
          });
          return;
        }
        if (payload.rideId) {
          nav.navigate('RideRequest', { rideId: payload.rideId });
          return;
        }
      }

      if (payload.type === 'new_mission' && user?.role === 'provider') {
        nav.navigate('ProviderMain', {
          screen: 'PDashboard',
          params: payload.missionId ? { focusMissionId: payload.missionId } : undefined,
        });
        return;
      }

      if (payload.missionId) {
        nav.navigate('Tracking', { missionId: payload.missionId });
        return;
      }
      if (payload.orderId) {
        nav.navigate('MarketOrderDetail', { orderId: payload.orderId });
        return;
      }
      if (payload.type === 'loyalty') {
        nav.navigate('Loyalty');
        return;
      }
      if (payload.reservationId || payload.type === 'antigaspi') {
        if (user?.role === 'merchant') {
          nav.navigate('MerchantMain', { screen: 'MReservations' });
        } else {
          nav.navigate('AntiGaspiReservations');
        }
        return;
      }
      if (payload.type === 'marketplace_order' || payload.type === 'marketplace_payout') {
        nav.navigate('MarketOrders');
      }
    };

    const cleanup = setupNotificationListener(
      (notification) => {
        const raw =
          notification &&
          typeof notification === 'object' &&
          'request' in (notification as object)
            ? (notification as { request?: { content?: { data?: unknown } } }).request?.content
                ?.data
            : undefined;
        const payload = parsePushData(raw);
        if (payload.type === 'ride_taken') {
          Alert.alert(
            'Course déjà prise',
            'Un autre chauffeur a accepté cette course.',
          );
        } else if (payload.type === 'ride_offer_cancelled') {
          Alert.alert('Course annulée', 'Cette offre n’est plus disponible.');
        }
      },
      (payload) => navigateFromPush(payload),
    );

    // Cold start: user tapped a notification while the app was killed
    const coldStartTimer = setTimeout(() => {
      if (cancelled) return;
      getInitialPushPayload()
        .then((payload) => {
          if (!cancelled && payload && (payload.rideId || payload.type || payload.missionId || payload.orderId)) {
            navigateFromPush(payload);
          }
        })
        .catch(() => {});
    }, Platform.OS === 'android' ? 1200 : 600);

    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(coldStartTimer);
      interactionTask?.cancel?.();
      cleanup();
    };
  }, [token, user?.phoneVerified, user?.role]);

  if (!fontsReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (authLoading || !onboardingLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (showOnboarding && !token) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  const isAuthenticated = !!token;
  const userRole = user?.role || 'client';
  const hasActiveSubscription =
    user?.subscriptionStatus === 'active' &&
    (!user?.subscriptionExpiry || new Date(user.subscriptionExpiry) > new Date());

  return (
    <View style={styles.container}>
      <NavigationContainer ref={navRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login">
              {() => <LoginScreen onLogin={() => {}} />}
            </Stack.Screen>
          ) : !user?.phoneVerified ? (
            <Stack.Screen name="OtpVerification">
              {() => (
                <OtpVerificationScreen
                  phone={user?.phone || ''}
                  onVerified={refreshUser}
                  onSkip={refreshUser}
                  onBack={logout}
                />
              )}
            </Stack.Screen>
          ) : userRole === 'merchant' ? (
            (() => {
              const channels = resolveMerchantChannels(user?.merchantChannels);
              const needsMarketplacePay =
                MARKETPLACE_ENABLED && channels.marketplace;
              if (user?.kycRejectedAt) {
                return (
                  <Stack.Screen name="PendingVerification">
                    {() => (
                      <PendingVerificationScreen
                        onLogout={logout}
                        onRefresh={refreshUser}
                        role="merchant"
                        paid={hasActiveSubscription || !!user?.subscriptionRefundPending}
                        skipPayment={!needsMarketplacePay}
                        rejected
                        rejectReason={user?.kycRejectReason}
                        refundPending={!!user?.subscriptionRefundPending}
                      />
                    )}
                  </Stack.Screen>
                );
              }
              if (needsMarketplacePay && !hasActiveSubscription) {
                return (
                  <Stack.Screen name="MerchantSubscriptionGate">
                    {() => (
                      <ShopSubscriptionScreen
                        gateMode
                        onPaid={async () => {
                          await refreshUser();
                        }}
                        onLogout={logout}
                      />
                    )}
                  </Stack.Screen>
                );
              }
              if (!user?.isVerified) {
                return (
                  <Stack.Screen name="PendingVerification">
                    {() => (
                      <PendingVerificationScreen
                        onLogout={logout}
                        onRefresh={refreshUser}
                        role="merchant"
                        paid={needsMarketplacePay ? hasActiveSubscription : true}
                        skipPayment={!needsMarketplacePay}
                      />
                    )}
                  </Stack.Screen>
                );
              }
              return (
              <>
                <Stack.Screen name="MerchantMain" component={MerchantTabs} />
                <Stack.Screen name="MerchantPublish">
                  {({ navigation }) => (
                    <MerchantPublishBasketScreen
                      onBack={() => navigation.goBack()}
                      onPublished={() =>
                        navigation.navigate('MerchantMain', { screen: 'MBaskets' })
                      }
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen
                  name="MerchantReservationDetail"
                  component={MerchantReservationDetailScreen}
                />
                <Stack.Screen name="ShopEdit" component={ShopEditScreen} />
                <Stack.Screen name="ShopProducts" component={ShopProductsScreen} />
                <Stack.Screen name="ShopProductEdit" component={ShopProductEditScreen} />
                <Stack.Screen name="ShopSubscription" component={ShopSubscriptionScreen} />
                <Stack.Screen name="ShopOrders" component={ShopOrdersScreen} />
                <Stack.Screen name="ShopOrderDetail" component={ShopOrderDetailScreen} />
                <Stack.Screen name="Notifications">
                  {({ navigation }) => (
                    <NotificationsScreen onBack={() => navigation.goBack()} navigation={navigation} />
                  )}
                </Stack.Screen>
                {MARKETPLACE_ENABLED && (
                  <Stack.Screen name="Tracking">
                    {({ navigation, route }) => (
                      <TrackingScreen
                        onBack={() => navigation.goBack()}
                        missionId={route.params?.missionId}
                        navigation={navigation}
                      />
                    )}
                  </Stack.Screen>
                )}
              </>
              );
            })()
          ) : userRole === 'provider' ? (
            user?.kycRejectedAt ? (
              <Stack.Screen name="PendingVerification">
                {() => (
                  <PendingVerificationScreen
                    onLogout={logout}
                    onRefresh={refreshUser}
                    role="provider"
                    paid={hasActiveSubscription}
                    rejected
                    rejectReason={user?.kycRejectReason}
                    refundPending={!!user?.subscriptionRefundPending}
                  />
                )}
              </Stack.Screen>
            ) : !hasActiveSubscription ? (
              <Stack.Screen name="ProviderSubscriptionGate">
                {() => (
                  <ProviderPaymentScreen
                    onPaid={async () => {
                      await refreshUser();
                    }}
                    onLogout={logout}
                  />
                )}
              </Stack.Screen>
            ) : !user?.isVerified ? (
              <Stack.Screen name="PendingVerification">
                {() => (
                  <PendingVerificationScreen
                    onLogout={logout}
                    onRefresh={refreshUser}
                    role="provider"
                    paid
                  />
                )}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="ProviderMain" component={ProviderTabs} />
                <Stack.Screen name="ProviderPayment">
                  {({ navigation }) => (
                    <ProviderPaymentScreen
                      onPaid={async () => {
                        await refreshUser();
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('ProviderMain');
                      }}
                      onBack={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('ProviderMain');
                      }}
                      onLogout={logout}
                      earlyRenew
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Tracking">
                  {({ navigation, route }) => <TrackingScreen onBack={() => { if (navigation.canGoBack()) navigation.goBack(); }} missionId={route.params?.missionId} navigation={navigation} />}
                </Stack.Screen>
                <Stack.Screen name="Chat">
                  {({ navigation, route }) => <ChatScreen onBack={() => { if (navigation.canGoBack()) navigation.goBack(); }} conversationId={route.params?.conversationId} name={route.params?.name} />}
                </Stack.Screen>
                <Stack.Screen name="Notifications">
                  {({ navigation }) => <NotificationsScreen onBack={() => { if (navigation.canGoBack()) navigation.goBack(); }} navigation={navigation} />}
                </Stack.Screen>
              </>
            )
          ) : (
            <>
              <Stack.Screen name="ClientMain" component={ClientTabs} />
              <Stack.Screen name="CreateRequest">
                {({ navigation, route }) => <CreateRequestScreen onBack={() => navigation.goBack()} onSubmit={() => navigation.goBack()} initialServiceType={route.params?.serviceType} prefilledDelivery={route.params?.prefilledDelivery} prefilledDeliveryCoords={route.params?.prefilledDeliveryCoords} navigation={navigation} />}
              </Stack.Screen>
              <Stack.Screen name="RideRequest">
                {({ navigation, route }) => (
                  <RideRequestScreen
                    onBack={() => navigation.goBack()}
                    navigation={navigation}
                    initialRideId={route.params?.rideId}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Tracking">
                {({ navigation, route }) => <TrackingScreen onBack={() => navigation.goBack()} missionId={route.params?.missionId} navigation={navigation} />}
              </Stack.Screen>
              <Stack.Screen name="Payments">
                {({ navigation }) => <PaymentsScreen onBack={() => navigation.goBack()} />}
              </Stack.Screen>
              <Stack.Screen name="Loyalty">
                {({ navigation }) => (
                  <LoyaltyScreen onBack={() => navigation.goBack()} navigation={navigation} />
                )}
              </Stack.Screen>
              <Stack.Screen name="Payment">
                {({ navigation, route }) => (
                  <PaymentScreen
                    onBack={() => navigation.goBack()}
                    onPay={() => navigation.goBack()}
                    missionId={route.params?.missionId}
                    rideId={route.params?.rideId}
                    amount={route.params?.amount}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AntiGaspiBrowse">
                {({ navigation }) => (
                  <AntiGaspiBrowseScreen
                    navigation={navigation}
                    onBack={() => {
                      if (navigation.canGoBack()) navigation.goBack();
                      else navigation.navigate('ClientMain');
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AntiGaspiBasket">
                {({ navigation, route }) => (
                  <AntiGaspiBasketDetailScreen
                    basketId={route.params.basketId}
                    onBack={() => {
                      if (navigation.canGoBack()) navigation.goBack();
                      else navigation.navigate('AntiGaspiBrowse');
                    }}
                    navigation={navigation}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AntiGaspiPayment">
                {({ navigation, route }) => (
                  <AntiGaspiPaymentScreen
                    reservationId={route.params.reservationId}
                    amount={route.params.amount}
                    onBack={() => {
                      if (navigation.canGoBack()) navigation.goBack();
                      else navigation.navigate('AntiGaspiReservations');
                    }}
                    onPaid={() => {}}
                    navigation={navigation}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AntiGaspiReservations">
                {({ navigation }) => (
                  <AntiGaspiReservationsScreen
                    onBack={() => {
                      if (navigation.canGoBack()) navigation.goBack();
                      else navigation.navigate('ClientMain');
                    }}
                    navigation={navigation}
                  />
                )}
              </Stack.Screen>
              {MARKETPLACE_ENABLED && (
                <>
                  <Stack.Screen name="MarketHome" component={MarketHomeScreen} />
                  <Stack.Screen name="MarketShop" component={MarketShopScreen} />
                  <Stack.Screen name="MarketProduct" component={MarketProductScreen} />
                  <Stack.Screen name="MarketCheckout" component={MarketCheckoutScreen} />
                  <Stack.Screen name="MarketOrders" component={MarketOrdersScreen} />
                  <Stack.Screen name="MarketOrderDetail" component={MarketOrderDetailScreen} />
                </>
              )}
              <Stack.Screen name="Chat">
                {({ navigation, route }) => <ChatScreen onBack={() => navigation.goBack()} conversationId={route.params?.conversationId} name={route.params?.name} />}
              </Stack.Screen>
              <Stack.Screen name="Notifications">
                {({ navigation }) => <NotificationsScreen onBack={() => navigation.goBack()} navigation={navigation} />}
              </Stack.Screen>
              <Stack.Screen name="TermsOfService">
                {({ navigation }) => <TermsOfServiceScreen onBack={() => navigation.goBack()} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserLocationProvider>
          <AppContent />
          <AppUpdatePrompt />
        </UserLocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  loading: { flex: 1, backgroundColor: '#0D8F8F', alignItems: 'center', justifyContent: 'center' },
});
