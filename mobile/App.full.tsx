import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts, Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import { AntiGaspiBrowseScreen } from './src/screens/client/AntiGaspiBrowseScreen';
import { AntiGaspiBasketDetailScreen } from './src/screens/client/AntiGaspiBasketDetailScreen';
import { AntiGaspiPaymentScreen } from './src/screens/client/AntiGaspiPaymentScreen';
import { AntiGaspiReservationsScreen } from './src/screens/client/AntiGaspiReservationsScreen';
import { ProviderDashboard } from './src/screens/provider/ProviderDashboard';
import { ProviderMissionsScreen } from './src/screens/provider/ProviderMissionsScreen';
import { ProviderEarningsScreen } from './src/screens/provider/ProviderEarningsScreen';
import { ProviderProfileScreen } from './src/screens/provider/ProviderProfileScreen';
import { PendingVerificationScreen } from './src/screens/provider/PendingVerificationScreen';
import { ProviderPaymentScreen } from './src/screens/provider/ProviderPaymentScreen';
import { MerchantDashboard } from './src/screens/merchant/MerchantDashboard';
import { MerchantBasketsScreen } from './src/screens/merchant/MerchantBasketsScreen';
import { MerchantPublishBasketScreen } from './src/screens/merchant/MerchantPublishBasketScreen';
import { MerchantReservationsScreen } from './src/screens/merchant/MerchantReservationsScreen';
import { MerchantPayoutsScreen } from './src/screens/merchant/MerchantPayoutsScreen';
import { MerchantProfileScreen } from './src/screens/merchant/MerchantProfileScreen';
import { MerchantReservationDetailScreen } from './src/screens/merchant/MerchantReservationDetailScreen';
import { OtpVerificationScreen } from './src/screens/auth/OtpVerificationScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Maps chargé à la demande (évite crash natif au démarrage si clé Maps absente)
const TrackingScreenLazy = React.lazy(() =>
  import('./src/screens/client/TrackingScreen').then((m) => ({ default: m.TrackingScreen })),
);

function TrackingScreen(props: any) {
  return (
    <React.Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#0D8F8F" />
        </View>
      }
    >
      <TrackingScreenLazy {...props} />
    </React.Suspense>
  );
}

