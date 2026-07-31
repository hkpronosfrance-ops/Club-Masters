# Dynasty Eleven — MVP

Manager de football jouable 100% dans le navigateur (PC + mobile).
Next.js (App Router) + Supabase (Postgres/Auth) + Tailwind. Déployable sur Vercel gratuitement.

## Ce que fait ce MVP

- Inscription -> génération automatique d'un club + 18 joueurs
- Écran Club : trésorerie, palmarès, derniers résultats
- Écran Effectif : liste des joueurs (note, forme, fatigue)
- Écran Match : choix formation / style tactique / mentalité -> simulation d'un match contre une IA
  (moteur avec xG, avantage du terrain, météo, fatigue, moral, forme — voir src/lib/matchEngine.ts)
- Écran Mercato : achat de joueurs listés par des clubs IA générés automatiquement

## Setup (10 minutes)

### 1. Créer le projet Supabase
1. Va sur https://supabase.com -> New project (gratuit)
2. Une fois créé, ouvre SQL Editor -> colle le contenu de supabase/schema.sql -> Run
3. Va dans Project Settings -> API et récupère :
   - Project URL -> NEXT_PUBLIC_SUPABASE_URL
   - anon public key -> NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role key -> SUPABASE_SERVICE_ROLE_KEY (secret, jamais côté client)
4. Dans Authentication -> Providers, désactive "Confirm email" pour tester plus vite
   (à réactiver avant la vraie mise en prod).

### 2. Variables d'environnement locales
Copie .env.example en .env.local et remplis les 3 valeurs ci-dessus.

### 3. Lancer en local
```
npm install
npm run dev
```
Ouvre http://localhost:3000

### 4. Déployer sur Vercel
1. Pousse ce dossier sur un repo GitHub (voir commandes ci-dessous)
2. Sur https://vercel.com -> New Project -> importe le repo
3. Ajoute les 3 variables d'environnement (Project Settings -> Environment Variables)
4. Deploy — c'est tout, PWA installable directement depuis l'URL Vercel.

```
git init
git add .
git commit -m "Dynasty Eleven MVP"
git branch -M main
git remote add origin https://github.com/TON_USER/dynasty-eleven.git
git push -u origin main
```

## Structure du code

```
src/
  app/
    page.tsx                  -> landing + connexion/inscription
    dashboard/page.tsx        -> vue d'ensemble du club
    squad/page.tsx            -> effectif
    tactics/page.tsx          -> tactique + simulation de match
    transfermarket/page.tsx   -> mercato
    api/
      onboard/route.ts        -> création du club à l'inscription
      match/simulate/route.ts -> lance une simulation de match
      transfer/buy/route.ts   -> achat d'un joueur listé
  lib/
    matchEngine.ts            -> cœur de la simulation (voir commentaires)
    playerGenerator.ts        -> génération procédurale des joueurs
    aiPool.ts                 -> génération des clubs IA (adversaires + mercato)
    supabase/                 -> clients Supabase (browser / server / admin)
supabase/schema.sql           -> tout le schéma DB + RLS
```

## Prochaines étapes suggérées

1. Cron Supabase (Edge Function) pour faire jouer les clubs IA entre eux automatiquement
2. Vrai calendrier de championnat (journées, classement) au lieu de matchs amicaux à la demande
3. Centre de formation (génération de jeunes, progression liée à l'entraînement)
4. Ligues privées entre amis (table leagues + league_members)
5. Notifications (blessures, fin de contrat, offres reçues)
