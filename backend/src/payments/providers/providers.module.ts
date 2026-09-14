import { Module } from '@nestjs/common';
import { MockProvider } from './mock.provider';
import { BictorysProvider } from './bictorys.provider';
import { StripeProvider } from './stripe.provider';
import { PaymentProviderFactory } from './payment-provider.factory';

/**
 * Module partagé regroupant les passerelles de paiement et leur factory.
 * Importé par PaymentsModule et SubscriptionsModule pour mutualiser la logique
 * de routage (Bictorys / Stripe / mock).
 */
@Module({
  providers: [MockProvider, BictorysProvider, StripeProvider, PaymentProviderFactory],
  exports: [PaymentProviderFactory],
})
export class PaymentProvidersModule {}
