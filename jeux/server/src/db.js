/**
 * Persistance PostgreSQL (optionnelle) — active si DATABASE_URL est défini.
 * Une erreur de base ne doit jamais interrompre une partie : elle est seulement journalisée.
 */
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankPlayers } from '../../shared/ranking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pool = null;

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('[db] DATABASE_URL absent : historique en mémoire uniquement.');
    return false;
  }
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const sql = await fs.readFile(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] PostgreSQL connecté, schéma prêt.');
  return true;
}

const safe = (fn) => async (...args) => {
  if (!pool) return null;
  try { return await fn(...args); } catch (e) { console.error('[db]', e.message); return null; }
};

/* ---------- POLICE ---------- */

export const savePoliceRound = safe(async (room) => {
  const { rows } = await pool.query(
    'INSERT INTO games (room_code, game_name, round, player_count) VALUES ($1,$2,$3,$4) RETURNING id',
    [room.code, room.gameName, room.round, room.players.length]
  );
  const gameId = rows[0].id;
  for (const p of room.players) {
    const r = room.assignments.get(p.id);
    await pool.query('INSERT INTO game_players (game_id, player_name, role_name, role_type) VALUES ($1,$2,$3,$4)', [gameId, p.name, r.name, r.type]);
  }
  return gameId;
});

export const savePoliceRoundEnd = safe(async (room) => {
  if (!room.dbGameId) return;
  const accused = room.players.find((p) => p.id === room.result?.accusedId);
  await pool.query('UPDATE games SET ended_at = now(), accused_name = $2, police_correct = $3 WHERE id = $1',
    [room.dbGameId, accused?.name ?? null, room.result?.correct ?? null]);
  for (const p of room.players) {
    await pool.query('UPDATE game_players SET points = $3 WHERE game_id = $1 AND player_name = $2', [room.dbGameId, p.name, room.result.points[p.id]]);
  }
});

/* ---------- DÉFIE TA LETTRE ---------- */

export const saveLettreStart = safe(async (room) => {
  const { rows } = await pool.query('INSERT INTO lettre_games (room_code, categories, timer) VALUES ($1,$2,$3) RETURNING id',
    [room.code, room.config.categories, room.config.timer]);
  room.dbGameId = rows[0].id;
});

export const saveLettreEnd = safe(async (room) => {
  if (!room.dbGameId) return;
  await pool.query('UPDATE lettre_games SET ended_at = now(), letters = $2 WHERE id = $1', [room.dbGameId, room.letters]);
  const ranking = rankPlayers(room.players.map((p) => ({ id: p.id, name: p.name, score: room.scores[p.id] })));
  for (const r of ranking) {
    await pool.query('INSERT INTO lettre_scores (game_id, player_name, score, rank) VALUES ($1,$2,$3,$4)', [room.dbGameId, r.name, r.score, r.rank]);
  }
});

export async function closeDb() { if (pool) await pool.end(); }
