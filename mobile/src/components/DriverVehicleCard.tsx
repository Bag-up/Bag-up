import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { vehicleModeLabel } from '../constants/vehicle';
import { resolveMediaUrl } from '../services/api';
import { VehicleHeroImage } from './VehicleHeroImage';

type Props = {
  name: string;
  rating?: number | null;
  avatarUrl?: string | null;
  vehicleType?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  plate?: string | null;
  compact?: boolean;
};

function vehicleLine(
  vehicleType: string,
  brand?: string | null,
  model?: string | null,
  color?: string | null,
  typeLabel?: string,
) {
  const isCar = vehicleType === 'voiture';
  if (!isCar) {
    return [color, typeLabel].filter(Boolean).join(' · ') || typeLabel || 'Moto';
  }
  const parts = [color, brand, model].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return typeLabel || 'Véhicule';
}

/** Carte chauffeur type Yango : infos contact à gauche, illustration véhicule à droite. */
export function DriverVehicleCard({
  name,
  rating,
  avatarUrl,
  vehicleType,
  brand,
  model,
  color,
  plate,
  compact = false,
}: Props) {
  const avatarUri = resolveMediaUrl(avatarUrl);
  const typeLabel = vehicleModeLabel(vehicleType) || 'Véhicule';
  const resolvedType = vehicleType === 'voiture' ? 'voiture' : 'moto';
  const plateLabel = plate ? String(plate).toUpperCase() : null;
  const carLabel = vehicleLine(resolvedType, brand, model, color, typeLabel);

  const infoBlock = (
    <View style={styles.infoCol}>
      <View style={styles.driverRow}>
        <View style={[styles.avatar, compact && styles.avatarCompact]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={[styles.avatarImg, compact && styles.avatarImgCompact]} />
          ) : (
            <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>{(name?.[0] || '?').toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.nameCol}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {name}
            {rating != null && rating > 0 ? ` · ★${Number(rating).toFixed(1)}` : ''}
          </Text>
          <Text style={styles.typeLabel} numberOfLines={1}>{typeLabel}</Text>
          <Text style={styles.vehicleLine} numberOfLines={2}>{carLabel}</Text>
        </View>
      </View>
      {!!plateLabel && (
        <View style={styles.plateBox} accessibilityLabel={`Plaque ${plateLabel}`}>
          <Text style={styles.plateLabel}>Plaque</Text>
          <Text style={styles.plateBoxText}>{plateLabel}</Text>
        </View>
      )}
    </View>
  );

  if (compact) {
    return (
      <View style={[styles.card, styles.cardCompact]} accessibilityLabel={`${name}, ${carLabel}${plateLabel ? `, plaque ${plateLabel}` : ''}`}>
        {infoBlock}
        <VehicleHeroImage type={resolvedType} color={color} plate={plate} compact />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.yangoRow}>
        {infoBlock}
        <VehicleHeroImage type={resolvedType} color={color} plate={plate} />
      </View>
      {!!plateLabel && (
        <Text style={styles.hint}>
          À l&apos;arrivée, vérifiez la plaque {plateLabel}
          {color ? ` · ${color}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.gray100,
    ...Shadows.sm,
  },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
  },
  yangoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameCol: { flex: 1, minWidth: 0, gap: 2 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarCompact: { width: 44, height: 44, borderRadius: 22 },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarImgCompact: { width: 44, height: 44, borderRadius: 22 },
  avatarText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
  },
  avatarTextCompact: { fontSize: Typography.fontSize.md },
  name: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  nameCompact: { fontSize: Typography.fontSize.md },
  typeLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  vehicleLine: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
    lineHeight: 18,
  },
  plateBox: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: Colors.gray900,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.white,
  },
  plateLabel: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: 9,
    color: Colors.gray500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  plateBoxText: {
    fontFamily: Typography.fontFamily.syne.bold,
    fontSize: 17,
    letterSpacing: 1.6,
    color: Colors.gray900,
  },
  hint: {
    fontFamily: Typography.fontFamily.dmSans.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 2,
  },
});
