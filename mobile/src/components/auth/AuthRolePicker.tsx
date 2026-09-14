import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

export type AuthRole = 'client' | 'provider' | 'merchant';

type RoleOption = {
  id: AuthRole;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: { bg: string; icon: string };
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'client',
    label: 'Client',
    desc: 'Commander, suivre, payer',
    icon: 'person',
    colors: { bg: '#E6F7F7', icon: '#0D8F8F' },
  },
  {
    id: 'provider',
    label: 'Prestataire',
    desc: 'Livraison, courses ou démarches',
    icon: 'bicycle',
    colors: { bg: '#FFF7ED', icon: '#EA580C' },
  },
  {
    id: 'merchant',
    label: 'Commerçant',
    desc: 'Anti-Gaspi & Marketplace',
    icon: 'storefront',
    colors: { bg: '#F3E8FF', icon: '#7C3AED' },
  },
];

type Props = {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
  /** Afficher uniquement certains rôles (ex. après détection API) */
  available?: AuthRole[];
  compact?: boolean;
};

export function AuthRolePicker({ value, onChange, available, compact }: Props) {
  const options = available?.length
    ? ROLE_OPTIONS.filter((o) => available.includes(o.id))
    : ROLE_OPTIONS;

  return (
    <View style={styles.wrap}>
      <View style={[styles.grid, compact && styles.gridCompact]}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.card,
                opt.id === 'merchant' && styles.cardWide,
                selected && styles.cardSelected,
                selected && { borderColor: opt.colors.icon },
              ]}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.88}
            >
              <View style={[styles.iconWrap, { backgroundColor: selected ? opt.colors.icon : opt.colors.bg }]}>
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={selected ? Colors.white : opt.colors.icon}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.label, selected && { color: opt.colors.icon }]}>{opt.label}</Text>
                <Text style={styles.desc} numberOfLines={2}>{opt.desc}</Text>
              </View>
              {selected ? (
                <View style={[styles.check, { backgroundColor: opt.colors.icon }]}>
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridCompact: { gap: 8 },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    backgroundColor: Colors.white,
    minHeight: 76,
    position: 'relative',
  },
  cardWide: {
    flexBasis: '100%',
  },
  cardSelected: {
    backgroundColor: Colors.gray50,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, paddingRight: 20 },
  label: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },
  desc: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginTop: 2,
    lineHeight: 15,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
