#!/usr/bin/env node
/**
 * Crée les comptes test Amsa Tou Cissé (client, prestataire, commerçant) via l'API admin.
 * Usage: node scripts/create-amsa-test-accounts.mjs [API_BASE]
 */
const API = (process.argv[2] || process.env.API_URL || 'https://admin.bagup.app/api').replace(/\/$/, '');

const PHONE = '+33646095369';
const EMAIL = 'amsatoucisse14@gmail.com';
const PASSWORD = 'BagupAmsa2026!';
const FIRST = 'Amsa';
const LAST = 'Tou Cissé';

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText;
    throw new Error(`${method} ${path} → ${res.status}: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
  }
  return data;
}

async function login(phone, password, role) {
  return request('/auth/login', {
    method: 'POST',
    body: { phone, password, role },
  });
}

async function createUser(adminToken, role) {
  return request('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      firstName: FIRST,
      lastName: LAST,
      phone: PHONE,
      password: PASSWORD,
      role,
      email: EMAIL,
    },
  });
}

async function activateProviderSubscription(providerToken) {
  const sub = await request('/subscriptions', {
    method: 'POST',
    token: providerToken,
    body: { type: 'registration', creditUsed: 0 },
  });
  await request(`/subscriptions/${sub.id}/success`, {
    method: 'PATCH',
    token: providerToken,
    body: { transactionId: `admin-setup-${Date.now()}` },
  });
}

async function setupProviderProfile(providerToken) {
  await request('/users/me', {
    method: 'PATCH',
    token: providerToken,
    body: {
      vehicleType: 'moto',
      vehicleBrand: 'Yamaha',
      vehicleModel: 'NMAX',
      vehiclePlate: 'TEST-AMS',
      zone: 'Dakar',
    },
  });
}

async function activateMerchantSubscription(merchantToken) {
  const sub = await request('/subscriptions', {
    method: 'POST',
    token: merchantToken,
    body: { type: 'merchant_monthly', creditUsed: 0 },
  });
  await request(`/subscriptions/${sub.id}/success`, {
    method: 'PATCH',
    token: merchantToken,
    body: { transactionId: `admin-setup-merchant-${Date.now()}` },
  });
}

async function main() {
  console.log(`API: ${API}`);
  console.log(`Compte: ${FIRST} ${LAST} · ${PHONE} · ${EMAIL}\n`);

  let adminToken;
  const adminCandidates = [
    { phone: '+221700000000', password: 'admin123' },
  ];

  for (const cred of adminCandidates) {
    try {
      const res = await login(cred.phone, cred.password, 'admin');
      adminToken = res.accessToken;
      console.log(`✓ Admin connecté (${cred.phone})`);
      break;
    } catch (e) {
      console.log(`✗ Admin ${cred.phone}: ${e.message}`);
    }
  }

  if (!adminToken) {
    throw new Error('Impossible de se connecter en admin — vérifiez les identifiants admin sur la prod.');
  }

  const roles = ['client', 'provider', 'merchant'];
  const created = {};

  for (const role of roles) {
    try {
      const user = await createUser(adminToken, role);
      created[role] = user;
      console.log(`✓ Compte ${role} créé (id: ${user.id})`);
    } catch (e) {
      if (String(e.message).includes('409') || String(e.message).toLowerCase().includes('existe')) {
        console.log(`→ Compte ${role} existe déjà, connexion…`);
        const loginRes = await login(PHONE, PASSWORD, role);
        created[role] = loginRes.user;
      } else {
        throw e;
      }
    }
  }

  const providerLogin = await login(PHONE, PASSWORD, 'provider');
  await setupProviderProfile(providerLogin.accessToken);
  console.log('✓ Profil prestataire (moto, Dakar)');

  try {
    await activateProviderSubscription(providerLogin.accessToken);
    console.log('✓ Abonnement prestataire activé');
  } catch (e) {
    console.log(`→ Abonnement prestataire: ${e.message}`);
  }

  const merchantLogin = await login(PHONE, PASSWORD, 'merchant');
  try {
    await activateMerchantSubscription(merchantLogin.accessToken);
    console.log('✓ Abonnement commerçant activé');
  } catch (e) {
    console.log(`→ Abonnement commerçant: ${e.message}`);
  }

  console.log('\n--- Récapitulatif ---');
  console.log(`Téléphone : ${PHONE}`);
  console.log(`Email     : ${EMAIL}`);
  console.log(`Mot de passe (identique pour les 3) : ${PASSWORD}`);
  console.log('\nConnexion app : choisir le rôle Client / Prestataire / Commerçant au login.');
  for (const role of roles) {
    const u = created[role];
    console.log(`  ${role.padEnd(10)} → id ${u?.id || '?'}`);
  }
}

main().catch((err) => {
  console.error('\nÉchec:', err.message);
  process.exit(1);
});
