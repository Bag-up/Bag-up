import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export type MarketCurrency = 'EUR' | 'XOF';

const STORAGE_KEY = 'marketplace_currency_pref';

/** Taux effectif par défaut (BCEAO + marge 1.5 %) — remplacé par API /marketplace/fx. */
export const DEFAULT_XOF_PER_EUR = 655.957 * 1.015;

export function defaultCurrencyForCountry(country?: string | null): MarketCurrency {
  return (country || '').toUpperCase() === 'SN' ? 'XOF' : 'EUR';
}

export function xofToEur(amountXof: number, xofPerEur = DEFAULT_XOF_PER_EUR): number {
  if (!xofPerEur) return 0;
  return Math.round((amountXof / xofPerEur) * 100) / 100;
}

export function formatMarketPrice(
  amountXof: number,
  currency: MarketCurrency,
  xofPerEur = DEFAULT_XOF_PER_EUR,
): string {
  if (currency === 'EUR') {
    return `${xofToEur(amountXof, xofPerEur).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`;
  }
  return `${Math.round(amountXof).toLocaleString('fr-FR')} FCFA`;
}

export function useMarketCurrency() {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<MarketCurrency>(
    defaultCurrencyForCountry(user?.country),
  );
  const [xofPerEur, setXofPerEur] = useState(DEFAULT_XOF_PER_EUR);
  const [fxMarginPercent, setFxMarginPercent] = useState(1.5);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) {
          if (stored === 'EUR' || stored === 'XOF') {
            setCurrencyState(stored);
          } else {
            setCurrencyState(defaultCurrencyForCountry(user?.country));
          }
        }
        const fx: any = await api.marketplace.fx().catch(() => null);
        if (!cancelled && fx?.effectiveXofPerEur) {
          setXofPerEur(Number(fx.effectiveXofPerEur));
          if (fx.marginPercent != null) setFxMarginPercent(Number(fx.marginPercent));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.country]);

  const setCurrency = useCallback(async (next: MarketCurrency) => {
    setCurrencyState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleCurrency = useCallback(() => {
    const next: MarketCurrency = currency === 'EUR' ? 'XOF' : 'EUR';
    void setCurrency(next);
  }, [currency, setCurrency]);

  const format = useCallback(
    (amountXof: number) => formatMarketPrice(amountXof, currency, xofPerEur),
    [currency, xofPerEur],
  );

  return {
    currency,
    setCurrency,
    toggleCurrency,
    format,
    xofPerEur,
    fxMarginPercent,
    ready,
    isEur: currency === 'EUR',
  };
}
