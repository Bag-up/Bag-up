# Marketplace — Architecture Phase 0

> Préparation uniquement. **Aucun code prod / build client** tant que l’app + offre ne sont pas validées.

## Principes

1. **Un seul produit Bag'up** — pas une 2ᵉ app.
2. **Réutiliser** : `Mission` (`collecte_marchandises`), paiements Bictorys/Stripe, uploads Cloudinary, rôle `merchant`, pattern `Subscription`.
3. **Anti-Gaspi ≠ Marketplace** — modèles séparés (`Shop` / `Product` / `MarketplaceOrder`). L’espace merchant actuel (paniers AG) cohabite ; on ajoutera une section « Ma boutique » marketplace.
4. **Builds** : branches / feature flags ; rien de visible en TestFlight/APK public avant Phase 5.

## Ce qui existe déjà

| Brique | Réutilisation |
|--------|----------------|
| `UserRole.merchant` + `businessName/Address/Lat/Lng` | Profil commerçant |
| `Subscription` (provider 5 000 XOF) | Nouveau plan **merchant_monthly 6 500 XOF** |
| `Mission` + `collecte_marchandises` | Auto-créée à commande payée |
| `Payment` + webhooks | Checkout commande (ou payment dédié order) |
| `POST /uploads` (Cloudinary) | Photos boutique / produits |
| Merchant tabs (Anti-Gaspi) | Étendre navigation, ne pas casser AG |

## Décisions techniques proposées

| Sujet | Choix Phase 0 → V1 |
|-------|-------------------|
| Images | URLs Cloudinary (comme AG), 4–6 par produit |
| Abo commerçant | `Subscription.type` étendu ou `plan: merchant_monthly` amount 6500 ; gate avant boutique visible |
| Paiement commande | `MarketplaceOrder` + charge via factory existante ; webhook → statut + spawn mission |
| Commission | 5 % calculée à la commande, stockée (`commissionAmount`, `merchantAmount`) |
| Release J+2 | Champ `payoutEligibleAt` ; process semi-manuel admin V1 |
| FX EUR | Service taux + marge 1–2 % (config) ; affichage mobile seulement en V1 |
| Zone | Filtre `city = Dakar` (ou enum) au lancement |

## Ordre d’implémentation (rappel)

Voir [`PHASES.md`](./PHASES.md) — Phases 1 → 5.

## Fichiers de cette préparation

| Fichier | Contenu |
|---------|---------|
| [`SCHEMA.md`](./SCHEMA.md) | Modèles Prisma cibles |
| [`API.md`](./API.md) | Endpoints |
| [`SCREENS.md`](./SCREENS.md) | Écrans mobile |
| [`schema.prisma.draft`](./schema.prisma.draft) | Snippet à merger en Phase 1 |

## Points ouverts (à trancher en Phase 1)

- [ ] Source du taux de change (API vs taux admin manuel)
- [ ] Payout J+2 : écran admin « à reverser » vs export CSV
- [ ] Merchant avec Anti-Gaspi **et** Marketplace : mêmes tabs ou sous-sections ?
- [ ] Soft-delete produits vs statut `archived` uniquement
