# Manuel d’administration — Bag’up

**Back-office :** https://admin.bagup.app  
**API :** https://admin.bagup.app/api  
**Compte projet / transparence :** `lanternelabel@gmail.com`  
**Exception Expo/EAS :** `el.elhadji.dieng@gmail.com` (à transférer ou partager avec le Client)

---

## 1. Accès admin

1. Ouvrir https://admin.bagup.app  
2. Se connecter avec un compte **Administrateur / Staff**  
3. Ne jamais partager le mot de passe admin en clair hors canal sécurisé  

Les comptes admin sont gérés en base (rôle admin/staff).

---

## 2. Missions principales de l’admin

| Module | Actions |
|--------|---------|
| Utilisateurs | Voir clients / prestataires / commerçants, bloquer, vérifier KYC |
| Prestataires | Valider pièces, adhésion payée, rejeter KYC, motif de rejet |
| Abonnements | Suivre paiements d’adhésion, impayés, remboursements à traiter |
| Paiements | Missions / courses (Bictorys), statuts (succès, abandonné…) |
| Missions / Courses | Superviser litiges, statuts, suivis |
| Contenu | Bannières, promos, message de mise à jour app (`APP_LATEST_VERSION`) |
| Marketplace | Boutiques, commandes, modération selon activation |

---

## 3. Validation prestataire (KYC)

Parcours type :
1. Inscription + OTP  
2. Paiement adhésion  
3. Admin vérifie documents  
4. Validation → accès app  
5. En cas de rejet : motif visible côté app + éventuel remboursement à marquer  

Anti-Gaspi peut suivre un parcours « vérification seule » selon configuration.

---

## 4. Hébergement & exploitation

| Élément | Détail |
|---------|--------|
| VPS | Hostinger — serveur prod Bag’up |
| Process API | PM2 (`bagup-api`) |
| Admin | Build Vite servi sur le VPS |
| BDD | PostgreSQL (Prisma) |
| Domaines | `bagup.app` / `admin.bagup.app` (+ DNS / SSL) |

**Compte hébergeur / domaines / DNS / SSL :** gérés sous `lanternelabel@gmail.com`.

Redémarrage API (ops) :
```bash
pm2 restart bagup-api --update-env
```

Mise à jour version store annoncée dans l’app :
- Variable `APP_LATEST_VERSION` sur le serveur (ex. `1.0.23`)

---

## 5. Stores & builds

| Plateforme | Identifiant | Compte |
|------------|-------------|--------|
| Google Play | `sn.bagup.app` | `lanternelabel@gmail.com` |
| App Store | ID `6793175800` | `lanternelabel@gmail.com` |
| Expo / EAS | projet `@elbambiste/bagup` | `el.elhadji.dieng@gmail.com` |

**Android keystore :** géré via EAS. Export / partage des credentials de signature à conserver côté Client (lanterne).

Publication typique :
```bash
cd bagup-mobile
npx eas build --platform all --profile production --auto-submit
```

OTA (correctifs JS sans rebuild store) :
```bash
npx eas update --channel production --platform android --message "…"
npx eas update --channel production --platform ios --message "…"
```

---

## 6. Services tiers

Tous configurés / rattachés à **lanterne** sauf Expo :

| Service | Usage | Compte |
|---------|--------|--------|
| Bictorys / Wave / OM | Paiements | lanternelabel |
| Google Maps / Places | Cartes & adresses | lanternelabel |
| Firebase (si actif) | Push | lanternelabel |
| Expo / EAS | Builds + OTA + keystore | el.elhadji.dieng@gmail.com |

---

## 7. Fichiers `.env` et secrets

- **Non publiés sur GitHub**  
- Disponibles pour le Client via la boîte **`lanternelabel@gmail.com`** et/ou dossier sécurisé de restitution  
- Sur clé USB : uniquement si le support est chiffré / remis en main propre  

Après restitution : **changer tous les mots de passe et régénérer les clés API**.

---

## 8. Sauvegardes recommandées

1. Dump PostgreSQL régulier  
2. Copie `.env` chiffrée hors serveur  
3. Accès EAS / stores documentés  
4. Snapshot VPS Hostinger  

---

## 9. Contacts d’exploitation

| Rôle | Email |
|------|--------|
| Compte projet / transparence Client | lanternelabel@gmail.com |
| Compte technique Expo (à aligner) | el.elhadji.dieng@gmail.com |

---

*Manuel d’administration — restitution Bag’up — septembre 2026*
