import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, withAlpha } from '../../constants/theme';
import { MarketCurrency } from '../../hooks/useMarketCurrency';

type Props = {
  currency: MarketCurrency;
  onChange: (c: MarketCurrency) => void;
  /** Style clair sur fond teal / sombre */
  light?: boolean;
};

export const CurrencySwitch: React.FC<Props> = ({ currency, onChange, light }) => {
  return (
    <View style={[styles.wrap, light && styles.wrapLight]}>
      {(['EUR', 'XOF'] as MarketCurrency[]).map((c) => {
        const on = currency === c;
        return (
          <TouchableOpacity
            key={c}
            style={[styles.btn, on && (light ? styles.btnOnLight : styles.btnOn)]}
            onPress={() => onChange(c)}
            activeOpacity={0.85}
          >
            <Text style={[styles.text, light && styles.textLight, on && (light ? styles.textOnLight : styles.textOn)]}>
              {c === 'EUR' ? '€ EUR' : 'FCFA'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.full,
    padding: 3,
    gap: 2,
  },
  wrapLight: {
    backgroundColor: withAlpha('#000', 0.45),
    borderWidth: 1,
    borderColor: withAlpha('#fff', 0.35),
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  btnOn: {
    backgroundColor: Colors.white,
  },
  btnOnLight: {
    backgroundColor: '#0D8F8F',
  },
  text: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: 12,
    color: Colors.gray500,
  },
  textLight: {
    color: withAlpha('#fff', 0.75),
  },
  textOn: {
    color: Colors.primaryDark,
  },
  textOnLight: {
    color: '#FFFFFF',
  },
});
