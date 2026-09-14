import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Livraison Express',
    description: 'Faites livrer vos colis, documents et courses en quelques minutes. Disponible 24h/24.',
    icon: 'cube' as const,
    gradient: Colors.gradientPrimary as [string, string],
  },
  {
    id: '2',
    title: 'Suivi en Temps Réel',
    description: 'Suivez votre livraison en direct sur la carte. Recevez des notifications à chaque étape.',
    icon: 'location' as const,
    gradient: ['#F04A3A', '#FF6B5B'] as [string, string],
  },
  {
    id: '3',
    title: 'Paiement Sécurisé',
    description: 'Payez facilement via Orange Money, Wave, Free Money ou carte bancaire.',
    icon: 'lock-closed' as const,
    gradient: ['#6366F1', '#818CF8'] as [string, string],
  },
  {
    id: '4',
    title: 'Fidélité Récompensée',
    description:
      'Cumulez vos courses et missions : Ivoire → Gold. Gagnez des bons en FCFA et des paniers Anti-Gaspi offerts.',
    icon: 'trophy' as const,
    gradient: ['#C9A227', '#F5D76E'] as [string, string],
  },
];

interface Props { onComplete: () => void; }

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  const handleNext = () => {
    if (index < slides.length - 1) {
      ref.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      onComplete();
    }
  };

  const renderItem = ({ item }: { item: typeof slides[0] }) => (
    <View style={styles.slide}>
      <LinearGradient colors={item.gradient} style={styles.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={item.icon} size={72} color={Colors.white} />
      </LinearGradient>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={onComplete} activeOpacity={0.8}>
        <Text style={styles.skipText}>Passer</Text>
      </TouchableOpacity>

      <FlatList
        ref={ref}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity onPress={handleNext} activeOpacity={0.9} style={styles.btnWrap}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.btnText}>{index === slides.length - 1 ? 'Commencer' : 'Suivant'}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} style={{ marginLeft: 8 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  skip: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: Spacing.sm },
  skipText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray500 },
  slide: { width, alignItems: 'center', paddingTop: 120, paddingHorizontal: 32 },
  iconWrap: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing['2xl'], ...Shadows.lg },
  title: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['3xl'], color: Colors.gray900, textAlign: 'center', marginBottom: 12 },
  desc: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.md, color: Colors.gray500, textAlign: 'center', lineHeight: 24 },
  bottom: { paddingHorizontal: 20, paddingBottom: 40 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray200, marginHorizontal: 4 },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  btnWrap: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.primary },
  btn: { height: 56, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.white },
});
