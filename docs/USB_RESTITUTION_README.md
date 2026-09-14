# Clé USB — restitution Bag’up

## Transparence comptes

| Accès | Compte |
|-------|--------|
| Play, Apple, VPS, DNS, SSL, paiements, Maps, secrets, Git | `lanternelabel@gmail.com` |
| Expo / EAS (seul écart) | `el.elhadji.dieng@gmail.com` |

`.env` / mots de passe : **mail lanterne** (+ USB chiffrée si besoin) — **jamais sur GitHub**.

## Arborescence USB

```text
BAGUP_RESTITUTION/
├── 00_DOSSIER_RESTITUTION.pdf
├── 01_CODE_SOURCE/
│   ├── Bag-Up-App-Mobile/
│   └── Bag-Up-backend-admin/
├── 02_DOCUMENTATION/
│   ├── Cahier_des_charges_BagUp_MAJ.pdf
│   ├── docs/
│   └── restitution/   ← manuels, PV, attestations, comptes test
├── 03_DESIGN_ASSETS/
├── 04_BASE_DE_DONNEES/
└── 05_COMPTES_TEST/
```

## Commandes utiles

```bash
open -a Safari "/Users/mac/Developpement/bag'up/docs/DOSSIER_RESTITUTION_BAGUP.html"
# puis Imprimer → Enregistrer en PDF

USB="/Volumes/NOM_DE_TA_CLE/BAGUP_RESTITUTION"
mkdir -p "$USB"/{01_CODE_SOURCE,02_DOCUMENTATION/restitution,03_DESIGN_ASSETS/{logos,maquettes},04_BASE_DE_DONNEES,05_COMPTES_TEST}

rsync -a --exclude node_modules --exclude .env --exclude dist --exclude .expo \
  "/Users/mac/Developpement/bag'up/bagup-mobile/" "$USB/01_CODE_SOURCE/Bag-Up-App-Mobile/"

rsync -a --exclude node_modules --exclude .env --exclude dist \
  "/Users/mac/Developpement/bag'up/bagup-backend/" "$USB/01_CODE_SOURCE/Bag-Up-backend-admin/bagup-backend/"

rsync -a --exclude node_modules --exclude .env --exclude dist \
  "/Users/mac/Developpement/bag'up/admin/" "$USB/01_CODE_SOURCE/Bag-Up-backend-admin/admin/"

cp "/Users/mac/Developpement/bag'up/Cahier_des_charges_BagUp_MAJ.pdf" "$USB/02_DOCUMENTATION/" 2>/dev/null || true
rsync -a "/Users/mac/Developpement/bag'up/docs/" "$USB/02_DOCUMENTATION/docs/"
cp "/Users/mac/Developpement/bag'up/docs/restitution/"*.md "$USB/02_DOCUMENTATION/restitution/"

cp "/Users/mac/Developpement/bag'up/bagup-backend/prisma/schema.prisma" "$USB/04_BASE_DE_DONNEES/"
rsync -a "/Users/mac/Developpement/bag'up/bagup-backend/prisma/migrations/" "$USB/04_BASE_DE_DONNEES/migrations/"
```
