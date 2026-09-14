import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ExternalNotificationsService } from './external-notifications.service';

describe('ExternalNotificationsService (Orange SMS Pro)', () => {
  let service: ExternalNotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalNotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const cfg: Record<string, string> = {
                ORANGE_SMS_TOKEN: 'tok123',
                ORANGE_SMS_PRIVATE_KEY: 'priv456',
                ORANGE_SMS_SENDER: 'Bagup',
                ORANGE_SMS_URL: 'https://api.orangesmspro.sn:8443/api',
              };
              return cfg[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(ExternalNotificationsService);
  });

  it('considère le SMS activé quand Orange est configuré', () => {
    expect(service.isSmsEnabled()).toBe(true);
  });

  it('envoie un SMS via Orange SMS Pro (HMAC-SHA1)', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          response: [{ status_code: 200, status_text: 'Message envoye' }],
        }),
    } as Response);

    const ok = await service.sendSms('+221 77 123 45 67', 'Code test 123456');
    expect(ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl.startsWith('https://api.orangesmspro.sn:8443/api?')).toBe(true);

    const qs = new URL(calledUrl).searchParams;
    expect(qs.get('token')).toBe('tok123');
    expect(qs.get('subject')).toBe('Bagup');
    expect(qs.get('signature')).toBe('Bagup');
    expect(qs.get('recipient')).toBe('221771234567');
    expect(qs.get('content')).toBe('Code test 123456');

    const timestamp = qs.get('timestamp')!;
    const chaine = `tok123BagupBagup221771234567Code test 123456${timestamp}`;
    const expectedKey = createHmac('sha1', 'priv456').update(chaine, 'utf8').digest('hex');
    expect(qs.get('key')).toBe(expectedKey);

    fetchMock.mockRestore();
  });

  it('envoie un SMS international via Vonage (pas Orange)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExternalNotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const cfg: Record<string, string> = {
                ORANGE_SMS_TOKEN: 'tok123',
                ORANGE_SMS_PRIVATE_KEY: 'priv456',
                ORANGE_SMS_SENDER: 'Bagup',
                VONAGE_API_KEY: 'von-key',
                VONAGE_API_SECRET: 'von-secret',
                VONAGE_FROM: 'Bagup',
              };
              return cfg[key];
            },
          },
        },
      ],
    }).compile();

    const intlService = moduleRef.get(ExternalNotificationsService);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message_uuid: 'uuid-fr' }),
    } as Response);

    const ok = await intlService.sendSms('+33 6 12 34 56 78', 'Code test FR');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.nexmo.com');

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.to).toBe('33612345678');

    fetchMock.mockRestore();
  });
});
