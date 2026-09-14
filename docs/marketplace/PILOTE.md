# Marketplace — Guide pilote (V1)

## Feature flag

| Contexte | Marketplace visible ? |
|----------|------------------------|
| `npx expo start` (dev) | Oui (`__DEV__`) |
| Build `preview` / `production` | Non (sauf si flag) |
| Build **`pilot-marketplace`** | Oui (`EXPO_PUBLIC_MARKETPLACE_ENABLED=true`) |

---

## Recette (à faire en local / Expo avant rebuild)

Mot de passe test : **`BagupTest2026`**

| # | Rôle | Compte | À vérifier | OK ? |
|---|------|--------|------------|------|
| 1 | Client SN | `+221770000301` | Accueil → Boutiques Sénégal visible | ☐ |
| 2 | Client FR | `+221770000302` | Prix en **€** par défaut + switch FCFA | ☐ |
| 3 | Client | idem | Catalogue → produit → checkout TTC → payer | ☐ |
| 4 | Client | idem | Mes commandes + statut « préparation » | ☐ |
| 5 | Merchant market* | (créer / abo) | Boutique → produit ≥4 photos → publier | ☐ |
| 6 | Merchant market | idem | Commande reçue → **Marquer préparé** | ☐ |
| 7 | Prestataire | `+221770000101` | Mission **absente** avant préparation | ☐ |
| 8 | Prestataire | idem | Mission **visible** après préparation → accepter | ☐ |
| 9 | Prestataire | idem | Statuts jusqu’à livré | ☐ |
| 10 | Client | | Suivi livraison | ☐ |
| 11 | Anti-Gaspi | `+221770000201` | Publier panier (régression) | ☐ |
| 12 | Client | `+221770000301` | Réserver panier AG (régression) | ☐ |

\*Commerçant marketplace : pas encore seedé — créer un compte `merchant` + abo 6 500 FCFA, ou on peut en créer 1–2 sur demande.

### Hors scope recette V1
- Push lock-screen (désactivé)
- Payout auto (admin J+2)
- Bictorys réel si non configuré (mock OK)

---

## Builds pilote iOS + Android

Profil EAS : **`pilot-marketplace`**  
(= preview + flag marketplace + API prod)

```bash
cd bagup-mobile

# Android → APK installable
npm run build:pilot:android

# iOS → IPA (TestFlight / distribution interne)
npm run build:pilot:ios

# Les deux
npm run build:pilot
```

**Ne pas** utiliser ce profil pour le build « validation app actuelle » du client (sans marketplace).

Après build :
1. Android : envoyer le lien APK aux testeurs
2. iOS : `eas submit` ou lien Expo → TestFlight interne
3. Vérifier que **Boutique** / **Boutiques Sénégal** apparaissent

---

## Comptes test (prod)

| Rôle | Téléphone |
|------|-----------|
| Prestataire | `+221770000101` / `+221770000102` |
| Commerçant Anti-Gaspi | `+221770000201` / `+221770000202` |
| Client | `+221770000301` (SN) / `+221770000302` (FR) |

## Admin API

- `GET /api/marketplace/admin/shops`
- `PATCH /api/marketplace/admin/shops/:id/status`
- `GET /api/marketplace/admin/payouts`
- `PATCH /api/marketplace/admin/orders/:id/payout`
- `GET /api/marketplace/fx`

## Limites V1

- Push téléphone off
- Paiement SN souvent mock sans Bictorys
- Payout commerçant semi-manuel
- Zone Dakar

---

*Bag'up Marketplace — pilote 10 commerçants*
