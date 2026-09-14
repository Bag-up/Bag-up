import React, { useEffect, useMemo, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  View,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing } from '../../constants/theme';

interface Props {
  onFinish: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SCENES = [
  require('../../../assets/splash/delivery.png'),
  require('../../../assets/splash/diaspora.png'),
  require('../../../assets/splash/documents.png'),
] as const;

const DURATION_MS = 2800;

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const scene = useMemo(() => SCENES[Math.floor(Math.random() * SCENES.length)], []);

  const bgOpacity = useRef(new Animated.Value(0)).current;
  const bgScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(bgScale, {
        toValue: 1.06,
        duration: DURATION_MS,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
            tension: 70,
          }),
        ]),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]),
    ]).start();

    const fadeOutAt = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, DURATION_MS);

    return () => clearTimeout(fadeOutAt);
  }, [onFinish, bgOpacity, bgScale, logoOpacity, logoScale, textOpacity, screenOpacity]);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <Animated.View
        style={[
          styles.bgWrap,
          { opacity: bgOpacity, transform: [{ scale: bgScale }] },
        ]}
      >
        <Image source={scene} style={styles.bgImage} resizeMode="cover" />
      </Animated.View>

      <LinearGradient
        colors={['rgba(13,143,143,0.35)', 'rgba(10,112,112,0.72)', 'rgba(10,112,112,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            alignItems: 'center',
          }}
        >
          <Image
            source={require('../../../assets/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
          <Text style={styles.title}>Bag'up</Text>
          <Text style={styles.subtitle}>Livraison & Services</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logo: {
    width: 148,
    height: 148,
    borderRadius: 32,
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 40,
    color: Colors.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
