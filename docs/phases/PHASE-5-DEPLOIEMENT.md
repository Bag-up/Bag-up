# Phase 5 : Déploiement

## Objectif
Mettre en production l'ensemble de la plateforme Bag'up.

## Infrastructure

### Backend API

#### Hébergement
- **Provider** : AWS / DigitalOcean / Railway
- **Serveur** : 2 vCPU, 4GB RAM (scalable)
- **Base de données** : PostgreSQL managé
- **Cache** : Redis managé
- **CDN** : CloudFlare

#### Configuration
```
Production:
├── API Server (Node.js)
├── PostgreSQL (Primary + Replica)
├── Redis Cluster
├── Load Balancer
└── SSL/TLS (Let's Encrypt)
```

### Back-office Admin
- **Hébergement** : Vercel / Netlify
- **Domaine** : admin.bagup.sn

### Services Tiers
- Firebase (notifications)
- Twilio (SMS)
- Google Maps Platform
- APIs Paiement (Orange Money, Wave, etc.)

## Checklist Pré-déploiement

### Backend
- [ ] Variables environnement configurées
- [ ] Base de données migrée
- [ ] Seeds données initiales
- [ ] SSL certificat installé
- [ ] Logs configurés
- [ ] Monitoring activé
- [ ] Backups automatiques
- [ ] Rate limiting activé

### Mobile
- [ ] Build release Android (APK/AAB)
- [ ] Build release iOS (IPA)
- [ ] Icônes et splash screens
- [ ] Configuration production
- [ ] Désactivation logs debug

### Admin
- [ ] Build production
- [ ] Variables environnement
- [ ] Domaine configuré

## Publication Stores

### Google Play Store

#### Prérequis
- [ ] Compte développeur Google ($25)
- [ ] Fiche store complète
- [ ] Screenshots (phone + tablet)
- [ ] Icône 512x512
- [ ] Feature graphic 1024x500
- [ ] Description FR/EN
- [ ] Politique confidentialité
- [ ] Catégorie : Outils / Livraison

#### Process
1. Créer application dans Play Console
2. Configurer fiche store
3. Upload AAB signé
4. Tests internes
5. Tests ouverts (optionnel)
6. Soumission production
7. Review Google (1-7 jours)

### Apple App Store

#### Prérequis
- [ ] Compte développeur Apple ($99/an)
- [ ] App Store Connect configuré
- [ ] Certificats et profils
- [ ] Screenshots iPhone (6.5", 5.5")
- [ ] Screenshots iPad (optionnel)
- [ ] Icône 1024x1024
- [ ] Description FR/EN
- [ ] Politique confidentialité
- [ ] Catégorie : Utilitaires / Livraison

#### Process
1. Créer app dans App Store Connect
2. Configurer métadonnées
3. Upload via Xcode/Transporter
4. Soumettre pour review
5. Review Apple (1-3 jours)

## Domaines & DNS

| Service | Domaine | Type |
|---------|---------|------|
| API | api.bagup.sn | A/CNAME |
| Admin | admin.bagup.sn | CNAME |
| Site web | www.bagup.sn | CNAME |

## Monitoring & Alertes

### Outils
- **APM** : Sentry (erreurs)
- **Logs** : LogTail / CloudWatch
- **Uptime** : UptimeRobot
- **Analytics** : Mixpanel / Firebase Analytics

### Alertes Configurées
- [ ] Serveur down
- [ ] Erreur 5xx > 10/min
- [ ] Temps réponse > 2s
- [ ] CPU > 80%
- [ ] Espace disque < 20%
- [ ] Échec paiement

## Sauvegardes

| Données | Fréquence | Rétention |
|---------|-----------|-----------|
| Base de données | Quotidien | 30 jours |
| Fichiers uploads | Quotidien | 90 jours |
| Logs | Temps réel | 14 jours |

## Rollback Plan

En cas de problème critique :
1. Identifier le problème
2. Communiquer aux utilisateurs
3. Rollback version précédente
4. Analyser et corriger
5. Re-déployer après validation

## Checklist Post-déploiement

- [ ] API accessible et fonctionnelle
- [ ] Apps téléchargeables sur stores
- [ ] Admin accessible
- [ ] Paiements fonctionnels
- [ ] Notifications reçues
- [ ] Monitoring actif
- [ ] Équipe support prête

## Critères de Validation
- [ ] Tous services en ligne
- [ ] Apps publiées sur stores
- [ ] Tests smoke passés
- [ ] Client informé

## Prochaine Étape
→ Phase 6 : Maintenance
