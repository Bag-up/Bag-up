# Bag’up

Application Bag’up — mobile (Expo), API (NestJS) et back-office admin.

## Structure

```text
mobile/    Application Expo (Android / iOS) — sn.bagup.app
backend/   API NestJS + Prisma + PostgreSQL
admin/     Back-office Vite (admin.bagup.app)
docs/      Documentation et dossier de restitution
```

## Comptes / transparence

- Compte projet Client : `lanternelabel@gmail.com` (Play, Apple, VPS, DNS, paiements, Maps…)
- Expo / EAS : `el.elhadji.dieng@gmail.com` (à partager / transférer)

Les fichiers `.env` et secrets **ne sont pas** dans ce dépôt : transmission via mail lanterne / USB sécurisée.

## Démarrage rapide

### Backend
```bash
cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

### Admin
```bash
cd admin
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Version

Application mobile : **1.0.23**
