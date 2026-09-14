import { Alert, Linking } from 'react-native';
import { ChargeInitResult } from './api';

export type CheckoutOutcome = 'success' | 'failed' | 'awaiting';

/**
 * Traite le résultat d'un `initiate` de paiement/abonnement :
 *  - mode mock : succès/échec immédiat
 *  - Wave / carte : ouvre le deep link ou la page de checkout
 *  - Orange Money (USSD) : affiche le message à composer
 *
 * Retourne 'awaiting' quand la confirmation dépend du webhook (l'écran appelant
 * doit alors vérifier le statut via polling).
 */
export async function handleCheckout(result: ChargeInitResult): Promise<CheckoutOutcome> {
  if (result.status === 'success') return 'success';
  if (result.status === 'failed') return 'failed';

  const url = result.link || result.redirectUrl;

  if (url) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Paiement', "Impossible d'ouvrir la page de paiement.");
        return 'failed';
      }
    } catch {
      Alert.alert('Paiement', "Impossible d'ouvrir la page de paiement.");
      return 'failed';
    }
  } else if (result.message) {
    // Orange Money : instruction USSD à composer par l'utilisateur.
    Alert.alert('Validez votre paiement', result.message);
  }

  return 'awaiting';
}

/**
 * Interroge périodiquement une fonction de statut jusqu'à obtenir un état final
 * ('success' / 'failed') ou l'expiration du délai. Utilisé après ouverture du
 * checkout, en attendant la confirmation du webhook côté backend.
 */
export async function pollStatus(
  check: () => Promise<'pending' | 'processing' | 'success' | 'failed'>,
  { intervalMs = 3000, timeoutMs = 120000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<'success' | 'failed' | 'timeout'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const status = await check();
      if (status === 'success') return 'success';
      if (status === 'failed') return 'failed';
    } catch {
      // Ignorer les erreurs transitoires de polling.
    }
  }
  return 'timeout';
}
