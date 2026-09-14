# Marketplace Commerçants — Plan par phases

> Module intégré à l’app Bag'up (pas une app séparée).  
> **Statut global :** 🟡 En préparation — code / builds **bloqués** tant que :
> 1. l’app actuelle n’est pas validée par le client ;
> 2. l’offre V1 (350 000 FCFA) n’est pas validée par écrit.

**Offre :** `Offre_Marketplace_Commercants_V1.pdf`  
**Pilote :** 10 commerçants · Dakar · app only  
**CGV commerçant :** à recevoir avant démarrage contractuel

---

## Vue d’ensemble

```
Phase 0          Phase 1           Phase 2            Phase 3
Préparation ──► Fondation     ──► Espace           ──► Achat client
(sans build)     (API / modèles)   commerçant           (catalogue + checkout)
                                         │
                                         ▼
                                   Phase 4
                                   Logistique & argent
                                   (mission auto, 5 %, J+2, 48h)
                                         │
                                         ▼
                                   Phase 5
                                   Devise, recette & builds pilote
```

| Phase | Contenu | Dépendance | Statut |
|-------|---------|------------|--------|
| **0** | Préparation (archi, schéma, wireframes) | — | 🟢 Docs prêts — en attente validation client |
| **1** | Fondation technique (modèles + API) | Offre + app validées | 🟡 Schéma + API shops/products (db push à faire) |
| **2** | Espace commerçant (Ma boutique) | Phase 1 | 🟡 Écrans + flag (dev) |
| **3** | Achat client (catalogue + checkout) | Phase 2 | 🟢 Fait (flag) |
| **4** | Logistique & argent | Phase 3 | 🟢 Fait |
| **5** | Devise EUR + recette + builds pilote | Phase 4 | 🟡 En cours |

**Règle builds :** aucune livraison TestFlight / APK marketplace avant la fin de la Phase 5 (sauf build interne privé si besoin).

---

## Phase 0 — Préparation (maintenant)

**Objectif :** tout cadrer sans toucher aux builds que le client teste.

### À faire
- [x] Valider ce plan de phases en interne
- [ ] Attendre validation app actuelle (iOS / Android)
- [ ] Attendre validation écrite de l’offre V1
- [ ] Recevoir / relancer les **CGV commerçant**
- [x] Schéma Prisma cible (`Shop`, `Product`, `MarketplaceOrder`, lien `Mission`) → [`SCHEMA.md`](./SCHEMA.md) + [`schema.prisma.draft`](./schema.prisma.draft)
- [x] Liste des endpoints API (draft) → [`API.md`](./API.md)
- [x] Cartographie écrans mobile (commerçant + client) → [`SCREENS.md`](./SCREENS.md)
- [x] Réutilisation documentée → [`ARCHI.md`](./ARCHI.md)
- [ ] Points ouverts tranchés : FX, payout J+2 UI, cohabitation Anti-Gaspi

### Livrable
Document d’archi court + schéma + liste d’écrans (pas de code en prod). ✅ *Docs livrés le 23/07/2026*

### Hors Phase 0
Aucun merge vers la branche de build client, aucun nouvel écran visible en TestFlight/APK public.

---

## Phase 1 — Fondation technique

**Objectif :** socle données & API, sans UI finale.

### Backend
- [x] Modèles : `Shop` (boutique), `Product`, `MarketplaceOrder` (+ lignes / items)
- [x] Champs clés boutique / produit
- [x] Lien commande → `missionId` (nullable)
- [x] Escrow / commission : champs sur `MarketplaceOrder`
- [x] API CRUD boutique / produits (rôle `merchant`)
- [x] API catalogue public (boutiques actives)
- [x] Gate abonnement `merchant_monthly` **6 500 FCFA**
- [x] API commandes / quote / webhook mission (Phase 3–4)
- [ ] `prisma db push` sur VPS / Postgres local (Docker arrêté en local au moment du commit)

### Livrable
API shops/products testable ; pas encore d’écran marketplace client.

---

## Phase 2 — Espace commerçant (app)

**Objectif :** le commerçant gère sa boutique dans l’app.

### Mobile
- [x] Section / navigation « Ma boutique » (onglet + flag)
- [x] Création / édition fiche boutique
- [x] Liste produits + création / édition / archivage
- [x] Upload photos (min 4 pour publier, max 6)
- [x] Stock & statuts (`disponible` / brouillon / archivé)
- [x] Écran abonnement / renouvellement 6 500 FCFA
- [ ] Commandes boutique (Phase 4)

### Règles
- Boutique invisible côté client si abo expiré / en attente
- Publication produit bloquée sans les 4 photos obligatoires

### Feature flag
`MARKETPLACE_ENABLED` = `__DEV__` **ou** `EXPO_PUBLIC_MARKETPLACE_ENABLED=true`  
→ builds production actuelles **sans** le flag : onglet Boutique absent.

