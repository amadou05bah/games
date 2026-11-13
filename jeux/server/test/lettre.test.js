import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LettreRooms } from '../src/lettre/rooms.js';
import { checkSheet, normalize, core, sheetScore, isAccepted, voteOutcome } from '../../shared/lettre/engine.js';
import { DEFAULT_CATEGORIES } from '../../shared/lettre/categories.js';
import { rankPlayers } from '../../shared/ranking.js';

test('normalisation : majuscules, accents, espaces, articles', () => {
  assert.equal(normalize('  BÉNIN  '), 'benin');
  assert.equal(core('La Belgique'), 'belgique');
  assert.equal(core("L'Égypte"), 'egypte');
});

test('correction automatique (exemple du cahier des charges, lettre B)', () => {
  const ans = ['Belgique', 'Berlin', 'BMW', 'Beyoncé', 'Baleine', 'Banane', 'Bordeaux', 'Basket-ball', 'Boulanger', 'Batman'];
  const r = checkSheet(ans, 'B', DEFAULT_CATEGORIES);
  assert.ok(r.every((x) => x.status === 'valid'), JSON.stringify(r.filter((x) => x.status !== 'valid')));
  assert.equal(sheetScore(r), 10);
});

test('mauvaise lettre, vide, doublon, inconnue acceptée', () => {
  const ans = ['Mali', '', 'bamako', 'Bob le bricoleur', 'Bamako', 'Bobo', 'b', '', '', ''];
  const r = checkSheet(ans, 'B', DEFAULT_CATEGORIES);
  assert.equal(r[0].status, 'invalid'); // Mali ≠ B
  assert.equal(r[1].status, 'empty');
  assert.equal(r[2].status, 'plausible'); // « bamako » comme marque : inconnu → à vérifier (contestable)
  assert.equal(r[4].status, 'invalid'); // doublon de "bamako"
  assert.equal(r[5].status, 'plausible'); // inconnue → acceptée sauf contestation
  assert.equal(r[6].status, 'invalid'); // trop courte
});

test('arbitrage : vote majoritaire, égalité = décision automatique conservée', () => {
  assert.equal(voteOutcome({ a: true, b: false }), undefined);
  assert.equal(voteOutcome({ a: false, b: false, c: true }), false);
  assert.equal(isAccepted({ status: 'plausible', override: false }), false);
  assert.equal(isAccepted({ status: 'invalid', override: true }), true);
});

test('classement ex æquo', () => {
  const r = rankPlayers([{ id: 'a', name: 'A', score: 30 }, { id: 'b', name: 'B', score: 30 }, { id: 'c', name: 'C', score: 12 }]);
  assert.deepEqual(r.map((x) => [x.rank, x.tied]), [[1, true], [1, true], [3, false]]);
});

function game() {
  const m = new LettreRooms();
  const { room, player: host } = m.createRoom({ hostName: 'Hôte' });
  const b = m.join({ code: room.code, name: 'Awa' }).player;
  const c = m.join({ code: room.code, name: 'Moussa' }).player;
  return { m, room, host, b, c };
}

test('partie en ligne complète : 5 tours exactement, lettres différentes, 50 pts max', () => {
  const { m, room, host, b, c } = game();
  m.setConfig(room, host.id, { timer: 0 });
  m.start(room, host.id);
  for (let t = 1; t <= 5; t++) {
    room.startsAt = Date.now() - 1;
    assert.equal(room.status, 'playing');
    assert.equal(m.publicState(room).results, null); // pas de réponses visibles pendant la saisie
    const L = room.letters[t - 1];
    m.submit(room, host.id, Array(10).fill(0).map((_, i) => `${L}xyz${i}`));
    m.submit(room, b.id, []);
    m.submit(room, c.id, [`${L}aa`]);
    assert.equal(room.status, 'review');
    m.finishReview(room, host.id);
    assert.equal(room.roundPoints[host.id], 10);
    m.next(room, host.id);
  }
  assert.equal(room.status, 'finished');
  assert.equal(new Set(room.letters).size, 5);
  assert.equal(room.scores[host.id], 50);
  assert.equal(room.scores[b.id], 0);
});

test('contestation : refus collectif d’une réponse acceptée', () => {
  const { m, room, host, b, c } = game();
  m.setConfig(room, host.id, { timer: 0 });
  m.start(room, host.id);
  room.startsAt = Date.now() - 1;
  const L = room.letters[0];
  m.submit(room, host.id, [`${L}inventé`]);
  m.submit(room, b.id, []); m.submit(room, c.id, []);
  b.connected = true; c.connected = true;
  m.contest(room, b.id, host.id, 0);
  assert.throws(() => m.vote(room, host.id, `${host.id}:0`, true), /propre/);
  m.vote(room, b.id, `${host.id}:0`, false);
  assert.equal(room.contests[`${host.id}:0`].open, true);
  m.vote(room, c.id, `${host.id}:0`, false);
  m.finishReview(room, host.id);
  assert.equal(room.roundPoints[host.id], 0);
});

test('configuration : exactement 10 catégories pour lancer', () => {
  const { m, room, host } = game();
  m.setConfig(room, host.id, { categories: ['pays', 'sport'] });
  assert.throws(() => m.start(room, host.id), /10/);
});
