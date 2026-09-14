import * as crypto from 'crypto';
import { StripeProvider } from './stripe.provider';

const SECRET = 'whsec_test';

function makeProvider(): StripeProvider {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  return new StripeProvider();
}

function sign(rawBody: string, ts: number): string {
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${ts}.${rawBody}`)
    .digest('hex');
  return `t=${ts},v1=${signature}`;
}

describe('StripeProvider', () => {
  it('est configuré avec clé secrète + secret webhook', () => {
    expect(makeProvider().isConfigured()).toBe(true);
  });

  describe('verifyWebhook', () => {
    it('accepte une signature Stripe valide', () => {
      const provider = makeProvider();
      const rawBody = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
      const ts = Math.floor(Date.now() / 1000);
      expect(provider.verifyWebhook(rawBody, { 'stripe-signature': sign(rawBody, ts) })).toBe(true);
    });

    it('rejette une signature falsifiée', () => {
      const provider = makeProvider();
      const rawBody = '{"id":"evt_1"}';
      const ts = Math.floor(Date.now() / 1000);
      expect(provider.verifyWebhook(rawBody, { 'stripe-signature': `t=${ts},v1=bad` })).toBe(false);
    });

    it('rejette un header absent', () => {
      const provider = makeProvider();
      expect(provider.verifyWebhook('{}', {})).toBe(false);
    });

    it('rejette un timestamp expiré', () => {
      const provider = makeProvider();
      const rawBody = '{"id":"evt_1"}';
      const oldTs = Math.floor(Date.now() / 1000) - 10 * 60;
      expect(provider.verifyWebhook(rawBody, { 'stripe-signature': sign(rawBody, oldTs) })).toBe(false);
    });
  });

  describe('parseWebhook', () => {
    it('mappe checkout.session.completed vers success et lit la référence', () => {
      const provider = makeProvider();
      const parsed = provider.parseWebhook(
        JSON.stringify({
          id: 'evt_1',
          type: 'checkout.session.completed',
          data: { object: { client_reference_id: 'pay_1', payment_intent: 'pi_1', amount_total: 5000, currency: 'xof' } },
        }),
      );
      expect(parsed).toMatchObject({ eventId: 'evt_1', paymentRef: 'pay_1', providerRef: 'pi_1', status: 'success' });
    });

    it('mappe payment_intent.payment_failed vers failed', () => {
      const provider = makeProvider();
      const parsed = provider.parseWebhook(
        JSON.stringify({ id: 'evt_2', type: 'payment_intent.payment_failed', data: { object: {} } }),
      );
      expect(parsed.status).toBe('failed');
    });
  });
});
