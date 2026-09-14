# Phase 1 : Analyse et Validation ✅

## Objectif
Valider les spécifications fonctionnelles et techniques avant le développement.

## Livrables

### 1. Cahier des Charges ✅
- [x] Document reçu du client
- [x] Analyse des fonctionnalités
- [x] Identification des utilisateurs

### 2. Points Validés par le Client ✅

#### Tarification des Services
La tarification est calculée dynamiquement selon :
- **Zone de collecte**
- **Zone de livraison**
- **Distance parcourue**
- **Type de service** demandé
- **Niveau d'urgence**

> L'administrateur peut configurer les tarifs depuis le back-office.

#### Commission Bag'up
- **Aucune commission** prélevée sur les transactions au lancement
- Le client paie **directement le prestataire** via :
  - Orange Money
  - Wave
  - Free Money
  - Carte bancaire
- **Revenus Bag'up** = Abonnements prestataires uniquement

#### Abonnement Prestataire
| Type | Montant |
|------|---------|
| Frais d'inscription | **20 000 FCFA** (unique) |
| Abonnement mensuel | **12 000 FCFA** |

L'abonnement donne accès à :
- Réception des missions disponibles
- Visibilité sur la plateforme
- Tableau de bord professionnel

#### Zones Géographiques de Lancement

| Phase | Zones | Statut |
|-------|-------|--------|
| **Phase 1** | Dakar, Pikine, Guédiawaye, Rufisque, Keur Massar | 🎯 Lancement |
| **Phase 2** | Thiès, Mbour, Saly | Expansion |
| **Phase 3** | Reste du Sénégal | Extension progressive |

#### Gestion des Litiges

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSUS DE LITIGE                          │
├─────────────────────────────────────────────────────────────────┤
│ Étape 1 │ Déclaration du litige (client ou prestataire)        │
├─────────────────────────────────────────────────────────────────┤
│ Étape 2 │ Transmission à l'administration Bag'up               │
├─────────────────────────────────────────────────────────────────┤
│ Étape 3 │ Analyse des justificatifs :                          │
│         │ • Photos                                              │
│         │ • Messages                                            │
│         │ • Historique de mission                               │
│         │ • Géolocalisation                                     │
├─────────────────────────────────────────────────────────────────┤
│ Étape 4 │ Décision administrative :                            │
│         │ • Litige validé                                       │
│         │ • Litige rejeté                                       │
│         │ • Compensation exceptionnelle                         │
├─────────────────────────────────────────────────────────────────┤
│ Étape 5 │ Sanctions possibles :                                │
│         │ • Avertissement                                       │
│         │ • Suspension temporaire                               │
│         │ • Désactivation définitive du compte                  │
└─────────────────────────────────────────────────────────────────┘
```

> Toutes les décisions sont enregistrées dans le système.

### 3. Spécifications Techniques

#### Stack Validée
| Composant | Technologie |
|-----------|-------------|
| Mobile | React Native + Expo |
| Backend | NestJS + PostgreSQL |
| Admin | React + TailwindCSS |
| Temps réel | Socket.io |
| Notifications | Firebase Cloud Messaging |
| Maps | Google Maps API |
| SMS | Twilio |

#### Intégrations Paiement
- Orange Money API
- Wave API
- Free Money API
- Stripe (Visa/Mastercard)

### 4. Architecture Système

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ Prestataire │     │    Admin    │
│  (Mobile)   │     │  (Mobile)   │     │    (Web)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   API REST  │
                    │   NestJS    │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
│ PostgreSQL  │     │    Redis    │     │  Firebase   │
│   (Data)    │     │   (Cache)   │     │   (Push)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Critères de Validation
- [x] Réponses client reçues ✅
- [x] Tarification définie ✅
- [x] Modèle économique validé ✅
- [x] Zones de lancement définies ✅
- [x] Processus litiges validé ✅
- [ ] Budget validé (en attente)
- [ ] Planning accepté (en attente)
- [ ] Contrat signé (en attente)

## Résumé Modèle Économique

```
┌────────────────────────────────────────────────────────────┐
│                   REVENUS BAG'UP                           │
├────────────────────────────────────────────────────────────┤
│  Inscription prestataire    │  20 000 FCFA (unique)       │
│  Abonnement mensuel         │  12 000 FCFA / mois         │
│  Commission transactions    │  0% (au lancement)          │
├────────────────────────────────────────────────────────────┤
│  Projection (100 prestataires actifs) :                   │
│  • Inscriptions : 2 000 000 FCFA                          │
│  • Abonnements : 1 200 000 FCFA / mois                    │
└────────────────────────────────────────────────────────────┘
```

## Phase 1 Complétée ✅

**Date de validation** : 17 Juin 2026

## Prochaine Étape
→ **Phase 2 : Conception UX/UI**
