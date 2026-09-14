import { Platform } from 'react-native';

export const Colors = {
  primary: '#0D8F8F',
  primaryLight: '#14B8B8',
  primaryDark: '#0A7070',
  primarySoft: '#E6F7F7',
  secondary: '#F7E300',
  accent: '#F04A3A',
  accentLight: '#FF6B5B',
  accentSoft: '#FEE4E2',
  white: '#FFFFFF',
  black: '#000000',
  background: '#F8FAFB',
  surface: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray900: '#111827',
  success: '#10B981',
  successLight: '#D1FAE5',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  info: '#6366F1',
  infoSoft: '#E0E7FF',
  gradientPrimary: ['#0D8F8F', '#14B8B8'] as [string, string],
  gradientDark: ['#1F2937', '#374151'] as [string, string],
  gradientAccent: ['#F04A3A', '#FF6B5B'] as [string, string],
};

export const Typography = {
  fontFamily: {
    syne: { regular: 'Syne_400Regular', medium: 'Syne_500Medium', semiBold: 'Syne_600SemiBold', bold: 'Syne_700Bold' },
    dmSans: { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', semiBold: 'DMSans_600SemiBold', bold: 'DMSans_700Bold' },
  },
  fontSize: { xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 28, '4xl': 32, '5xl': 40 },
  lineHeight: { xs: 14, sm: 16, base: 20, md: 22, lg: 26, xl: 28, '2xl': 32, '3xl': 38 },
};

export const Spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 40, '4xl': 48 };

export const BorderRadius = { sm: 4, base: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, full: 9999 };

const shadow = (y: number, o: number, r: number, e: number) =>
  Platform.OS === 'web'
    ? { boxShadow: `0 ${y}px ${r}px rgba(0,0,0,${o})` }
    : { shadowColor: '#000', shadowOffset: { width: 0, height: y }, shadowOpacity: o, shadowRadius: r, elevation: e };

export const Shadows = {
  xs: shadow(1, 0.03, 2, 0.5),
  sm: shadow(2, 0.04, 4, 1),
  md: shadow(4, 0.06, 12, 3),
  lg: shadow(8, 0.08, 24, 6),
  xl: shadow(12, 0.10, 32, 8),
  primary: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
};

export const withAlpha = (hex: string, alpha: number) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
};
