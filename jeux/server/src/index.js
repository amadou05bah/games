/**
 * Serveur de l'appli « ON JOUE ? » — Express + Socket.IO.
 * Un espace de noms temps réel par jeu en ligne :
 *   /police  → POLICE            (voir src/police/socket.js)
 *   /lettre  → DÉFIE TA LETTRE   (voir src/lettre/socket.js)
 * ENTRE NOUS se joue sur un seul téléphone et n'utilise pas le serveur.
 */
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import * as db from './db.js';
import { mountPolice } from './police/socket.js';
import { mountLettre } from './lettre/socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*' } });

const police = mountPolice(io, db);
const lettre = mountLettre(io, db);

app.get('/health', (_req, res) => res.json({ ok: true, police: police.rooms.size, lettre: lettre.rooms.size }));

const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

await db.initDb().catch((e) => console.error('[db] connexion impossible, poursuite en mémoire :', e.message));
server.listen(PORT, () => console.log(`ON JOUE ? prêt sur http://localhost:${PORT}`));
