import { PaymentsService } from './payments.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AntiGaspiService } from '../anti-gaspi/anti-gaspi.service';
import { ParsedWebhook, PaymentProvider } from './providers/payment-provider.interface';

function buildPrismaMock() {
  return {
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'pay_1', userId: 'user_1' }),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    webhookEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    referral: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

function providerStub(event: ParsedWebhook, valid = true): PaymentProvider {
  return {
    name: 'bictorys',
    isConfigured: () => true,
    initiateCharge: jest.fn(),
    verifyWebhook: jest.fn().mockReturnValue(valid),
    parseWebhook: jest.fn().mockReturnValue(event),
  } as unknown as PaymentProvider;
}

function buildFactory(provider: PaymentProvider): PaymentProviderFactory {
  return { forCountry: jest.fn(), byName: jest.fn().mockReturnValue(provider) } as any;
}

const SUCCESS_EVENT: ParsedWebhook = {
  eventId: 'evt_1',
  paymentRef: 'pay_1',
  providerRef: 'txn_1',
  status: 'success',
  amount: 5000,
  currency: 'XOF',
};

describe('PaymentsService.handleWebhook', () => {
  let prisma: any;
  let subscriptions: jest.Mocked<SubscriptionsService>;
  let antiGaspi: jest.Mocked<AntiGaspiService>;
  let marketplace: any;

  beforeEach(() => {
    prisma = buildPrismaMock();
    subscriptions = { applyWebhook: jest.fn() } as any;
    antiGaspi = {
      findTransactionByRef: jest.fn().mockResolvedValue(null),
      applyWebhook: jest.fn(),
    } as any;
    marketplace = {
      applyPaymentSuccess: jest.fn().mockResolvedValue(null),
    } as any;
  });

  function makeService(provider: PaymentProvider) {
    const externalNotifs = { sendEmail: jest.fn().mockResolvedValue(true) } as any;
    const rides = { applyPaymentSuccess: jest.fn().mockResolvedValue(null) } as any;
    const loyalty = { consumeVoucher: jest.fn(), releaseVoucher: jest.fn() } as any;
    return new PaymentsService(
      prisma,
      buildFactory(provider),
      subscriptions,
      antiGaspi,
      marketplace,
      externalNotifs,
      rides,
      loyalty,
    );
  }

  it('confirme un paiement lors d\'un webhook de succès valide', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', amount: 5000, userId: 'user_1' });
    const service = makeService(providerStub(SUCCESS_EVENT));

    await service.handleWebhook('bictorys', JSON.stringify({ id: 'evt_1' }), {});

    const statusUpdate = prisma.payment.update.mock.calls.find(
      (c: any[]) => c[0]?.data?.status === 'success',
    );
    expect(statusUpdate).toBeDefined();
  });

  it('ignore un webhook déjà traité (idempotence)', async () => {
    prisma.webhookEvent.create.mockRejectedValue(new Error('unique constraint'));
    const service = makeService(providerStub(SUCCESS_EVENT));

    await service.handleWebhook('bictorys', '{}', {});

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('ignore un webhook avec une signature invalide', async () => {
    const service = makeService(providerStub(SUCCESS_EVENT, false));

    await service.handleWebhook('bictorys', '{}', {});

    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejette un webhook dont le montant ne correspond pas (anti-fraude)', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', amount: 5000, userId: 'user_1' });
    const service = makeService(providerStub({ ...SUCCESS_EVENT, amount: 100 }));

    await service.handleWebhook('bictorys', '{}', {});

    const statusUpdate = prisma.payment.update.mock.calls.find(
      (c: any[]) => c[0]?.data?.status === 'success',
    );
    expect(statusUpdate).toBeUndefined();
  });

  it('délègue au service abonnement quand la référence est un abonnement', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.subscription.findUnique.mockResolvedValue({ id: 'pay_1', amount: 5000 });
    const service = makeService(providerStub(SUCCESS_EVENT));

    await service.handleWebhook('bictorys', '{}', {});

    expect(subscriptions.applyWebhook).toHaveBeenCalledWith('pay_1', 'success', 'txn_1', expect.any(String));
  });

  it('délègue au service Anti-Gaspi quand la référence est une transaction AG', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.subscription.findUnique.mockResolvedValue(null);
    antiGaspi.findTransactionByRef.mockResolvedValue({ id: 'pay_1', amount: 5000 } as any);
    const service = makeService(providerStub(SUCCESS_EVENT));

    await service.handleWebhook('bictorys', '{}', {});

    expect(antiGaspi.applyWebhook).toHaveBeenCalledWith('pay_1', 'success', 'txn_1', expect.any(String));
  });
});
