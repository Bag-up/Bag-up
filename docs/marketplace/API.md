# Marketplace — API (draft)

Base : `/api` existant · Auth JWT · Rôles indiqués.

## Shops (boutiques)

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/marketplace/shops` | merchant | Créer sa boutique (1 shop / owner en V1) |
| GET | `/marketplace/shops/me` | merchant | Ma boutique |
| PATCH | `/marketplace/shops/me` | merchant | Mettre à jour fiche |
| GET | `/marketplace/shops` | public/auth | Liste boutiques `active` + abo OK · filtre `city` |
| GET | `/marketplace/shops/:id` | public/auth | Détail boutique + produits disponibles |

## Products

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/marketplace/products` | merchant | Créer produit (shop = me) |
| GET | `/marketplace/products/me` | merchant | Mes produits |
| GET | `/marketplace/products/:id` | public/auth | Fiche produit (+ prix TTC estimé si query adresse) |
| PATCH | `/marketplace/products/:id` | merchant | Éditer |
| POST | `/marketplace/products/:id/publish` | merchant | Publish si ≥ 4 photos + stock + poids |
| PATCH | `/marketplace/products/:id/archive` | merchant | Archiver |

**Publish rules :** `photoUrls.length >= 4`, `weightKg > 0`, `priceXof > 0`, shop `active`.

## Pricing / delivery quote

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/marketplace/quote` | auth | Body: productId(s), delivery address → `{ productTotal, deliveryFee, total, totalEur? }` |

Réutilise logique tarifs / geo existante autant que possible (Dakar).

## Orders

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/marketplace/orders` | client | Créer commande `pending_payment` |
| POST | `/marketplace/orders/:id/initiate-payment` | client | Lance Bictorys/Stripe (comme missions) |
| GET | `/marketplace/orders/me` | client | Mes commandes |
| GET | `/marketplace/orders/:id` | client/merchant/admin | Détail (+ tracking mission) |
| GET | `/marketplace/shops/me/orders` | merchant | Commandes de ma boutique |
| POST | `/marketplace/orders/:id/mark-prepared` | merchant | Prêt pour collecte |

**Webhook paiement (existant étendu) :**  
sur succès → `paid` + `awaiting_preparation` + `preparationDeadline = now+48h` + **créer Mission** `collecte_marchandises`.

## Subscription commerçant

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/subscriptions` | merchant | `type: merchant_monthly`, amount 6500 |
| POST | `/subscriptions/:id/initiate` | merchant | Paiement |
| GET | `/subscriptions/me` | merchant | Statut abo |

Cron expiry existant : si abo merchant expiré → shops → `hidden`.

## Admin pilote

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/admin/marketplace/shops` | admin | Liste + pending_review |
| PATCH | `/admin/marketplace/shops/:id/status` | admin | activer / suspendre (onboarding manuel) |
| GET | `/admin/marketplace/payouts` | admin | Commandes `eligible` J+2 |
| POST | `/admin/marketplace/payouts/:orderId/mark-paid` | admin | Marquer reversé (semi-manuel V1) |

## Uploads

Réutiliser `POST /uploads` (JWT) → URL Cloudinary dans `logoUrl` / `coverUrl` / `photoUrls[]`.

## Notifications (événements)

| Événement | Destinataires |
|-----------|----------------|
| Nouvelle commande payée | Commerçant |
| Commande préparée | Client (+ trigger collecte si pas déjà) |
| Mission acceptée / collectée / livrée | Client + commerçant |
| Deadline 48h proche / annulée | Client + commerçant |
| Abo expire ≤ 3j | Commerçant |

## Erreurs métier utiles

- `SHOP_SUBSCRIPTION_REQUIRED`
- `PRODUCT_PHOTOS_MIN_4`
- `PRODUCT_NOT_PUBLISHABLE`
- `ORDER_PREPARATION_TIMEOUT`
- `SHOP_NOT_IN_DAKAR` (V1)
