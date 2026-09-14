import { ImageSourcePropType } from 'react-native';
import { Colors } from './theme';

export type PaymentMethodId = 'orange_money' | 'wave' | 'card';

export type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  desc: string;
  color: string;
  /** Logo PNG — absent pour la carte (icône Ionicons). */
  logo?: ImageSourcePropType;
  icon?: 'wallet' | 'water' | 'card';
};

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    desc: 'Paiement instantané',
    color: '#F97316',
    logo: require('../../assets/payments/orange_money.png'),
  },
  {
    id: 'wave',
    label: 'Wave',
    desc: 'Frais réduits',
    color: '#0EA5E9',
    logo: require('../../assets/payments/wave.png'),
  },
  {
    id: 'card',
    label: 'Carte bancaire',
    desc: 'Visa, Mastercard — Diaspora',
    color: Colors.success,
    icon: 'card',
  },
];
