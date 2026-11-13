/**
 * POLICE — gestion des salles en ligne.
 *
 * Confidentialité :
 *  - les rôles sont tirés ici, côté serveur (générateur cryptographique) ;
 *  - publicState() ne contient JAMAIS les rôles avant la révélation de la manche ;
 *  - privateRole() ne renvoie que le rôle du joueur qui le demande ;
 *  - l'hôte peut configurer, lancer et terminer, mais ne voit pas les rôles.
 *
 * Points : 1 pt par joueur et par manche ; voleur démasqué → 0 ; policier qui se trompe → 0.
 */
import crypto from 'node:crypto';
import {
  defaultRoles, sanitizeRoles, validateConfig, assignRoles, policeResult, roundPoints, MAX_PLAYERS,
} from '../../../shared/police/roles.js';
import { GameError, newRoomCode, newId, newToken, cleanName } from '../common.js';

const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const randomInt = (max) => crypto.randomInt(max);
const fail = (msg) => { throw new GameError(msg); };

export class PoliceRooms {
  constructor(db = {}) {
    this.rooms = new Map();
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
      gameName: cleanName(gameName, 40) || 'Partie de Police',
      status: 'lobby', // lobby → playing → revealed → (playing …) → finished
      hostId: null,
      players: [],
      roles: defaultRoles(1),
      rolesAuto: true,
      maxRounds: null, // null = illimité
      round: 0,
      assignments: new Map(),
      seen: new Set(),
      result: null,
      scores: {},
      history: [], // [{ round, points: {id: pts} }]
      dbGameId: null,
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
    this.syncAutoRoles(room);
    this.touch(room);
    return player;
  }

  join({ code, name }) {
    const room = this.get(code);
    if (room.status !== 'lobby') fail('La partie a déjà commencé. Attends la prochaine partie.');
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
    this.syncAutoRoles(room);
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

  setRoles(room, playerId, roles) {
    this.requireHost(room, playerId);
    if (room.status !== 'lobby') fail('La configuration se modifie dans la salle d’attente.');
    room.roles = sanitizeRoles(roles);
    room.rolesAuto = false;
    this.touch(room);
  }

  resetRoles(room, playerId) {
    this.requireHost(room, playerId);
    room.rolesAuto = true;
    this.syncAutoRoles(room);
  }

  setMaxRounds(room, playerId, value) {
    this.requireHost(room, playerId);
    if (room.status !== 'lobby') fail('Le nombre de manches se règle dans la salle d’attente.');
    const n = value == null ? null : Math.floor(Number(value));
    room.maxRounds = n && n > 0 && n <= 99 ? n : null;
    this.touch(room);
  }

  syncAutoRoles(room) {
    if (room.rolesAuto) room.roles = defaultRoles(room.players.length);
  }

  /** Nouvelle manche : nouvelle distribution des rôles. */
  start(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status === 'playing') fail('Une manche est déjà en cours.');
    if (room.status === 'finished') fail('La partie est terminée.');
    if (room.maxRounds && room.round >= room.maxRounds) fail('Toutes les manches ont été jouées.');
    const check = validateConfig(room.roles, room.players.length);
    if (!check.ok) fail(check.errors[0]);
    room.assignments = assignRoles(room.players, room.roles, randomInt);
    room.seen = new Set();
    room.result = null;
    room.round += 1;
    room.status = 'playing';
    this.touch(room);
    Promise.resolve(this.db.savePoliceRound?.(room)).then((id) => { if (id) room.dbGameId = id; });
  }

  markSeen(room, playerId) {
    if (room.status === 'playing') room.seen.add(playerId);
  }

  /** Fin de manche : la personne désignée par le policier est obligatoire (elle détermine les points). */
  end(room, playerId, accusedId) {
    this.requireHost(room, playerId);
    if (room.status !== 'playing') fail('Aucune manche en cours.');
    if (!accusedId || !room.players.some((p) => p.id === accusedId)) fail('Indique qui le policier a désigné.');
    const points = roundPoints(room.players, room.assignments, accusedId);
    for (const [id, pts] of Object.entries(points)) room.scores[id] = (room.scores[id] || 0) + pts;
    room.result = { accusedId, correct: policeResult(room.assignments, accusedId), points };
    room.history.push({ round: room.round, points });
    room.status = 'revealed';
    this.touch(room);
    this.db.savePoliceRoundEnd?.(room);
  }

  /** Manche suivante : mêmes joueurs, même configuration, nouvelle distribution. */
  nextRound(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status !== 'revealed') fail('Termine d’abord la manche en cours.');
    this.start(room, playerId);
  }

  /** Arrêt de la partie (ou dernière manche jouée) : score final. */
  stop(room, playerId) {
    this.requireHost(room, playerId);
    if (room.status === 'playing') fail('Termine d’abord la manche en cours.');
    room.status = 'finished';
    this.touch(room);
  }

  /** Nouvelle partie : retour en salle d'attente, scores remis à zéro. */
  toLobby(room, playerId) {
    this.requireHost(room, playerId);
    room.status = 'lobby';
    room.assignments = new Map();
    room.seen = new Set();
    room.result = null;
    room.round = 0;
    room.history = [];
    for (const p of room.players) room.scores[p.id] = 0;
    this.touch(room);
  }

  publicState(room) {
    const state = {
      code: room.code,
      gameName: room.gameName,
      status: room.status,
      round: room.round,
      maxRounds: room.maxRounds,
      hostId: room.hostId,
      roles: room.roles,
      scores: room.scores,
      history: room.history,
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, seenRole: room.seen.has(p.id) })),
    };
    if (room.status === 'revealed') {
      state.reveal = room.players.map((p) => ({ playerId: p.id, ...room.assignments.get(p.id) }));
      state.result = room.result;
    }
    return state;
  }

  privateRole(room, playerId) {
    if (room.status !== 'playing' && room.status !== 'revealed') return null;
    return room.assignments.get(playerId) ?? null;
  }

  touch(room) { room.updatedAt = Date.now(); }

  cleanup(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      if (!room.players.some((p) => p.connected) && now - room.updatedAt > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }
}
