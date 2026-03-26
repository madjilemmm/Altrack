# Altrack

Application Next.js pour centraliser:

1. Un flux d'offres d'alternance sport (communication / événementiel).
2. Un tableau de suivi de candidatures (statut + note + date).

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Stack

- Next.js (App Router)
- TypeScript
- Stockage local dans `localStorage`

## Suite recommandée pour la mise en production

- Créer une API (`/api/offers`) connectée à des sources externes.
- Mettre en place une base de données (Supabase / PostgreSQL) pour synchroniser le suivi entre appareils.
- Ajouter l'authentification (NextAuth, Clerk ou Auth0).
- Déployer sur Vercel et connecter au dépôt GitHub.
