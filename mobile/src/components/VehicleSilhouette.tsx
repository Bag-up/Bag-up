import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { vehicleColorHex } from '../constants/vehicle';

type Props = {
  type?: string | null;
  color?: string | null;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  /** Miniature à côté de la photo chauffeur (sheet course). */
  compact?: boolean;
};

function isDark(colorName?: string | null) {
  return ['Noir', 'Marron', 'Bleu', 'Vert', 'Autre'].includes(colorName || '');
}

/** Silhouette générée (pas une photo) : voiture ou moto teintée + plaque. */
export function VehicleSilhouette({ type, color, plate, brand, model, compact = false }: Props) {
  const paint = vehicleColorHex(color);
  const dark = isDark(color);
  const accent = dark ? 'rgba(255,255,255,0.92)' : Colors.gray900;
  const glass = dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.72)';
  const isCar = type === 'voiture';
  const label = [brand, model].filter(Boolean).join(' ');

  if (compact) {
    return (
      <View
        style={styles.compactStage}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {isCar ? (
          <View style={styles.compactCar}>
            <View style={[styles.compactRoof, { backgroundColor: paint, borderColor: accent }]} />
            <View style={[styles.compactBody, { backgroundColor: paint, borderColor: accent }]}>
              <View style={[styles.compactLight, { backgroundColor: dark ? '#FDE68A' : '#FEF3C7' }]} />
              <View style={[styles.compactLight, styles.compactLightRight, { backgroundColor: dark ? '#FDE68A' : '#FEF3C7' }]} />
            </View>
            <View style={styles.compactWheels}>
              <View style={styles.compactWheel} />
              <View style={styles.compactWheel} />
            </View>
          </View>
        ) : (
          <View style={styles.compactMoto}>
            <View style={[styles.compactMotoBody, { backgroundColor: paint, borderColor: accent }]} />
            <View style={styles.compactWheels}>
              <View style={styles.compactWheel} />
              <View style={styles.compactWheel} />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.stage, { backgroundColor: dark ? '#1F2937' : '#EEF2F7' }]}>
        {isCar ? (
          <View style={styles.carScene}>
            {/* Roof */}
            <View style={[styles.carRoof, { backgroundColor: paint, borderColor: accent }]}>
              <View style={[styles.carWindow, { backgroundColor: glass }]} />
              <View style={[styles.carWindow, { backgroundColor: glass }]} />
            </View>
            {/* Body */}
            <View style={[styles.carBody, { backgroundColor: paint, borderColor: accent }]}>
              <View style={[styles.carHeadlight, { backgroundColor: dark ? '#FDE68A' : '#FEF3C7' }]} />
              <View style={[styles.carHeadlight, styles.carHeadlightRight, { backgroundColor: dark ? '#FDE68A' : '#FEF3C7' }]} />
              {!!plate && (
                <View style={styles.plateOnVehicle}>
                  <Text style={styles.plateOnVehicleText} numberOfLines={1}>
                    {String(plate).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {/* Wheels */}
            <View style={styles.carWheels}>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.motoScene}>
            <View style={[styles.motoHandle, { backgroundColor: accent }]} />
            <View style={[styles.motoBody, { backgroundColor: paint, borderColor: accent }]}>
              {!!plate && (
                <View style={styles.plateOnVehicle}>
                  <Text style={styles.plateOnVehicleText} numberOfLines={1}>
                    {String(plate).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.motoSeat, { backgroundColor: dark ? '#111827' : '#374151' }]} />
            <View style={styles.motoWheels}>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
            </View>
          </View>
        )}

        <View style={styles.metaChip}>
          <View style={[styles.colorDot, { backgroundColor: paint, borderColor: accent }]} />
          <Text style={styles.metaChipText} numberOfLines={1}>
            {[color || 'Couleur', isCar ? 'Voiture' : 'Moto', label || null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {!!plate && (
        <View style={styles.plateBanner}>
          <Text style={styles.plateBannerEyebrow}>PLAQUE</Text>
          <Text style={styles.plateBannerText}>{String(plate).toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  stage: {
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 148,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  carScene: {
    width: '100%',
    maxWidth: 280,
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  carRoof: {
    width: '58%',
    height: 34,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  carWindow: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  carBody: {
    width: '92%',
    height: 42,
    marginTop: -6,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  carHeadlight: {
    position: 'absolute',
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  carHeadlightRight: { left: undefined, right: 10 },
  carWheels: {
    position: 'absolute',
    bottom: -2,
    left: '12%',
    right: '12%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  motoScene: {
    width: '100%',
    maxWidth: 220,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  motoHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
    marginLeft: '18%',
  },
  motoBody: {
    width: '70%',
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  motoSeat: {
    width: '28%',
    height: 12,
    borderRadius: 6,
    marginTop: -8,
    alignSelf: 'flex-end',
    marginRight: '18%',
    zIndex: 2,
  },
  motoWheels: {
    position: 'absolute',
    bottom: 0,
    left: '8%',
    right: '8%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  wheel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHub: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9CA3AF',
  },
  plateOnVehicle: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.gray900,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: '78%',
  },
  plateOnVehicleText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.gray900,
  },
  metaChip: {
    marginTop: Spacing.md,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  metaChipText: {
    flex: 1,
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray900,
  },
  plateBanner: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.gray900,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  plateBannerEyebrow: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 10,
    color: Colors.gray500,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  plateBannerText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 26,
    color: Colors.gray900,
    letterSpacing: 3,
  },
  compactStage: {
    width: 92,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    overflow: 'hidden',
  },
  compactCar: {
    width: 76,
    height: 42,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  compactRoof: {
    width: 42,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    marginBottom: -3,
    zIndex: 2,
  },
  compactBody: {
    width: 70,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
  },
  compactLight: {
    position: 'absolute',
    left: 5,
    top: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  compactLightRight: { left: undefined, right: 5 },
  compactWheels: {
    position: 'absolute',
    bottom: -3,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactWheel: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#4B5563',
  },
  compactMoto: {
    width: 68,
    height: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  compactMotoBody: {
    width: 52,
    height: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
});
