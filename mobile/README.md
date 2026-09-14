# Bag'up — Application Mobile

<div align="center">

**Plateforme de livraison & démarches administratives au Sénégal**

</div>

---

## 📱 À propos

**Bag'up** est une application mobile (iOS & Android) développée avec React Native (Expo) qui met en relation les clients et les prestataires pour la collecte, la livraison de colis et l'accomplissement de démarches administratives au Sénégal.

Conçue pour la diaspora sénégalaise et les résidents, Bag'up simplifie l'envoi de colis, la gestion de documents administratifs et les courses du quotidien avec un suivi en temps réel.

---

## 🎨 Charte graphique

| Élément | Couleur | Code |
|---------|---------|------|
| Principal | Turquoise | `#0D8F8F` |
| Secondaire | Jaune | `#F7E300` |
| Accent | Rouge | `#F04A3A` |

- **Titres** : Syne
- **Texte** : DM Sans
- **Style** : Moderne, professionnel, épuré (réf. Yango, Uber, Glovo)

---

## ✨ Fonctionnalités

### Client
- **Inscription** : nom, prénom, téléphone, email, adresse, pays de résidence (diaspora)
- **Création de demande** : choix du service, adresses de collecte/livraison, description, photos, niveau d'urgence
- **Remise à un tiers / GP (diaspora)** : nom, téléphone, lien, lieu de remise, pays de résidence, code de remise unique par SMS
- **Suivi en temps réel** : carte interactive, GPS, localisation du prestataire, barre de progression
- **Messagerie** : chat avec le prestataire, envoi de photos et localisation
- **Paiement** : Orange Money, Wave, Free Money, Visa, Mastercard
- **Parrainage** : code personnel, récompense après 1ère prestation payante du filleul
- **Évaluation** : note + commentaire après chaque mission
- **Tableau de bord** : historique des demandes, suivi des missions, paiements, évaluations

### Prestataire Bag'up
- **Inscription** : nom, prénom, téléphone, email, pièce d'identité (recto/verso), photo, type de véhicule, zone d'intervention, catégorie(s) de service
- **Validation** : compte validé par l'administrateur avant activation
- **Missions** : réception, acceptation, refus, annulation
- **Mise à jour de statut** : progression selon le type de mission (livraison ou démarche admin)
- **Géolocalisation** : envoi automatique de la position GPS pendant les missions actives
- **Abonnement** : adhésion 5 000 FCFA + abonnement mensuel 5 000 FCFA
- **Assurance** : accident offerte après 4 mois continus d'abonnement
- **Parrainage** : 1 mois offert après validation + 2 mois d'abonnement du filleul

### Services proposés
- **Collecte & Livraison** : colis, documents, courses, marchandises, objets personnels
- **Démarches administratives** : CNI, passeport, acte de naissance, casier judiciaire, NINEA, RCCM, permis de construire, permis de conduire, etc.
- **Services professionnels** : livraison entreprise, dépôt administratif, collecte marchandises

### Statuts des missions

**Collecte / Livraison :**
`En attente → Mission attribuée → Collecte effectuée → Livraison en cours → Remis au destinataire`

**Démarches administratives :**
`En attente → Mission attribuée → Dossier déposé → En attente traitement → Document disponible → Document retiré → Restitué au client`

---

## 🛠 Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| Framework | React Native (Expo SDK 54) |
| Langage | TypeScript |
| Navigation | React Navigation (Stack + Tabs) |
| Cartes | React Native Maps |
| Notifications | Expo Notifications |
| Polices | Syne (titres), DM Sans (texte) |
| Backend API | NestJS + Prisma + PostgreSQL |
| Authentification | JWT (téléphone ou email) |

---

## 📁 Structure du projet

```
bagup-mobile/
├── App.tsx                    # Point d'entrée, navigation principale
├── app.json                   # Configuration Expo
├── assets/                    # Logo, icônes, splash screen
│   ├── logo.png
│   ├── logo-sansfond.png
│   ├── icon.png
│   └── splash-icon.png
├── src/
│   ├── components/ui/         # Composants réutilisables
│   │   ├── AddressInput.tsx   # Input d'adresse avec autocomplete
│   │   └── Button.tsx
│   ├── constants/
│   │   ├── theme.ts           # Couleurs, typographie, spacing
│   │   └── senegalLocations.ts # Base de lieux au Sénégal
│   ├── context/
│   │   └── AuthContext.tsx    # Gestion de l'authentification
│   ├── screens/
│   │   ├── auth/              # Splash, Login, Onboarding
│   │   ├── client/            # Home, CreateRequest, Tracking, Payments, Chat, etc.
│   │   └── provider/          # Dashboard, Missions, Earnings, Profile
│   └── services/
│       ├── api.ts             # Client API
│       ├── location.ts        # Géolocalisation
│       └── notifications.ts   # Notifications push
└── package.json
```

---

## 🚀 Installation & démarrage

### Prérequis
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Un émulateur iOS/Android ou l'application Expo Go

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/eldieng/Bag-Up-App-Mobile.git
cd Bag-Up-App-Mobile

# Installer les dépendances
npm install

# Démarrer l'application
npx expo start
```

### Configuration de l'API

L'URL de l'API backend est configurée dans `src/services/api.ts` :

```typescript
const API_URL = 'http://VOTRE_IP_LOCALE:3000/api';
```

---

## 🌍 Zones de déploiement

| Phase | Zones |
|-------|-------|
| Phase 1 | Dakar, Pikine, Guédiawaye, Rufisque, Keur Massar |
| Phase 2 | Thiès, Mbour, Saly |
| Phase 3 | Reste du Sénégal |

---

## 📄 Licence

Projet privé — Tous droits réservés.

---

## 👨‍💻 Développeur

**El Hadji Dieng**

- 📍 Dakar, Parcelles Assainies U8, Sénégal
- 📞 +221 77 454 86 61
- ✉️ el.elhadji.dieng@gmail.com
- 🌐 [Portfolio](https://elhadji-dieng.com/)

---

<div align="center">

**Bag'up** — La livraison & les démarches administratives simplifiées au Sénégal.

</div>
