# Phase 3 : Développement

## Objectif
Développer l'ensemble des composants de la plateforme Bag'up.

## Sprint Planning

### Sprint 1 : Setup & Authentification (2 semaines)

#### Backend
- [ ] Setup NestJS + PostgreSQL
- [ ] Configuration Prisma (ORM)
- [ ] Module Auth (JWT)
- [ ] Endpoints inscription/connexion
- [ ] Vérification SMS (Twilio)
- [ ] Gestion rôles (Client, Prestataire, Admin)

#### Mobile
- [ ] Setup React Native + Expo
- [ ] Configuration navigation
- [ ] Écrans authentification
- [ ] Intégration API auth
- [ ] Stockage token sécurisé

#### Admin
- [ ] Setup React + Vite
- [ ] Configuration TailwindCSS
- [ ] Layout principal
- [ ] Page connexion admin

### Sprint 2 : Profils & Services (2 semaines)

#### Backend
- [ ] Module Users (CRUD)
- [ ] Module Services (types de services)
- [ ] Upload fichiers (photos, documents)
- [ ] Validation prestataires

#### Mobile Client
- [ ] Écran profil
- [ ] Modification profil
- [ ] Liste services disponibles
- [ ] Détail service

#### Mobile Prestataire
- [ ] Profil prestataire
- [ ] Upload documents
- [ ] Statut validation

#### Admin
- [ ] Liste utilisateurs
- [ ] Détail utilisateur
- [ ] Validation prestataires

### Sprint 3 : Demandes & Missions (3 semaines)

#### Backend
- [ ] Module Demandes
- [ ] Module Missions
- [ ] Algorithme attribution (zone + disponibilité)
- [ ] Gestion statuts mission
- [ ] WebSocket temps réel

#### Mobile Client
- [ ] Création demande (wizard)
- [ ] Sélection adresses (Google Maps)
- [ ] Calcul prix estimatif
- [ ] Suivi mission temps réel

#### Mobile Prestataire
- [ ] Réception demandes (push)
- [ ] Accepter/Refuser mission
- [ ] Navigation GPS
- [ ] Mise à jour statuts

#### Admin
- [ ] Liste missions
- [ ] Détail mission
- [ ] Supervision temps réel

### Sprint 4 : Géolocalisation (2 semaines)

#### Backend
- [ ] Tracking positions
- [ ] Calcul distances
- [ ] Estimation temps arrivée
- [ ] Historique trajets

#### Mobile
- [ ] Carte interactive (Google Maps)
- [ ] Position temps réel
- [ ] Suivi prestataire
- [ ] Navigation intégrée

### Sprint 5 : Messagerie & Notifications (2 semaines)

#### Backend
- [ ] Module Chat (WebSocket)
- [ ] Stockage messages
- [ ] Module Notifications
- [ ] Intégration Firebase FCM
- [ ] Templates SMS/Email

#### Mobile
- [ ] Écran messagerie
- [ ] Envoi photos/localisation
- [ ] Notifications push
- [ ] Centre notifications

#### Admin
- [ ] Envoi notifications globales
- [ ] Templates notifications

### Sprint 6 : Paiements (2 semaines)

#### Backend
- [ ] Module Paiements
- [ ] Intégration Orange Money
- [ ] Intégration Wave
- [ ] Intégration Free Money
- [ ] Intégration Stripe
- [ ] Webhooks paiement
- [ ] Génération factures

#### Mobile
- [ ] Sélection mode paiement
- [ ] Flow paiement
- [ ] Confirmation
- [ ] Historique paiements

#### Admin
- [ ] Suivi transactions
- [ ] Rapports financiers

### Sprint 7 : Évaluations & Historique (1 semaine)

#### Backend
- [ ] Module Évaluations
- [ ] Calcul notes moyennes
- [ ] Historique complet

#### Mobile
- [ ] Écran évaluation
- [ ] Historique missions
- [ ] Détail mission passée

#### Admin
- [ ] Gestion avis
- [ ] Modération

### Sprint 8 : Dashboard & Stats (2 semaines)

#### Backend
- [ ] Endpoints statistiques
- [ ] Agrégation données
- [ ] Export rapports

#### Mobile Prestataire
- [ ] Dashboard revenus
- [ ] Statistiques activité
- [ ] Graphiques

#### Admin
- [ ] Dashboard principal
- [ ] KPIs temps réel
- [ ] Graphiques activité
- [ ] Export données

### Sprint 9 : Abonnements (1 semaine)

#### Backend
- [ ] Module Abonnements
- [ ] Gestion statuts
- [ ] Renouvellement automatique
- [ ] Notifications expiration

#### Admin
- [ ] Gestion abonnements
- [ ] Configuration tarifs

## Modules Backend

```
backend/src/modules/
├── auth/           # Authentification JWT
├── users/          # Gestion utilisateurs
├── services/       # Types de services
├── requests/       # Demandes clients
├── missions/       # Missions prestataires
├── payments/       # Paiements
├── chat/           # Messagerie
├── notifications/  # Notifications
├── ratings/        # Évaluations
├── subscriptions/  # Abonnements
├── locations/      # Géolocalisation
└── admin/          # Fonctions admin
```

## Critères de Validation
- [ ] Tous les endpoints API fonctionnels
- [ ] Applications mobiles compilées
- [ ] Back-office opérationnel
- [ ] Tests unitaires > 80% couverture

## Prochaine Étape
→ Phase 4 : Tests et Recette
