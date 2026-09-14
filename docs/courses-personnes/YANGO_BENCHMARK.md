# Benchmark Yango — Course personnes (Dakar / Sénégal)

Objectif : comprendre **pourquoi le parcours Yango est si fluide**, inventaire des étapes produit, et décider ce que Bag’up **reprend / ignore** pour un MVP Courses personnes.

Sources :
- Support officiel Yango Sénégal — [Request a ride](https://yango.com/en_sn/support/taxi-all-app-yango/popular-question/how-to-order/order/), [How it works](https://yango.com/en_sn/support/taxi-all-app-yango/popular-question/about/)
- Pages produit [Yango Dakar](https://yango.com/en_sn/city/dakar/), [Yango Sénégal](https://yango.com/en_sn/)
- Fiche App Store [Yango: taxi, food, delivery](https://apps.apple.com/sn/app/yango-taxi-food-delivery/id1437157286)
- Usage terrain (courses quotidiennes Dakar) — ressenti UX

Contexte Bag’up : la livraison / marketplace / anti-gaspi **reste intacte**. Ce document ne décrit **que** le ride-hailing.

---

## 1. Ce que Yango vend (en une phrase)

Mise en relation passager ↔ chauffeur partenaire, avec **prix visible avant commande**, suivi live, paiement cash/carte, et un parcours volontairement **court**.

Différence nette avec Bag’up aujourd’hui : Yango Course = **personnes A→B** ; Bag’up actuel = **colis / services / boutique**.

---

## 2. Parcours client — écran par écran

Estimation des taps : parcours heureux, utilisateur déjà connecté, GPS OK.

| # | Étape | Intention | Taps typiques | Ce qui rend le flux « évident » | Notes produit Yango |
|---|--------|-----------|---------------|----------------------------------|---------------------|
| 1 | Ouverture | Voir où je suis, pouvoir partir | 0 | Carte plein écran + point de départ déjà prérempli (GPS) | Pas de formulaire multi-étapes au démarrage |
| 2 | Destination | Dire où j’vais | 1–2 | Champ « Where to » dominant ; favoris / récents / suggestions | Autocomplete + historique (« home » le soir) |
| 3 | Ajuster départ | Corriger le pin si besoin | 0–1 | Pin déplaçable ou « Change address » | Rarement obligatoire |
| 4 | Arrêts optionnels | Multi-points | 0–N | « + » avant la commande seulement | Jusqu’à 3 arrêts — **hors MVP Bag’up** |
| 5 | Classe + prix | Choisir confort / prix | 1 | Prix **affiché avant** Request ; classes Economy / Comfort / Fastest | Prix = confiance |
| 6 | Paiement | Cash ou carte | 0–1 | Méthode visible dans le sheet bas | Modifiable après request (cash→carte) |
| 7 | Options / consignes | Siège enfant, clim, note | 0–1 | Secondaires, pas bloquantes | Extra payants selon zone |
| 8 | Request ride | Lancer | 1 | Un seul CTA primaire | Cœur du « 1 minute order » |
| 9 | Recherche | Attendre matching | 0 | Feedback clair (searching…) + Cancel facile | Annulation libre pendant search |
| 10 | Assignation | Savoir qui vient | 0 | Photo, note, plaque, ETA, véhicule | Sécurité + confiance |
| 11 | Course | Suivre | 0 | Carte + partage bas + contact / partage trajet | Partage route, SOS (produit Yango) |
| 12 | Fin | Payer / noter | 1–2 | Note chauffeur = qualité réseau | Frais si cancel après arrivée véhicule |

### Pourquoi ça « coule »

1. **Une intention = un écran dominant** (carte + sheet bas), pas 3 wizards.
2. **Le prix arrive tôt** (dès destination), avant engagement.
3. **Le GPS fait le travail** : départ prérempli.
4. **Les options avancées sont optionnelles** (arrêts, siège, etc.).
5. **Peu de jargon** : Where to / Request / Cancel.
6. **Feedback permanent** après commande (search → assigned → en route → arrived).

Leçon pour Bag’up : viser **≤ 3 actions** avant « Commander » (destination → véhicule/prix → confirmer).

---

## 3. Inventaire features Yango (passager)

| Feature | Présent Yango | Commentaire |
|---------|---------------|-------------|
| Prix à l’avance | Oui | Must |
| Classes de service | Oui (Economy, Comfort, Fastest…) | Should (MVP : moto + voiture suffit) |
| Cash + carte | Oui | Must (réutiliser Orange Money / Wave / carte Bag’up) |
| Multi-arrêts | Oui (≤ 3) | Later |
| Course pour un tiers | Oui | Later |
| Favoris / récents / « home » | Oui | Should |
| Consignes chauffeur | Oui | Should |
| Options payantes (siège, clim) | Oui | Later |
| Matching + ETA | Oui | Must (phase 2–3) |
| Infos chauffeur / plaque / note | Oui | Must dès assignation |
| Suivi live carte | Oui | Must phase 3 |
| Partage de trajet | Oui | Should |
| SOS / sécurité | Oui (produit) | Later / réglementaire |
| Annulation + règles de frais | Oui | Must (règles simples MVP) |
| Notation post-course | Oui | Must phase 4 |
| Réservation à l’avance | Oui (marketing Dakar) | Later |
| Delivery colis dans la même app | Oui (Yango Delivery) | Déjà couvert par Bag’up livraison — **ne pas fusionner les flux** |

---

## 4. Must / Should / Later (Bag’up Courses)

### Must (MVP fluide)

- Entrée dédiée **Course** (pas mélangée au formulaire Colis)
- Départ GPS + destination autocomplete
- Prix estimé **avant** confirmation (grille Course séparée de la livraison)
- Choix **moto / voiture** (ou équivalent simple)
- CTA unique « Commander »
- États : `searching` → `assigned` → `en_route` → `arrived_pickup` → `in_progress` → `completed` / `cancelled`
- Fiche chauffeur (nom, note, véhicule, plaque) à l’assignation
- Suivi carte + ETA
- Paiement (réutiliser tunnel Bag’up) + note

### Should (juste après MVP)

- Adresses récentes / favoris (Maison, Bureau)
- Consignes courtes au chauffeur
- Partage du trajet (lien)
- Annulation claire + éventuel petit frais si chauffeur déjà arrivé
- Push « chauffeur assigné / arrivé »

### Later (pas maintenant)

- Multi-arrêts, multi-courses simultanées pour tiers
- Classes premium / surge dynamique type Yango
- Siège enfant / options catalogue
- Réservation programmée course personnes
- SOS / stack sécurité avancée
- Clone exact de toutes les classes Yango
- Refonte ou remplacement de la livraison Bag’up

---

## 5. Ce qu’on ne copie **pas** au départ

| Yango | Pourquoi pas en MVP Bag’up |
|-------|----------------------------|
| Super-app food + delivery + ride dans un seul funnel | Bag’up a déjà livraison / AG / marketplace séparés |
| Surge / dynamisme tarifaire complexe | Transparence simple d’abord ; grille fixe Dakar |
| 3+ classes de confort | 2 modes véhicule suffisent pour tester le marché |
| Matching « The Fastest » multi-critères | Matching proximité + véhicule OK |
| App chauffeur séparée ultra-riche (Yango Pro) | Réutiliser app prestataire Bag’up + mode Course |

---

## 6. Implications métier / risque (à dire clairement à la cliente)

- **Produit différent** de la livraison : régulation transport de personnes, assurance, qualité chauffeur, litiges « trajet ».
- **Grille tarifaire séparée** : ne pas réutiliser telle quelle la grille colis moto/voiture déjà en prod.
- **UX cible** : la fluidité Yango est le critère de succès, pas le nombre de features.

---

## 7. Prochaine lecture

→ [`MVP_SPEC.md`](./MVP_SPEC.md) — spec Bag’up Courses (écrans, réemploi technique, phases).  
→ [`CLIENT_ALIGN.md`](./CLIENT_ALIGN.md) — texte court à valider avec la cliente.
