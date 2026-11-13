/**
 * DÉFIE TA LETTRE — salles en ligne, chronomètre et correction côté serveur.
 *
 * Déroulé d'un tour : playing (révélation de la lettre puis saisie) → review (correction + contestations)
 *                     → scores (classement du tour) → tour suivant… → finished après 5 tours.
 * Confidentialité : pendant la saisie, l'état public n'indique que « a rendu / n'a pas rendu ».
 * Les réponses de tous ne sont publiées qu'à la correction.
 */
import crypto from 'node:crypto';
import { CATEGORY_BY_ID, DEFAULT_CATEGORIES } from '../../../shared/lettre/categories.js';
import {
  TOTAL_ROUNDS, CATEGORIES_PER_ROUND, TIMER_CHOICES, drawLetter, checkSheet, isAccepted, sheetScore, voteOutcome,
} from '../../../shared/lettre/engine.js';
import { GameError, newRoomCode, newId, newToken, cleanName } from '../common.js';

const REVEAL_MS = 3500; // animation de tirage de la lettre
const GRACE_MS = 1500; // marge réseau pour les dernières sauvegardes
const MAX_PLAYERS = 20;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const fail = (msg) => { throw new GameError(msg); };

export class LettreRooms {
  /** @param {{onChange:(room)=>void, db?:object}} opts  onChange : diffusion après un événement de minuterie */
  constructor({ onChange = () => {}, db = {} } = {}) {
    this.rooms = new Map();
    this.onChange = onChange;
    this.db = db;
  }

  get(code) {
    const room = this.rooms.get(String(code || '').toUpperCase().trim());
    if (!room) fail('Salle introuvable. Vérifie le code.');
    return room;
  }

  createRoom({ hostName, gameName }) {
    const code = newRoomCode((c) => this.rooms.has(c));
    const room = {
      code,
      gameName: cleanName(gameName, 40) || 'Défie ta lettre',
      status: 'lobby', // lobby → playing → review → scores → … → finished
      hostId: null,
      players: [],
      config: { categories: [...DEFAULT_CATEGORIES], timer: 90, hardLetters: false },
      round: 0,
      letters: [],
      startsAt: null,
      endsAt: null,
      timer: null,
      sheets: new Map(), // playerId → string[10]
      submitted: new Set(),
      results: {}, // playerId → résultat de correction [10]
      contests: {}, // "playerId:index" → { by, votes:{voterId:bool}, open }
      roundPoints: {},
      scores: {},
      history: [], // [{ round, letter, points }]
      updatedAt: Date.now(),
    };
    this.rooms.set(code, room);
    const player = this.addPlayer(room, hostName);
    room.hostId = player.id;
    return { room, player };
  }

  addPlayer(room, rawName) {
    const name = cleanName(rawName, 20);
    if (!name) fail('Choisis un prénom ou un pseudo.');
    if (room.players.length >= MAX_PLAYERS) fail('La salle est pleine.');
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail('Ce nom est déjà pris dans la salle.');
    const player = { id: newId(), token: newToken(), name, connected: false, socketId: null };
    room.players.push(player);
    room.scores[player.id] = 0;
    this.touch(room);
    return player;
  }

  join({ code, name }) {
    const room = this.get(code);
    if (room.status !== 'lobby') fail('La partie a déjà commencé.');
    return { room, player: this.addPlayer(room, name) };
  }

  resume({ code, token }) {
    const room = this.get(code);
    const player = room.players.find((p) => p.token === token);
    if (!player) fail('Session expirée pour cette salle.');
    return { room, player };
  }

