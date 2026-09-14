import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius, Shadows, Spacing } from '../../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'primary' | 'dark' | 'outline';
}

export const Button: React.FC<Props> = ({ title, onPress, loading = false, disabled = false, fullWidth = false, variant = 'primary' }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = loading || disabled;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8, tension: 100 });
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 100 });
  };

  if (variant === 'outline') {
    return (
      <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined, opacity: isDisabled ? 0.5 : 1 }}>
        <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.85} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[styles.outline, fullWidth && { width: '100%' }]}>
          {loading ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.outlineText}>{title}</Text>}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const gradient = variant === 'dark' ? Colors.gradientDark : Colors.gradientPrimary;

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? '100%' : undefined, opacity: isDisabled ? 0.5 : 1 }}>
      <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.85} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.container, variant === 'primary' && Shadows.primary]}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.text}>{title}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { height: 56, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  text: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.white, letterSpacing: 0.3 },
  outline: { height: 56, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.white },
  outlineText: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.primary },
});