### Livrable
Commerçant pilote peut renseigner boutique + catalogue (en dev / build flaggé).

---

## Phase 3 — Achat client (app)

**Objectif :** le client diaspora / SN voit et paie.

### Mobile
- [x] Liste boutiques / catalogue (`MarketHome`, entrée Home « Boutiques Sénégal »)
- [x] Fiche produit (`MarketProduct` + galerie)
- [x] Prix : produit en catalogue ; **TTC (produit + livraison)** au checkout avant paiement
- [x] Récap : détail produit / livraison
- [x] Checkout via Bag'up (routage existant SN/diaspora + mock si provider absent)
- [x] Confirmation de commande + suivi statut basique (`MarketOrders` / détail)

### Backend
- [x] Calcul livraison (poids / distance — geo + surpoids Dakar)
- [x] Création `MarketplaceOrder` + paiement ; passage `awaiting_preparation` au succès (webhook / mock)

### Livrable
Achat réel possible de bout en bout (sans encore exiger tout le polish logistique). ✅

---

## Phase 4 — Logistique & argent

**Objectif :** chaque vente déclenche la collecte ; argent aligné avec les décisions métier.

### Backend / ops
- [x] Trigger : commande payée → mission `collecte_marchandises` (adresses, poids, client préremplis)
- [x] Dispatch auto après « colis préparé » (`dispatchReady`)
- [x] Mapping statuts commande ↔ mission
- [x] Notifications client + commerçant (in-app) à chaque changement clé
- [x] Commission **5 %** sur prix produit uniquement
- [x] Escrow jusqu’à `livré` puis éligibilité **J+2**
- [x] Release commerçant **J+2** (admin mark paid_out — semi-manuel V1)
- [x] Job : non-préparation **48h** → annulation + remboursement (statut payment refunded)

### Mobile
- [x] Commandes boutique (`ShopOrders` / détail + marquer préparé)
- [x] Mes commandes client (`MarketOrders` / détail + tracking)

### Livrable
Tunnel : **achat → mission → collecte → livraison → release J+2**.

---

## Phase 5 — Devise, recette & builds pilote

**Objectif :** finition + livraison aux testeurs.

### À faire
- [x] Affichage **EUR** par défaut hors SN (détection pays) + switch manuel
- [x] Marge change 1–2 % configurable (`MARKETPLACE_FX_MARGIN_PERCENT`)
- [x] Doc courte usage commerçant + admin pilote → [`PILOTE.md`](./PILOTE.md)
- [ ] Tests parcours commerçant + client + prestataire (checklist dans PILOTE.md)
- [ ] Correctifs bloquants (au fil des retours)
- [x] Profil EAS **`pilot-marketplace`** + scripts `build:pilot:*` (builds pas encore lancés)
- [ ] Builds iOS / Android pilote (quand recette OK)
- [ ] Onboarding manuel des 10 commerçants (qualité photos / prix)

### Livrable
Module V1 prêt pour le pilote + builds communiqués au client.

---

## Hors V1 (phases futures — nouveau plan)

À traiter **après** le pilote, avec un nouveau devis / accord :

- Inscription libre-service commerçants
- Collecte hors Dakar
- Back-office web commerçant
- Payouts multi-devises complexes / 100 % auto
- Arbitrage litige ultra-automatisé
- Suspension auto « 3 strikes »
- Avis / notes avancés
- Contrat de maintenance formalisé

---

## Décisions métier déjà tranchées (rappel)

| Sujet | Décision |
|-------|----------|
| Surface client | App Bag'up only |
| Surface commerçant | App mobile (pas de BO web V1) |
| Livraison | Payée par le client, prix TTC affiché |
| Commission | 5 % sur produit seul |
| Release | J+2 après livré |
| Zone | Dakar |
| Non-préparation | Annulation + remboursement à 48h |
| Devise | EUR hors SN + switch |
| Free Money | Non (pas supporté Bictorys SN) |
| Litiges | Process interne Bag'up |

---

## Conditions de démarrage Phase 1

| # | Condition | OK ? |
|---|-----------|------|
| 1 | App actuelle validée (feedback client) | ☐ |
| 2 | Offre V1 350 000 FCFA validée par écrit | ☐ |
| 3 | CGV commerçant reçues (ou accord de démarrer sans) | ☐ |
| 4 | Interlocuteur pilote désigné | ☐ |

---

## Suivi rapide

| Phase | Début | Fin | Notes |
|-------|-------|-----|-------|
| 0 Préparation | 23/07/2026 | — | En cours |
| 1 Fondation | | | |
| 2 Commerçant | | | |
| 3 Achat client | | | |
| 4 Logistique & argent | | | |
| 5 Recette & builds | | | |

---

*Document de travail technique — Marketplace Bag'up — à mettre à jour à chaque phase.*
