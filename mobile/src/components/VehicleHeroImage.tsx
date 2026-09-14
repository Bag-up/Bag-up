import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { BorderRadius } from '../constants/theme';

const VEHICLE_IMAGES = {
  voiture: require('../../assets/ride-hero-car.png'),
  /** Image moto+voiture (JPEG léger) — on n'affiche que la partie gauche (moto). */
  motoFleet: require('../../assets/ride-hero-moto-voiture.jpg'),
} as const;

type Props = {
  type?: string | null;
  color?: string | null;
  plate?: string | null;
  compact?: boolean;
};

/** Illustration véhicule : voiture seule, ou moto seule (pas les deux). */
export function VehicleHeroImage({ type, color, plate, compact = false }: Props) {
  const isCar = type === 'voiture';

  if (!isCar) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.motoClip}>
          <Image
            source={VEHICLE_IMAGES.motoFleet}
            style={[styles.motoFleetImage, compact && styles.motoFleetImageCompact]}
            contentFit="cover"
            contentPosition="left center"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image
        source={VEHICLE_IMAGES.voiture}
        style={[styles.image, compact && styles.imageCompact]}
        contentFit="contain"
        contentPosition="center"
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 128,
    height: 108,
    flexShrink: 0,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#E8F4F4',
  },
  wrapCompact: {
    width: 96,
    height: 80,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageCompact: {
    height: 80,
  },
  motoClip: {
    flex: 1,
    overflow: 'hidden',
  },
  motoFleetImage: {
    width: '220%',
    height: '100%',
    marginLeft: 0,
  },
  motoFleetImageCompact: {
    width: '240%',
  },
});
