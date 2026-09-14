/**
 * Purge pre-lancement : supprime tous les provider + merchant,
 * et les clients clairement de test / seed.
 * Conserve admin / assistant / manager et les clients « réels ».
 *
 * Usage (VPS) :
 *   cd /var/www/bagup-backend && node scripts/purge-prelaunch-accounts.mjs
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const STAFF_ROLES = new Set(['admin', 'assistant', 'manager']);

function isTestClient(u) {
  const phone = (u.phone || '').replace(/\s/g, '');
  const email = (u.email || '').toLowerCase();
  const first = (u.firstName || '').toLowerCase();
  const last = (u.lastName || '').toLowerCase();

  if (/^\+221770000\d+$/.test(phone)) return true;
  if (/^\+221771234567$/.test(phone)) return true;
  if (/^\+221772345678$/.test(phone)) return true;
  if (email.includes('test@') || email.endsWith('@bagup.sn') || email.endsWith('@example.com')) return true;
  if (first === 'john' && last === 'doe') return true;
  if (first === 'review' && last === 'google') return true;
  if (first === 'bkfvvp' || last === 'pllsml') return true;
  // Comptes multi-rôles Amsa / scripts de test
  if (phone === '+33646095369') return true;
  return false;
}

async function hardDeleteUser(tx, userId) {
  const shops = await tx.shop.findMany({ where: { ownerId: userId }, select: { id: true } });
  for (const shop of shops) {
    const orders = await tx.marketplaceOrder.findMany({ where: { shopId: shop.id }, select: { id: true } });
    for (const order of orders) {
      await tx.marketplaceOrderItem.deleteMany({ where: { orderId: order.id } });
    }
    await tx.marketplaceOrder.deleteMany({ where: { shopId: shop.id } });
    await tx.product.deleteMany({ where: { shopId: shop.id } });
  }
  await tx.shop.deleteMany({ where: { ownerId: userId } });

  const buyerOrders = await tx.marketplaceOrder.findMany({ where: { buyerId: userId }, select: { id: true } });
  for (const order of buyerOrders) {
    await tx.marketplaceOrderItem.deleteMany({ where: { orderId: order.id } });
  }
  await tx.marketplaceOrder.deleteMany({ where: { buyerId: userId } });

  const baskets = await tx.antiGaspiBasket.findMany({ where: { merchantId: userId }, select: { id: true } });
  for (const basket of baskets) {
    const reservations = await tx.antiGaspiReservation.findMany({
      where: { basketId: basket.id },
      select: { id: true },
    });
    for (const reservation of reservations) {
      await tx.antiGaspiTransaction.deleteMany({ where: { reservationId: reservation.id } });
    }
    await tx.antiGaspiReservation.deleteMany({ where: { basketId: basket.id } });
  }
  await tx.antiGaspiBasket.deleteMany({ where: { merchantId: userId } });

  const clientReservations = await tx.antiGaspiReservation.findMany({
    where: { clientId: userId },
    select: { id: true },
  });
  for (const reservation of clientReservations) {
    await tx.antiGaspiTransaction.deleteMany({ where: { reservationId: reservation.id } });
  }
  await tx.antiGaspiReservation.deleteMany({ where: { clientId: userId } });

  // Courses (passager / chauffeur)
  const rideIds = (
    await tx.ride.findMany({
      where: { OR: [{ passengerId: userId }, { driverId: userId }] },
      select: { id: true },
    })
  ).map((r) => r.id);
  if (rideIds.length) {
    await tx.rideOffer.deleteMany({ where: { rideId: { in: rideIds } } });
    await tx.rating.deleteMany({ where: { rideId: { in: rideIds } } });
    await tx.payment.deleteMany({ where: { rideId: { in: rideIds } } });
    await tx.ride.deleteMany({ where: { id: { in: rideIds } } });
  }
  await tx.rideOffer.deleteMany({ where: { driverId: userId } });
  await tx.ride.updateMany({ where: { driverId: userId }, data: { driverId: null } });

  const clientMissionIds = (
    await tx.mission.findMany({ where: { clientId: userId }, select: { id: true } })
  ).map((m) => m.id);
  for (const missionId of clientMissionIds) {
    const conversation = await tx.conversation.findFirst({ where: { missionId } });
    if (conversation) {
      await tx.message.deleteMany({ where: { conversationId: conversation.id } });
      await tx.conversation.delete({ where: { id: conversation.id } });
    }
    await tx.dispute.deleteMany({ where: { missionId } });
    await tx.rating.deleteMany({ where: { missionId } });
    await tx.payment.deleteMany({ where: { missionId } });
    await tx.marketplaceOrder.updateMany({ where: { missionId }, data: { missionId: null } });
  }
  await tx.mission.deleteMany({ where: { clientId: userId } });
  await tx.mission.updateMany({ where: { providerId: userId }, data: { providerId: null } });

  const conversations = await tx.conversation.findMany({
    where: { OR: [{ clientId: userId }, { providerId: userId }] },
    select: { id: true },
  });
  for (const conversation of conversations) {
    await tx.message.deleteMany({ where: { conversationId: conversation.id } });
  }
  await tx.conversation.deleteMany({
    where: { OR: [{ clientId: userId }, { providerId: userId }] },
  });

  await tx.message.deleteMany({ where: { senderId: userId } });
  await tx.rating.deleteMany({ where: { OR: [{ raterId: userId }, { ratedId: userId }] } });
  await tx.payment.deleteMany({ where: { userId } });
  await tx.subscription.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.dispute.deleteMany({ where: { raisedById: userId } });
  await tx.referral.deleteMany({
    where: { OR: [{ referrerId: userId }, { referredId: userId }] },
  });
  await tx.loyaltyReward.deleteMany({ where: { userId } }).catch(() => {});
  await tx.providerVehicle.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}

async function main() {
  const all = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const toDelete = all.filter((u) => {
    if (STAFF_ROLES.has(u.role)) return false;
    if (u.role === 'provider' || u.role === 'merchant') return true;
    if (u.role === 'client' && isTestClient(u)) return true;
    return false;
  });

  const keepClients = all.filter((u) => u.role === 'client' && !isTestClient(u));
  const staff = all.filter((u) => STAFF_ROLES.has(u.role));

  console.log(
    JSON.stringify(
      {
        total: all.length,
        staffKeep: staff.length,
        clientsKeep: keepClients.length,
        toDelete: toDelete.length,
        byRole: {
          provider: toDelete.filter((u) => u.role === 'provider').length,
          merchant: toDelete.filter((u) => u.role === 'merchant').length,
          clientTest: toDelete.filter((u) => u.role === 'client').length,
        },
        deletePreview: toDelete.map((u) => ({
          role: u.role,
          phone: u.phone,
          name: [u.firstName, u.lastName].filter(Boolean).join(' '),
        })),
        keepClientsPreview: keepClients.map((u) => ({
          phone: u.phone,
          name: [u.firstName, u.lastName].filter(Boolean).join(' '),
        })),
      },
      null,
      2,
    ),
  );

  if (process.env.PURGE_DRY_RUN === '1') {
    console.log('DRY_RUN — aucune suppression');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const u of toDelete) {
    try {
      await prisma.$transaction((tx) => hardDeleteUser(tx, u.id), { timeout: 60000 });
      ok += 1;
      console.log(`DELETED ${u.role} ${u.phone}`);
    } catch (e) {
      fail += 1;
      console.error(`FAIL ${u.role} ${u.phone}:`, e.message || e);
    }
  }

  const after = await prisma.user.groupBy({ by: ['role'], _count: true });
  console.log(JSON.stringify({ deletedOk: ok, deletedFail: fail, after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