  leave(room, playerId) {
    if (room.status !== 'lobby') {
      const p = room.players.find((x) => x.id === playerId);
      if (p) { p.connected = false; p.socketId = null; }
      return;
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    delete room.scores[playerId];
    if (!room.players.length) { this.rooms.delete(room.code); return; }
    if (room.hostId === playerId) room.hostId = room.players[0].id;
    this.touch(room);
  }

  kick(room, hostId, targetId) {
    this.requireHost(room, hostId);
    if (room.status !== 'lobby') fail('On ne peut retirer un joueur que dans la salle d’attente.');
    if (targetId === hostId) fail('L’hôte ne peut pas se retirer lui-même.');
    const target = room.players.find((p) => p.id === targetId);
    if (!target) fail('Joueur introuvable.');
    this.leave(room, targetId);
    return target;
  }

  requireHost(room, playerId) {
    if (room.hostId !== playerId) fail('Seul l’hôte peut faire cela.');
  }

  /* ---------- Configuration ---------- */

  setConfig(room, playerId, { categories, timer, hardLetters }) {
    this.requireHost(room, playerId);
    if (room.status !== 'lobby') fail('La configuration se modifie avant la partie.');
    if (categories !== undefined) {
      const ids = [...new Set((categories || []).filter((id) => CATEGORY_BY_ID[id]))];
      if (ids.length > CATEGORIES_PER_ROUND) fail(`${CATEGORIES_PER_ROUND} catégories maximum.`);
      room.config.categories = ids;
    }
    if (timer !== undefined) {
      if (!TIMER_CHOICES.includes(Number(timer))) fail('Durée invalide.');
      room.config.timer = Number(timer);
    }
    if (hardLetters !== undefined) room.config.hardLetters = !!hardLetters;
    this.touch(room);
  }

  /* ---------- Déroulement ---------- */

  start(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status !== 'lobby') fail('La partie a déjà commencé.');
    if (room.players.length < 2) fail('Il faut au moins 2 joueurs en ligne.');
    if (room.config.categories.length !== CATEGORIES_PER_ROUND) fail(`Choisis exactement ${CATEGORIES_PER_ROUND} catégories.`);
    room.round = 0;
    room.letters = [];
    room.history = [];
    for (const p of room.players) room.scores[p.id] = 0;
    this.db.saveLettreStart?.(room);
    this.startRound(room);
  }

  startRound(room) {
    room.round += 1;
    const letter = drawLetter(room.letters, room.config.hardLetters, (n) => crypto.randomInt(n));
    room.letters.push(letter);
    room.sheets = new Map(room.players.map((p) => [p.id, Array(CATEGORIES_PER_ROUND).fill('')]));
    room.submitted = new Set();
    room.results = {};
    room.contests = {};
    room.roundPoints = {};
    const now = Date.now();
    room.startsAt = now + REVEAL_MS;
    room.endsAt = room.config.timer ? room.startsAt + room.config.timer * 1000 : null;
    room.status = 'playing';
    this.clearTimer(room);
    if (room.endsAt) {
      room.timer = setTimeout(() => { this.lock(room); this.onChange(room); }, room.endsAt - now + GRACE_MS);
    }
    this.touch(room);
  }

  /** Sauvegarde (brouillon) — possible jusqu'au verrouillage. */
  save(room, playerId, answers) {
    if (room.status !== 'playing') fail('Les réponses sont verrouillées.');
    if (Date.now() < room.startsAt - 500) fail('La lettre n’est pas encore révélée.');
    if (room.submitted.has(playerId)) return;
    room.sheets.set(playerId, sanitizeAnswers(answers));
  }

  /** Remise définitive des réponses ; si tout le monde a rendu, le tour se termine. */
  submit(room, playerId, answers) {
    this.save(room, playerId, answers);
    room.submitted.add(playerId);
    if (room.players.every((p) => room.submitted.has(p.id))) this.lock(room);
    this.touch(room);
  }

  /** Verrouillage : temps écoulé, tout le monde a rendu, ou l'hôte termine (temps illimité). */
  lock(room) {
    if (room.status !== 'playing') return;
    this.clearTimer(room);
    const cats = room.config.categories;
    const letter = room.letters[room.round - 1];
    for (const p of room.players) room.results[p.id] = checkSheet(room.sheets.get(p.id), letter, cats);
    room.status = 'review';
    this.touch(room);
  }

