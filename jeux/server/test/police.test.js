import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PoliceRooms } from '../src/police/rooms.js';
import { validateConfig, defaultRoles, roundPoints } from '../../shared/police/roles.js';

function setup(n = 5) {
  const m = new PoliceRooms();
  const { room, player: host } = m.createRoom({ hostName: 'Hôte', gameName: 'Test' });
  const players = [host];
  for (let i = 1; i < n; i++) players.push(m.join({ code: room.code, name: `J${i}` }).player);
  return { m, room, host, players };
}
const byType = (m, room, players, t) => players.find((p) => m.privateRole(room, p.id).type === t);

test('configuration par défaut valide', () => {
  const { room } = setup(6);
  assert.ok(validateConfig(room.roles, 6).ok);
});

test('un rôle par joueur, distribution complète', () => {
  const { m, room, host, players } = setup(7);
  m.start(room, host.id);
  const types = players.map((p) => m.privateRole(room, p.id).type);
  assert.equal(types.filter((t) => t === 'policier').length, 1);
  assert.equal(types.filter((t) => t === 'voleur').length, 1);
});

test('aucun rôle dans l’état public pendant la manche', () => {
  const { m, room, host } = setup(4);
  m.start(room, host.id);
  const s = m.publicState(room);
  assert.equal(s.reveal, undefined);
  assert.ok(!JSON.stringify(s.players).includes('voleur'));
});

test('lancement refusé si la configuration est fausse', () => {
  const { m, room, host } = setup(4);
  m.setRoles(room, host.id, defaultRoles(5));
  assert.throws(() => m.start(room, host.id), /rôle/);
});

test('POINTS — policier qui trouve : tout le monde 1 pt sauf le voleur (0)', () => {
  const { m, room, host, players } = setup(5);
  m.start(room, host.id);
  const thief = byType(m, room, players, 'voleur');
  m.end(room, host.id, thief.id);
  const pts = room.result.points;
  assert.equal(pts[thief.id], 0);
  assert.equal(Object.values(pts).reduce((a, b) => a + b, 0), 4);
  assert.equal(room.scores[byType(m, room, players, 'policier').id], 1);
});

test('POINTS — policier qui se trompe : 0 pour le policier, 1 pour tous les autres (voleur compris)', () => {
  const { m, room, host, players } = setup(5);
  m.start(room, host.id);
  const cop = byType(m, room, players, 'policier');
  const innocent = players.find((p) => !['voleur', 'policier'].includes(m.privateRole(room, p.id).type));
  m.end(room, host.id, innocent.id);
  assert.equal(room.result.points[cop.id], 0);
  assert.equal(room.result.points[byType(m, room, players, 'voleur').id], 1);
  assert.equal(room.result.points[innocent.id], 1);
});

test('la désignation est obligatoire pour compter les points', () => {
  const { m, room, host } = setup(4);
  m.start(room, host.id);
  assert.throws(() => m.end(room, host.id, null), /désigné/);
});

test('manches limitées : impossible de dépasser, scores cumulés', () => {
  const { m, room, host, players } = setup(4);
  m.setMaxRounds(room, host.id, 2);
  m.start(room, host.id);
  m.end(room, host.id, players[1].id);
  m.nextRound(room, host.id);
  m.end(room, host.id, players[1].id);
  assert.throws(() => m.nextRound(room, host.id), /manches/);
  m.stop(room, host.id);
  assert.equal(room.status, 'finished');
  const total = Object.values(room.scores).reduce((a, b) => a + b, 0);
  assert.ok(total >= 6 && total <= 8);
});

test('manches illimitées jusqu’à l’arrêt, puis nouvelle partie remet à zéro', () => {
  const { m, room, host, players } = setup(3);
  m.start(room, host.id);
  for (let i = 0; i < 6; i++) { m.end(room, host.id, players[1].id); m.nextRound(room, host.id); }
  assert.equal(room.round, 7);
  m.end(room, host.id, players[1].id);
  m.stop(room, host.id);
  m.toLobby(room, host.id);
  assert.deepEqual(Object.values(room.scores), [0, 0, 0]);
});

test('on ne rejoint pas une partie commencée ; reconnexion par jeton', () => {
  const { m, room, host, players } = setup(3);
  m.start(room, host.id);
  assert.throws(() => m.join({ code: room.code, name: 'Tard' }), /commencé/);
  assert.equal(m.resume({ code: room.code, token: players[2].token }).player.id, players[2].id);
});

test('roundPoints : fonction pure', () => {
  const players = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const as = new Map([['a', { type: 'policier' }], ['b', { type: 'voleur' }], ['c', { type: 'autre' }]]);
  assert.deepEqual(roundPoints(players, as, 'b'), { a: 1, b: 0, c: 1 });
  assert.deepEqual(roundPoints(players, as, 'c'), { a: 0, b: 1, c: 1 });
});
