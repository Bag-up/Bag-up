#!/usr/bin/env node
/**
 * Finalise les comptes Amsa (vérif admin + abo presta/commerçant).
 * Nécessite un token admin : ADMIN_TOKEN=... node scripts/finalize-amsa-accounts.mjs
 */
const API = (process.env.API_URL || 'https://admin.bagup.app/api').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const PHONE = '+33646095369';
const PASS = 'BagupAmsa2026!';

const IDS = {
  client: 'ee423f95-56f4-4ee2-b451-7da7733cc509',
  provider: '95e5fee9-b10d-4d2b-8762-2a7561f453c1',
  merchant: 'b7c53367-f644-4e48-886e-734fe16a70d6',
};

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

async function login(role) {
  const res = await request('/auth/login', { method: 'POST', body: { phone: PHONE, password: PASS, role } });
  return res.accessToken;
}

async function verifyUser(userId) {
  return request(`/users/${userId}/verify`, { method: 'PATCH', token: ADMIN_TOKEN });
}

async function activateSubscription(token, type) {
  const sub = await request('/subscriptions', { method: 'POST', token, body: { type, creditUsed: 0 } });
  await request(`/subscriptions/${sub.id}/success`, {
    method: 'PATCH',
    token,
    body: { transactionId: `setup-${type}-${Date.now()}` },
  });
}

async function main() {
  if (!ADMIN_TOKEN) {
    console.error('ADMIN_TOKEN requis (login admin sur https://admin.bagup.app)');
    process.exit(1);
  }

  for (const role of ['provider', 'merchant']) {
    await verifyUser(IDS[role]);
    console.log(`✓ ${role} validé (isVerified)`);
  }

  const providerToken = await login('provider');
  await activateSubscription(providerToken, 'registration');
  console.log('✓ Abonnement prestataire (adhésion) activé');

  const merchantToken = await login('merchant');
  try {
    await activateSubscription(merchantToken, 'merchant_monthly');
    console.log('✓ Abonnement commerçant activé');
  } catch (e) {
    console.log('→ Abonnement commerçant:', e.message);
  }

  console.log('\nComptes prêts pour test (après OTP SMS côté Amsa).');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
