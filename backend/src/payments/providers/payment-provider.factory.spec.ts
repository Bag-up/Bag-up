import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProvider } from './payment-provider.interface';
import { MockProvider } from './mock.provider';
import { BictorysProvider } from './bictorys.provider';
import { StripeProvider } from './stripe.provider';

function stub(name: string, configured: boolean): PaymentProvider {
  return {
    name,
    isConfigured: () => configured,
    initiateCharge: jest.fn(),
    verifyWebhook: jest.fn(),
    parseWebhook: jest.fn(),
  } as unknown as PaymentProvider;
}

describe('PaymentProviderFactory', () => {
  it('route le Sénégal vers Bictorys quand il est configuré', () => {
    const factory = new PaymentProviderFactory(
      stub('mock', true) as MockProvider,
      stub('bictorys', true) as BictorysProvider,
      stub('stripe', true) as StripeProvider,
    );
    expect(factory.forCountry('SN').name).toBe('bictorys');
  });

  it('route la diaspora (FR) vers Stripe quand il est configuré', () => {
    const factory = new PaymentProviderFactory(
      stub('mock', true) as MockProvider,
      stub('bictorys', true) as BictorysProvider,
      stub('stripe', true) as StripeProvider,
    );
    expect(factory.forCountry('FR').name).toBe('stripe');
  });

  it('retombe sur le mock quand la passerelle cible n\'est pas configurée', () => {
    const factory = new PaymentProviderFactory(
      stub('mock', true) as MockProvider,
      stub('bictorys', false) as BictorysProvider,
      stub('stripe', false) as StripeProvider,
    );
    expect(factory.forCountry('SN').name).toBe('mock');
    expect(factory.forCountry('US').name).toBe('mock');
  });

  it('utilise SN par défaut quand le pays est absent', () => {
    const factory = new PaymentProviderFactory(
      stub('mock', true) as MockProvider,
      stub('bictorys', true) as BictorysProvider,
      stub('stripe', true) as StripeProvider,
    );
    expect(factory.forCountry(undefined).name).toBe('bictorys');
  });

  it('byName retrouve le bon fournisseur', () => {
    const factory = new PaymentProviderFactory(
      stub('mock', true) as MockProvider,
      stub('bictorys', true) as BictorysProvider,
      stub('stripe', true) as StripeProvider,
    );
    expect(factory.byName('stripe')?.name).toBe('stripe');
    expect(factory.byName('inconnu')).toBeNull();
  });
});
