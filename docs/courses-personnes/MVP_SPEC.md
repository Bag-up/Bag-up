# Spec MVP — Bag’up Courses (personnes)

Complète [`YANGO_BENCHMARK.md`](./YANGO_BENCHMARK.md).  
Objectif MVP : **même fluidité de demande que Yango jusqu’au « Commander »**, puis matching / live / paiement par phases.

**Règle d’or** : ne pas casser ni remplacer livraison, anti-gaspi, marketplace.

---

## 1. Position produit

| | Livraison Bag’up (existant) | Course Bag’up (nouveau) |
|--|----------------------------|-------------------------|
| Objet | Colis / courses / démarches | Passager |
| Adresses | Retrait → Livraison | Départ → Destination |
| Acteur | Livreur + contacts parfois | Passager + chauffeur |
| Prix | Grille livraison + formule | **Grille Course dédiée** |
| Entrée UI | Tuiles services actuelles | **Nouvelle tuile « Course »** |

Intégration : **même app**, entrée Accueil séparée.

---

## 2. Parcours cible (≤ 3 actions avant Commander)

```text
Accueil → Course
  1. Destination (départ = GPS, modifiable)
  2. Voir prix + choisir moto / voiture
  3. Commander
→ Recherche → Chauffeur assigné → Suivi → Arrivée → Paiement / note
```

Pas de wizard 3 étapes type CreateRequest livraison. Un **sheet sur carte** (inspiré Yango).

---

## 3. Écrans MVP

### 3.1 Accueil

- Nouvelle tuile / entrée **Course** (icône distincte Colis).
- Ne pas ouvrir `CreateRequestScreen` actuel.

### 3.2 Écran Course (demande)

- Carte plein écran.
- Pin / adresse **départ** (GPS + autocomplete via `AddressInput` / Places).
- Champ **destination** dominant.
- Dès départ + destination GPS valides → estimate prix + ETA.
- Sélecteur **Moto | Voiture**.
- CTA unique **Commander**.
- Pas de contacts, formule Groupé/Express, photos colis, etc.

### 3.3 Recherche

- État `searching` + annuler.
- Message simple (« Recherche d’un chauffeur… »).

### 3.4 Assignation + suivi

- Réutiliser patterns Tracking existants si possible, avec champs Course :
  - chauffeur (nom, note, avatar)
  - véhicule (type, marque/modèle, couleur, **plaque**)
  - ETA + position live (phase 3)
- Actions : appeler / (chat minimal later) / annuler selon règles.

### 3.5 Fin

- Montant final + tunnel paiement Bag’up (Orange Money / Wave / carte).
- Note 1–5 + commentaire optionnel.

---

## 4. Réemploi technique Bag’up

| Besoin Course | Existant | Action |
|---------------|----------|--------|
| Auth client / prestataire | `AuthContext`, login | Réutiliser |
| Adresses + Places | [`AddressInput.tsx`](../../bagup-mobile/src/components/ui/AddressInput.tsx), `places.ts` | Réutiliser |
| Distance route | [`geo.service.ts`](../../bagup-backend/src/geo/geo.service.ts) `routeDistance` | Réutiliser |
| Affichage prix | Pattern estimate CreateRequest | Nouveau endpoint / grille **ride** |
| Paiement | `PaymentScreen`, Bictorys / Stripe | Réutiliser |
| Profil véhicule livreur | `vehicleType`, plaque, etc. | Réutiliser pour fiche chauffeur |
| Matching missions | `missions.service` livraison | **Ne pas brancher tel quel** — nouveau domaine |
| Suivi live | TrackingScreen | Adapter / écran Ride dédié |

### Domaine données (nouveau)

Ne **pas** surcharger `Mission` livraison sans discrimination claire.

Proposition :

- Entité `Ride` (ou `missionType: 'ride_passenger'` **strictement** isolé côté API/UX).
- Statuts dédiés (voir §5).
- `passengerId`, `driverId`, `pickup*`, `dropoff*`, `vehicleMode`, `estimatedPrice`, `finalPrice`, `driverSnapshot` (plaque, note…).

Grille tarifaire : fichier / table **séparée** de [`pricing.ts`](../../bagup-backend/src/missions/pricing.ts) livraison (ex. `ride-pricing.ts`). Les chiffres exacts = validation cliente après benchmark.

---

## 5. Statuts Ride (MVP)

```text
draft → requested → searching → assigned → driver_en_route
  → driver_arrived → in_progress → completed
                 ↘ cancelled
```

Transitions minimales à documenter dans l’API lors de l’implémentation.

---

## 6. Phases d’implémentation

| Phase | Livrable | Ressenti | Hors scope phase |
|-------|----------|----------|------------------|
| **1** | UI Course + estimate + Commander (même sans matching réel / mock driver) | Fluide jusqu’au OK | Multi-arrêts, surge |
| **2** | Matching livreurs moto/voiture dispo + assignation | Attente + feedback | Algo ultra-smart |
| **3** | Live location + ETA carte | « Je vois mon chauffeur » | SOS |
| **4** | Paiement + note + règles cancel | Fin de course complète | Options siège / clim |

Chaque phase = build TestFlight / APK testable.

### Critère de succès Phase 1

Un utilisateur non technique pose une course **en &lt; 30 s** (GPS OK, destination connue), voit un prix, tape Commander — **sans** remplir un formulaire type colis.

---

## 7. Hors MVP (rappel)

- Multi-arrêts, course pour tiers, réservation programmée course
- Classes Comfort / Fastest / surge
- Fusion des funnels livraison et course
- Refactor massif backend livraison

---

## 8. Décisions figées pour la suite

1. **Add-on** dans la même app, tuile séparée.
2. **Modèle Ride** dédié (pas le formulaire CreateRequest colis).
3. **Grille prix Course** séparée de la livraison.
4. Prestataires : moto/voiture existants **éligibles** aux courses (opt-in possible plus tard).
5. Code **uniquement après** validation cliente du benchmark + de cette spec ([`CLIENT_ALIGN.md`](./CLIENT_ALIGN.md)).
