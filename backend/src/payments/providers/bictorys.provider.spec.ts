import * as crypto from 'crypto';
import { BictorysProvider } from './bictorys.provider';

const SECRET = 'test-webhook-secret';

function makeProvider(): BictorysProvider {
  process.env.BICTORYS_API_KEY = 'public-test';
  process.env.BICTORYS_WEBHOOK_SECRET = SECRET;
  return new BictorysProvider();
}

describe('BictorysProvider', () => {
  describe('isConfigured', () => {
    it('est configuré quand la clé API et le secret webhook sont présents', () => {
      expect(makeProvider().isConfigured()).toBe(true);
    });

    it("n'est pas configuré sans clé", () => {
      process.env.BICTORYS_API_KEY = '';
      process.env.BICTORYS_WEBHOOK_SECRET = '';
      expect(new BictorysProvider().isConfigured()).toBe(false);
    });
  });

  describe('verifyWebhook (HMAC)', () => {
    it('accepte une signature HMAC valide et récente', () => {
      const provider = makeProvider();
      const rawBody = JSON.stringify({ id: 'evt_1', status: 'succeeded' });
      const timestamp = String(Date.now());
      const signature = crypto
        .createHmac('sha256', SECRET)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      expect(
        provider.verifyWebhook(rawBody, {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        }),
      ).toBe(true);
    });

    it('rejette une signature invalide', () => {
      const provider = makeProvider();
      const rawBody = '{"id":"evt_1"}';
      const timestamp = String(Date.now());
      expect(
        provider.verifyWebhook(rawBody, {
          'x-webhook-signature': 'deadbeef',
          'x-webhook-timestamp': timestamp,
        }),
      ).toBe(false);
    });

    it('rejette un timestamp trop ancien (anti-rejeu)', () => {
      const provider = makeProvider();
      const rawBody = '{"id":"evt_1"}';
      const oldTs = String(Date.now() - 10 * 60 * 1000);
      const signature = crypto
        .createHmac('sha256', SECRET)
        .update(`${oldTs}.${rawBody}`)
        .digest('hex');
      expect(
        provider.verifyWebhook(rawBody, {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': oldTs,
        }),
      ).toBe(false);
    });
  });

  describe('verifyWebhook (clé statique)', () => {
    it('accepte la bonne clé statique', () => {
      const provider = makeProvider();
      expect(provider.verifyWebhook('{}', { 'x-secret-key': SECRET })).toBe(true);
    });

    it('rejette une mauvaise clé statique', () => {
      const provider = makeProvider();
      expect(provider.verifyWebhook('{}', { 'x-secret-key': 'wrong' })).toBe(false);
    });
  });

  describe('parseWebhook', () => {
    it('mappe le statut succeeded vers success', () => {
      const provider = makeProvider();
      const parsed = provider.parseWebhook(
        JSON.stringify({ id: 'evt_1', paymentReference: 'pay_1', status: 'succeeded', amount: 5000, currency: 'XOF' }),
      );
      expect(parsed).toMatchObject({
        eventId: 'evt_1',
        paymentRef: 'pay_1',
        status: 'success',
        amount: 5000,
      });
    });

    it('mappe cancelled/reversed vers failed', () => {
      const provider = makeProvider();
      expect(provider.parseWebhook(JSON.stringify({ id: 'e', status: 'cancelled' })).status).toBe('failed');
      expect(provider.parseWebhook(JSON.stringify({ id: 'e', status: 'reversed' })).status).toBe('failed');
    });
  });
});
