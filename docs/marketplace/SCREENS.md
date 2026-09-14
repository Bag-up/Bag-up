# Marketplace — Écrans mobile (draft)

Navigation actuelle merchant = Anti-Gaspi. **Ne pas casser AG.**  
Proposition : onglet ou entrée **« Boutique »** à côté des tabs AG, ou switch « Anti-Gaspi | Marketplace » sur le dashboard merchant.

Builds marketplace : **Phase 5 uniquement** pour le client.

---

## Commerçant (`merchant`)

| Écran | Route / stack | Phase | Description |
|-------|---------------|-------|-------------|
| Ma boutique (hub) | `ShopHub` | 2 | Résumé boutique, abo, accès catalogue / commandes |
| Éditer boutique | `ShopEdit` | 2 | Nom, logo, cover, desc, ville, catégorie, WhatsApp |
| Mes produits | `ShopProducts` | 2 | Liste + filtres statut |
| Éditer produit | `ShopProductEdit` | 2 | Champs + upload 4–6 photos + publish |
| Abonnement boutique | `ShopSubscription` | 2 | 6 500 FCFA / mois (réutiliser checkout) |
| Commandes boutique | `ShopOrders` | 4 | Liste + détail + « Marquer préparé » |
| Détail commande | `ShopOrderDetail` | 4 | Statuts, deadline 48h, lien tracking |

**Gate :** si pas d’abo actif → CTA paiement (comme `ProviderSubscriptionGate`).

---

## Client (`client`)

| Écran | Route / stack | Phase | Description |
|-------|---------------|-------|-------------|
| Marketplace home | `MarketHome` | 3 | Boutiques Dakar actives |
| Boutique | `MarketShop` | 3 | Infos + grille produits |
| Fiche produit | `MarketProduct` | 3 | Photos, desc, **prix TTC**, poids |
| Checkout | `MarketCheckout` | 3 | Adresse livraison, récap produit/livraison, payer |
| Paiement | réutiliser flow `PaymentScreen` / checkout | 3 | Initiate + webhook |
| Mes commandes market | `MarketOrders` | 3–4 | Liste |
| Suivi commande | `MarketOrderTracking` | 4 | Statuts + tracking mission existant si possible |
| Switch devise | dans fiche / checkout | 5 | EUR défaut hors SN |

Entrée UX proposée : carte / entrée **« Marketplace »** ou **« Boutiques Sénégal »** sur le Home client (feature flag jusqu’à Phase 5).

---

## Prestataire

Pas de nouvel écran dédié V1 : la mission apparaît comme une **collecte marchandises** classique dans le flux existant (`serviceDetails` enrichi : shopName, orderNumber, product list).

---

## Admin (web)

| Page | Phase | Description |
|------|-------|-------------|
| Shops pilote | 2–5 | Approve / hide shops |
| Payouts J+2 | 4–5 | Liste eligible + mark paid |

Priorité basse si temps serré : actions via SQL / endpoints Postman en pilote.

---

## Feature flag (recommandé)

```ts
// ex. EXPO_PUBLIC_MARKETPLACE_ENABLED=false sur builds client actuels
```

- `false` : aucun écran market visible (app actuelle inchangée pour validation)
- `true` : builds pilote Phase 5

---

## Wireflow résumé

```
Commerçant: Hub → Edit Shop → Products → Publish
                → Subscription (si besoin)
                → Orders → Mark prepared

Client: Home Market → Shop → Product (prix TTC)
      → Checkout → Pay → Orders → Tracking

System: Payment webhook → Order paid → Create Mission
      → Status sync → Delivered → payoutEligibleAt = +2j
      → Cron 48h prep → cancel + refund
```