  forceEnd(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status !== 'playing') fail('Aucun tour en cours.');
    if (Date.now() < room.startsAt) fail('La lettre n’est pas encore révélée.');
    this.lock(room);
  }

  /* ---------- Correction et contestations ---------- */

  contest(room, byId, targetId, index) {
    if (room.status !== 'review') fail('Les contestations se font pendant la correction.');
    const res = room.results[targetId]?.[index];
    if (!res) fail('Réponse introuvable.');
    if (res.status === 'empty') fail('Il n’y a pas de réponse à contester.');
    const key = `${targetId}:${index}`;
    if (room.contests[key]?.open) return;
    room.contests[key] = { by: byId, votes: {}, open: true };
    this.touch(room);
  }

  /** Vote de tous les joueurs sauf l'auteur de la réponse. Clôture automatique quand tous ont voté. */
  vote(room, voterId, key, accept) {
    const c = room.contests[key];
    if (!c?.open) fail('Ce vote est terminé.');
    const [targetId] = key.split(':');
    if (voterId === targetId) fail('Tu ne peux pas voter pour ta propre réponse.');
    c.votes[voterId] = !!accept;
    const voters = room.players.filter((p) => p.id !== targetId);
    const active = voters.filter((p) => p.connected || c.votes[p.id] !== undefined);
    if (active.every((p) => c.votes[p.id] !== undefined)) this.closeContest(room, key);
    this.touch(room);
  }

  closeContest(room, key) {
    const c = room.contests[key];
    if (!c?.open) return;
    c.open = false;
    const [targetId, i] = key.split(':');
    const res = room.results[targetId][Number(i)];
    const outcome = voteOutcome(c.votes);
    if (outcome !== undefined) res.override = outcome;
    c.outcome = outcome;
  }

  /** Fin de correction (hôte) : les votes en cours sont clos, les points sont comptés. */
  finishReview(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status !== 'review') fail('Pas de correction en cours.');
    for (const key of Object.keys(room.contests)) this.closeContest(room, key);
    const points = {};
    for (const p of room.players) {
      points[p.id] = sheetScore(room.results[p.id] || []);
      room.scores[p.id] = (room.scores[p.id] || 0) + points[p.id];
    }
    room.roundPoints = points;
    room.history.push({ round: room.round, letter: room.letters[room.round - 1], points });
    room.status = 'scores';
    this.touch(room);
  }

  next(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status !== 'scores') fail('Termine d’abord la correction.');
    if (room.round >= TOTAL_ROUNDS) {
      room.status = 'finished';
      this.db.saveLettreEnd?.(room);
    } else {
      this.startRound(room);
    }
    this.touch(room);
  }

  toLobby(room, playerId) {
    this.requireHost(room, playerId);
    this.clearTimer(room);
    room.status = 'lobby';
    room.round = 0;
    room.letters = [];
    room.history = [];
    room.results = {};
    room.contests = {};
    for (const p of room.players) room.scores[p.id] = 0;
    this.touch(room);
  }

  /* ---------- Données envoyées ---------- */

  publicState(room) {
    const reviewing = ['review', 'scores', 'finished'].includes(room.status);
    return {
      code: room.code,
      gameName: room.gameName,
      status: room.status,
      hostId: room.hostId,
      config: room.config,
      round: room.round,
      totalRounds: TOTAL_ROUNDS,
      letter: room.status === 'lobby' ? null : room.letters[room.round - 1],
      startsAt: room.startsAt,
      endsAt: room.endsAt,
      serverNow: Date.now(),
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, submitted: room.submitted.has(p.id) })),
      results: reviewing ? room.results : null,
      contests: reviewing ? room.contests : {},
      roundPoints: room.roundPoints,
      scores: room.scores,
      history: room.history,
    };
  }

  /** Brouillon personnel (pour retrouver ses réponses après une reconnexion). */
  privateSheet(room, playerId) {
    return { answers: room.sheets.get(playerId) ?? null, submitted: room.submitted.has(playerId) };
  }

  clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }
  touch(room) { room.updatedAt = Date.now(); }

  cleanup(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      if (!room.players.some((p) => p.connected) && now - room.updatedAt > ROOM_TTL_MS) { this.clearTimer(room); this.rooms.delete(code); }
    }
  }
}

function sanitizeAnswers(answers) {
  const out = Array(CATEGORIES_PER_ROUND).fill('');
  if (Array.isArray(answers)) answers.slice(0, CATEGORIES_PER_ROUND).forEach((a, i) => { out[i] = String(a ?? '').slice(0, 60); });
  return out;
}

export { isAccepted };
