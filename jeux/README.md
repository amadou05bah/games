# ON JOUE ? — trois jeux de soirée dans une seule appli

| Jeu | Joueurs | Un seul téléphone | En ligne |
|---|---|---|---|
| **Entre Nous** — secrets, fils invisibles, histoire commune | 2–12 | ✓ | — |
| **POLICE** 🇬🇳 — le jeu traditionnel guinéen | 3–30 | ✓ | ✓ |
| **Défie ta lettre** — une lettre, 10 catégories, un chrono | 2–20 | ✓ | ✓ |

## Règles intégrées

### POLICE — points
- Chaque joueur marque **1 point par manche**…
- … sauf le **voleur démasqué** : **0** ;
- … et le **policier qui se trompe** : **0**.
- Nombre de manches : **3, 5, 10, 15 ou illimité** (jusqu'à ce que l'hôte arrête). Score final avec ex æquo.
- À la fin de chaque manche, l'hôte indique qui le policier a désigné (nécessaire pour compter les points).

### Défie ta lettre
- Exactement **5 tours**, **10 catégories** (choisies parmi 30), **1 point par bonne réponse** (10/tour, 50/partie).
- Chrono : 60 s, 90 s, 120 s ou illimité. À la fin du temps, les réponses sont verrouillées automatiquement.
- Lettres jamais répétées dans une partie ; lettres difficiles (K Q W X Y Z) en option.
- Correction automatique : normalisation (majuscules, accents, espaces, articles « le/la/l’ »), lettre vérifiée,
  réponse trop courte/vague refusée, doublon chez un même joueur compté une seule fois.
- **Une réponse inconnue n'est jamais refusée d'office** : elle est acceptée « à vérifier » et chacun peut la contester.
- Arbitrage : en ligne, vote des autres joueurs (majorité ; égalité = décision automatique conservée) ;
  sur un seul téléphone, le groupe accepte/refuse en touchant la réponse.

## Structure

```
shared/                      Règles partagées client/serveur
  police/roles.js            rôles, validation, tirage, comptage des points
  lettre/categories.js       bibliothèque de 30 catégories + réponses connues
  lettre/engine.js           normalisation, correction, votes, constantes (5 tours, 10 catégories)
  ranking.js                 classement avec ex æquo
server/                      Node.js + Express + Socket.IO (+ PostgreSQL optionnel)
  src/index.js               un espace temps réel par jeu : /police et /lettre
  src/common.js              salles, codes, sessions, reconnexion (commun aux jeux)
  src/police/                salles POLICE (rôles tirés côté serveur, jamais exposés)
  src/lettre/                salles Défie ta lettre (lettre, chrono, verrouillage, votes côté serveur)
  db/schema.sql              historique des parties
  test/                      19 tests (npm test)
client/                      React + Vite
  src/App.jsx                accueil multi-jeux
  src/games/entrenous/       Entre Nous (intégré dans un cadre isolé)
  src/games/police/          POLICE (local + en ligne)
  src/games/lettre/          Défie ta lettre (local + en ligne)
```

## Lancer

```bash
cd server && npm install && npm test && npm start      # http://localhost:3001
cd client && npm install && npm run dev                # http://localhost:5173 (dev)
```

Production : `cd client && npm run build` puis `cd server && npm start` — le serveur sert l'appli et le temps réel.
Sur le même Wi-Fi, les autres téléphones ouvrent `http://<IP-du-PC>:3001` (`hostname -I` pour la trouver).

Variables : `PORT`, `DATABASE_URL` (facultatif), `CORS_ORIGIN` / `VITE_SERVER_URL` (client hébergé ailleurs).

Hébergement gratuit conseillé : **Render** (Web Service) — build : `cd client && npm install && npm run build && cd ../server && npm install`, start : `cd server && npm start`.

`npm run build:standalone` produit un fichier HTML unique jouable sans serveur (modes « un seul téléphone »).
