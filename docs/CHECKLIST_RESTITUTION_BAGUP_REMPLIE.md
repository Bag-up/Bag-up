# CHECKLIST DE RESTITUTION DES LIVRABLES — APPLICATION BAG’UP

> Annexe au PV de réception (Article 4 du contrat).  
> Date de proposition de remplissage : **14 septembre 2026**  
> Projet : application Bag’up (mobile Android/iOS + API + admin)

**Légende proposée**

| Symbole | Signification |
|--------|----------------|
| ✅ Remis | Disponible / accessible / déjà livré |
| ⏳ À finaliser | Existe, mais transfert formel ou document manquant |
| ❌ N/A | Non applicable au périmètre réalisé |

---

## Tableau de restitution

| # | Livrable | Remis | N/A | Commentaire / emplacement |
|---|----------|:----:|:---:|---------------------------|
| **1** | Code source mobile Bag’up (Android/iOS) + historique Git | ✅ | | Repo GitHub : `eldieng/Bag-Up-App-Mobile` — version store **1.0.23** |
| **2** | Transfert de propriété des dépôts au nom du Client | ⏳ | | À faire : invitation owner / transfert d’orga GitHub vers le compte Client |
| **3** | Code source backend/API + scripts infra | ✅ | | Repo : `eldieng/Bag-Up-backend-admin` (API NestJS + admin Vite) — VPS Hostinger |
| **4** | Fichiers de signature Android (.jks / keystore) + mots de passe | ⏳ | | Keystore géré par **EAS / Expo** (`@elbambiste/bagup`). À exporter et remettre au Client (sinon impossible de republier) |
| **5** | Compte Google Play Console (rôle propriétaire) ou retrait accès prestataire | ⏳ | | App `sn.bagup.app` — transfert owner Play Console / retrait accès développeur |
| **6** | Transfert compte Apple App Store / App Store Connect | ⏳ | | App ID `6793175800`, Team `WBVCJF7928` — transfert App Store Connect / Apple Developer |
| **7** | Export BDD prod (structure + données) + accès admin / transfert service | ⏳ | | PostgreSQL sur VPS `72.62.234.114`. À remettre : dump `.sql` + accès DB |
| **8** | Schéma BDD, scripts de migration, dictionnaire de données | ✅ | | `bagup-backend/prisma/schema.prisma` + dossier `migrations/` |
| **9** | Accès admin hébergement / domaines / DNS / SSL | ⏳ | | VPS Hostinger, domaines (`bagup.app` / `admin.bagup.app`). Remettre logins panel + DNS |
| **10** | Accès services tiers (Firebase, paiements Wave/OM via Bictorys, SMS, Maps, Expo…) | ⏳ | | Liste des services ci-dessous — transfert comptes / clés au Client |
| **11** | Liste exhaustive + transmission sécurisée des identifiants / `.env` / clés API | ⏳ | | Remettre hors Git (coffre / mail chiffré) : `.env` API, clés Maps, Stripe/Bictorys, Firebase, EAS |
| **12** | Sources design (Figma/XD), maquettes, charte, logos éditables | ⏳ | | Logos/assets dans le repo + `maquettes.pdf` / `maq*.jpeg`. Si pas de fichier Figma source → indiquer N/A ou « maquettes PDF remises » |
| **13** | Documentation technique (architecture, API, install / déploiement) | ✅ | | `docs/` (roadmap, marketplace, phases), README repos, guides déploiement existants |
| **14** | Manuel utilisateur + manuel d’administration | ⏳ | | Admin utilisable en ligne ; manuels formels à joindre ou marquer N/A si hors contrat |
| **15** | PV de recette, résultats de tests, registre bugs connus non résolus | ⏳ | | À joindre au PV Article 4 + liste bugs ouverts (ex. points UX encore en cours) |
| **16** | Comptes et jeux de données de test | ⏳ | | Remettre 1–2 comptes test client / prestataire / admin (sans données perso réelles) |
| **17** | Copies documents contractuels (devis, CDC, avenants, échanges validants) | ✅ | | Ex. `Cahier_des_charges_BagUp_MAJ.pdf`, offres marketplace, factures dossier projet |
| **18** | Attestation de cession des droits de PI (code + créations graphiques) | ⏳ | | Document juridique à signer séparément (pas un livrable technique) |
| **19** | Attestation sur l’honneur de suppression des copies (sauf conservation légale) | ⏳ | | À signer **après** transfert complet des accès (points 2, 4–11) |

---

## Synthèse honnête pour signature

### Déjà en place techniquement (coche « Remis » sans risque)
- **1, 3, 8, 13, 17**

### À finaliser avant / pendant la restitution formelle
- **2, 4, 5, 6, 7, 9, 10, 11** (transferts d’accès + secrets)  
- **15, 16, 18, 19** (documents de clôture)  
- **12, 14** (selon ce qui était prévu au contrat : Figma source / manuels)

### Recommandation de remplissage du PDF imprimé
1. Cocher **Remis** pour : 1, 3, 8, 13, 17  
2. Laisser **vides** (ou cocher Remis seulement après remise effective) : 2, 4, 5, 6, 7, 9, 10, 11, 15, 16, 18, 19  
3. Pour **12** et **14** :  
   - si le contrat n’exigeait pas Figma / manuels formels → **N/A**  
   - sinon → Remis seulement avec les fichiers joints

---

## Inventaire rapide des accès à remettre (point 10–11)

| Service | Usage | Action |
|---------|--------|--------|
| GitHub | Code mobile + backend/admin | Transfert owner |
| Expo / EAS | Builds store + OTA + keystore Android | Transfert projet / export credentials |
| Google Play | Publication Android | Transfert propriétaire |
| App Store Connect | Publication iOS | Transfert |
| VPS Hostinger | API + admin + BDD | Remise accès root / panel |
| Domaines / DNS | bagup.app, admin… | Remise registrar |
| PostgreSQL | Données prod | Dump + user admin |
| Bictorys / Wave / OM | Paiements | Transfert compte marchand |
| Google Maps | Cartes / Places | Transfert clés / projet GCP |
| Firebase | Notifications (si utilisé) | Transfert projet |
| Stripe (si encore actif) | Paiements carte | Transfert |

⚠️ **Ne jamais coller les mots de passe / clés dans ce fichier ni dans un commit Git.** Transmission séparée (coffre 1Password / mail chiffré / remise en main propre).

---

## Cases signatures (à reporter sur le PDF)

| | Prestataire | Client |
|--|-------------|--------|
| Nom | | |
| Date | | |
| Signature | | |

---

*Document d’aide au remplissage — à annexer ou recopier sur le formulaire contractuel officiel.*