type RootStackParamList = {
  Login: undefined;
  OtpVerification: undefined;
  PendingVerification: undefined;
  ProviderSubscriptionGate: undefined;
  ProviderPayment: undefined;
  ProviderMain: undefined;
  MerchantMain: undefined;
  MerchantPublish: undefined;
  ClientMain: undefined;
  CreateRequest: { serviceType?: string; prefilledDelivery?: string; prefilledDeliveryCoords?: { lat: number; lng: number } } | undefined;
  Tracking: { missionId?: string } | undefined;
  Payments: undefined;
  Payment: { missionId?: string; amount?: number } | undefined;
  Chat: { conversationId?: string; name?: string } | undefined;
  Notifications: undefined;
  AntiGaspiBrowse: undefined;
  AntiGaspiBasket: { basketId: string };
  AntiGaspiPayment: { reservationId: string; amount: number };
  AntiGaspiReservations: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function ClientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarActiveTintColor: '#0D8F8F', tabBarInactiveTintColor: '#9CA3AF', tabBarIconStyle: { marginBottom: 2 } }}>
      <Tab.Screen name="Home" options={{ tabBarLabel: 'Accueil', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}>
        {({ navigation }) => <HomeScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Activity" options={{ tabBarLabel: 'Activité', tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} /> }}>
        {({ navigation }) => <ActivityScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Messages" options={{ tabBarLabel: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble" size={size} color={color} /> }}>
        {({ navigation }) => <MessagesScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}>
        {({ navigation }) => <ProfileScreen onLogout={() => {}} navigation={navigation} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function ProviderTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarActiveTintColor: '#0D8F8F', tabBarInactiveTintColor: '#9CA3AF', tabBarIconStyle: { marginBottom: 2 } }}>
      <Tab.Screen name="PDashboard" component={ProviderDashboard} options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tab.Screen name="PMissions" component={ProviderMissionsScreen} options={{ tabBarLabel: 'Missions', tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} /> }} />
      <Tab.Screen name="PRevenus" component={ProviderEarningsScreen} options={{ tabBarLabel: 'Revenus', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tab.Screen name="PProfile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}>
        {() => <ProviderProfileScreen onLogout={() => {}} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MerchantTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarActiveTintColor: '#0D8F8F', tabBarInactiveTintColor: '#9CA3AF', tabBarIconStyle: { marginBottom: 2 } }}>
      <Tab.Screen name="MDashboard" component={MerchantDashboard} options={{ tabBarLabel: 'Accueil', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tab.Screen name="MBaskets" component={MerchantBasketsScreen} options={{ tabBarLabel: 'Paniers', tabBarIcon: ({ color, size }) => <Ionicons name="basket" size={size} color={color} /> }} />
      <Tab.Screen name="MReservations" component={MerchantReservationsScreen} options={{ tabBarLabel: 'Retraits', tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={size} color={color} /> }} />
      <Tab.Screen name="MPayouts" component={MerchantPayoutsScreen} options={{ tabBarLabel: 'Revenus', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tab.Screen name="MProfile" options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}>
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

  useEffect(() => {
    if (!token) return;
    refreshUser().catch(() => {});
  }, [token]);

  // Push notifications désactivées temporairement (évite crash Android sans FCM)

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0D8F8F" />
      </View>
    );
  }

  if (authLoading || !onboardingLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0D8F8F" />
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
            !user?.isVerified ? (
              <Stack.Screen name="PendingVerification">
                {() => <PendingVerificationScreen onLogout={logout} onRefresh={refreshUser} />}
              </Stack.Screen>
            ) : (
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
                <Stack.Screen name="Notifications">
                  {({ navigation }) => <NotificationsScreen onBack={() => navigation.goBack()} />}
                </Stack.Screen>
              </>
            )
          ) : userRole === 'provider' ? (
            !user?.isVerified ? (
              <Stack.Screen name="PendingVerification">
                {() => <PendingVerificationScreen onLogout={logout} onRefresh={refreshUser} />}
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
                  {({ navigation }) => <NotificationsScreen onBack={() => { if (navigation.canGoBack()) navigation.goBack(); }} />}
                </Stack.Screen>
              </>
            )
          ) : (
            <>
              <Stack.Screen name="ClientMain" component={ClientTabs} />
              <Stack.Screen name="CreateRequest">
                {({ navigation, route }) => <CreateRequestScreen onBack={() => navigation.goBack()} onSubmit={() => navigation.goBack()} initialServiceType={route.params?.serviceType} prefilledDelivery={route.params?.prefilledDelivery} prefilledDeliveryCoords={route.params?.prefilledDeliveryCoords} navigation={navigation} />}
              </Stack.Screen>
              <Stack.Screen name="Tracking">
                {({ navigation, route }) => <TrackingScreen onBack={() => navigation.goBack()} missionId={route.params?.missionId} navigation={navigation} />}
              </Stack.Screen>
              <Stack.Screen name="Payments">
                {({ navigation }) => <PaymentsScreen onBack={() => navigation.goBack()} />}
              </Stack.Screen>
              <Stack.Screen name="Payment">
                {({ navigation, route }) => <PaymentScreen onBack={() => navigation.goBack()} onPay={() => navigation.goBack()} missionId={route.params?.missionId} amount={route.params?.amount} />}
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
              <Stack.Screen name="Chat">
                {({ navigation, route }) => <ChatScreen onBack={() => navigation.goBack()} conversationId={route.params?.conversationId} name={route.params?.name} />}
              </Stack.Screen>
              <Stack.Screen name="Notifications">
                {({ navigation }) => <NotificationsScreen onBack={() => navigation.goBack()} />}
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  loading: { flex: 1, backgroundColor: '#F8FAFB', alignItems: 'center', justifyContent: 'center' },
  tabBar: { backgroundColor: '#FFF', borderTopWidth: 0, height: 80, paddingTop: 8, paddingBottom: 20 },
});
