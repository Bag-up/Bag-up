# Marketplace — Schéma Prisma (cible)

À merger dans `bagup-backend/prisma/schema.prisma` en **Phase 1** uniquement.

## Enums

```prisma
enum ShopStatus {
  draft
  pending_review   // onboarding manuel pilote
  active
  suspended
  hidden           // abo expiré → invisible client
}

enum ProductStatus {
  draft
  available
  out_of_stock
  archived
}

enum MarketplaceOrderStatus {
  pending_payment
  paid                     // paiement confirmé
  awaiting_preparation     // commerçant
  collection_scheduled
  collected
  in_transit
  delivered
  cancelled
  dispute
}

enum MarketplacePayoutStatus {
  held          // escrow
  eligible      // J+2 atteint
  paid_out      // reversé
  cancelled
}
```

## Modèles

```prisma
model Shop {
  id              String     @id @default(uuid())
  ownerId         String
  name            String
  logoUrl         String?
  coverUrl        String?
  description     String     // max 150 côté API
  city            String     // "Dakar" au lancement
  region          String?
  category        String     // artisanat | mode | alimentaire | cosmetique | ...
  phone           String
  whatsapp        String?
  status          ShopStatus @default(draft)
  avgRating       Float      @default(0)
  ratingsCount    Int        @default(0)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  owner           User       @relation("ShopOwner", fields: [ownerId], references: [id])
  products        Product[]
  orders          MarketplaceOrder[]

  @@index([status, city])
  @@index([ownerId])
}

model Product {
  id              String        @id @default(uuid())
  shopId          String
  name            String
  priceXof        Decimal       // prix produit seul
  description     String        // max 300 côté API
  photoUrls       String[]      // 4–6 URLs
  weightKg        Decimal
  lengthCm        Decimal?
  widthCm         Decimal?
  heightCm        Decimal?
  stock           Int           @default(0)
  status          ProductStatus @default(draft)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  shop            Shop          @relation(fields: [shopId], references: [id])
  orderItems      MarketplaceOrderItem[]

  @@index([shopId, status])
}

model MarketplaceOrder {
  id                 String                   @id @default(uuid())
  orderNumber        String                   @unique
  buyerId            String
  shopId             String
  status             MarketplaceOrderStatus   @default(pending_payment)

  // Montants (XOF)
  productTotalXof    Decimal                  // somme produits
  deliveryFeeXof     Decimal
  totalXof           Decimal                  // TTC = product + delivery
  commissionRate     Decimal                  @default(5) // %
  commissionAmount   Decimal                  // 5 % du productTotal
  merchantAmount     Decimal                  // productTotal - commission

  currencyDisplay    String?                  // EUR | XOF affiché au buyer
  fxRate             Decimal?                 // taux utilisé si EUR
  fxMarginPercent    Decimal?                 // 1–2
  totalDisplay       Decimal?                 // montant affiché devise client

  // Escrow / payout
  payoutStatus       MarketplacePayoutStatus  @default(held)
  payoutEligibleAt   DateTime?                // deliveredAt + 2j
  paidOutAt          DateTime?

  // Logistique
  missionId          String?                  @unique
  pickupAddress      String
  pickupLat          Float?
  pickupLng          Float?
  deliveryAddress    String
  deliveryLat        Float?
  deliveryLng        Float?
  deliveryCountry    String?                  // pour FX / Stripe

  preparationDeadline DateTime?               // paidAt + 48h
  paidAt              DateTime?
  deliveredAt         DateTime?
  cancelledAt         DateTime?
  cancelReason        String?

  paymentId          String?                  // lien Payment si réutilisé
  createdAt          DateTime                 @default(now())
  updatedAt          DateTime                 @updatedAt

  buyer              User                     @relation("MarketplaceBuyer", fields: [buyerId], references: [id])
  shop               Shop                     @relation(fields: [shopId], references: [id])
  mission            Mission?                 @relation(fields: [missionId], references: [id])
  items              MarketplaceOrderItem[]

  @@index([buyerId, status])
  @@index([shopId, status])
  @@index([payoutStatus, payoutEligibleAt])
}

model MarketplaceOrderItem {
  id            String   @id @default(uuid())
  orderId       String
  productId     String
  productName   String   // snapshot
  unitPriceXof  Decimal
  quantity      Int      @default(1)
  weightKg      Decimal

  order         MarketplaceOrder @relation(fields: [orderId], references: [id])
  product       Product          @relation(fields: [productId], references: [id])

  @@index([orderId])
}
```

## Relations à ajouter sur modèles existants

```prisma
// User
shopsOwned          Shop[]              @relation("ShopOwner")
marketplaceOrders   MarketplaceOrder[]  @relation("MarketplaceBuyer")

// Mission
marketplaceOrder    MarketplaceOrder?
```

## Abonnement commerçant

Deux options (trancher Phase 1) :

**A (simple)** — Étendre `SubscriptionType` :
```prisma
enum SubscriptionType {
  registration
  monthly
  merchant_monthly   // 6500 XOF
}
```
Gate : shop `active` seulement si subscription merchant active.

**B** — Champ `Shop.subscriptionId` dédié.

Recommandation : **A** (réutilise initiate / webhook / cron expiry).

## Mapping statuts commande ↔ mission

| MarketplaceOrderStatus | MissionStatus (approx.) |
|------------------------|-------------------------|
| paid / awaiting_preparation | — (pas encore de mission ou pending) |
| collection_scheduled | `accepted` / `en_route` |
| collected | `picked_up` |
| in_transit | `in_progress` |
| delivered | `delivered` |
| cancelled | `cancelled` |
