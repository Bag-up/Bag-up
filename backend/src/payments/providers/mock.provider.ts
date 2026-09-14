import { Injectable, Logger } from '@nestjs/common';
import {
  InitiateChargeInput,
  InitiateChargeResult,
  ParsedWebhook,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Fournisseur de secours utilisé en développement, quand aucune passerelle
 * réelle n'est configurée. Conserve le comportement historique : la charge est
 * considérée comme réussie immédiatement (le mobile confirme via markSuccess).
 */
@Injectable()
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockProvider.name);

  isConfigured(): boolean {
    return true;
  }

  async initiateCharge(input: InitiateChargeInput): Promise<InitiateChargeResult> {
    this.logger.log(
      `[MOCK] Charge simulée ${input.amount} ${input.currency} (${input.method}) ref=${input.paymentId}`,
    );
    return {
      provider: this.name,
      providerRef: `MOCK-${Date.now()}`,
      status: 'success',
    };
  }

  verifyWebhook(): boolean {
    return true;
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const data = JSON.parse(rawBody || '{}');
    return {
      eventId: data.id || `mock-${Date.now()}`,
      paymentRef: data.paymentReference,
      providerRef: data.id,
      status: 'success',
      amount: data.amount,
      currency: data.currency,
    };
  }
}
