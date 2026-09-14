import { Injectable, Logger } from '@nestjs/common';
import { MockProvider } from './mock.provider';
import { BictorysProvider } from './bictorys.provider';
import { StripeProvider } from './stripe.provider';
import { PaymentProvider } from './payment-provider.interface';

/**
 * Sélectionne la passerelle de paiement adaptée.
 *
 * Règle de routage (validée avec le client) : par pays du payeur.
 *  - Sénégal / Afrique de l'Ouest  → Bictorys (Wave, Orange Money, carte locale)
 *  - Diaspora (autre pays)         → Stripe (carte internationale)
 *
 * Si la passerelle cible n'est pas configurée (clés absentes), on retombe sur
 * le MockProvider afin que l'application reste fonctionnelle en développement.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);

  // Pays couverts par Bictorys (mobile money Afrique de l'Ouest).
  private static readonly LOCAL_COUNTRIES = new Set(['SN', 'CI', 'BF', 'ML', 'TG', 'BJ', 'BK']);

  constructor(
    private readonly mock: MockProvider,
    private readonly bictorys: BictorysProvider,
    private readonly stripe: StripeProvider,
  ) {}

  /** Choisit le fournisseur selon le code pays du payeur. */
  forCountry(country?: string): PaymentProvider {
    const code = (country || 'SN').toUpperCase();
    const isLocal = PaymentProviderFactory.LOCAL_COUNTRIES.has(code);
    const target = isLocal ? this.bictorys : this.stripe;

    if (target.isConfigured()) return target;

    this.logger.warn(
      `Passerelle "${target.name}" non configurée (pays=${code}) → repli sur MockProvider`,
    );
    return this.mock;
  }

  /** Retrouve un fournisseur par son nom (réception de webhook). */
  byName(name: string): PaymentProvider | null {
    switch (name) {
      case this.bictorys.name:
        return this.bictorys;
      case this.stripe.name:
        return this.stripe;
      case this.mock.name:
        return this.mock;
      default:
        return null;
    }
  }
}
