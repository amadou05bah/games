/**
 * DÉFIE TA LETTRE — événements temps réel (espace de noms /lettre).
 *
 * Communs : room:create, room:join, room:resume, room:leave, room:kick
 * Spécifiques :
 *   config:set { categories?, timer?, hardLetters? }   (hôte, salle d'attente)
 *   game:start                                          (hôte)
 *   sheet:save { answers }   brouillon (sauvegarde automatique)
 *   sheet:submit { answers } remise définitive
 *   round:end                (hôte, utile en temps illimité)
 *   contest:open { playerId, index }   contester une réponse / demander sa validation
 *   contest:vote { key, accept }       vote (tous sauf l'auteur)
 *   review:finish            (hôte) comptage des points
 *   game:next                (hôte) tour suivant / résultats finaux
 *   game:lobby               (hôte) nouvelle partie
 * Serveur → client : room:state (public), sheet:yours (brouillon personnel), room:closed
 */
import { LettreRooms } from './rooms.js';
import { mountNamespace } from '../common.js';

export function mountLettre(io, db) {
  const nsp = io.of('/lettre');
  const broadcast = (room) => nsp.to(room.code).emit('room:state', rooms.publicState(room));
  const rooms = new LettreRooms({ onChange: broadcast, db });

  mountNamespace(nsp, rooms, {
    broadcast,
    onAttach: (socket, room, player) => socket.emit('sheet:yours', rooms.privateSheet(room, player.id)),
    handlers: ({ on, current, session }) => {
      const act = (fn) => (payload) => { const room = current(); const r = fn(room, session.playerId, payload); broadcast(room); return r; };
      on('config:set', act((room, id, p) => rooms.setConfig(room, id, p)));
      on('game:start', act((room, id) => rooms.start(room, id)));
      on('sheet:save', ({ answers }) => { rooms.save(current(), session.playerId, answers); });
      on('sheet:submit', act((room, id, { answers }) => rooms.submit(room, id, answers)));
      on('round:end', act((room, id) => rooms.forceEnd(room, id)));
      on('contest:open', act((room, id, { playerId, index }) => rooms.contest(room, id, playerId, Number(index))));
      on('contest:vote', act((room, id, { key, accept }) => rooms.vote(room, id, key, accept)));
      on('review:finish', act((room, id) => rooms.finishReview(room, id)));
      on('game:next', act((room, id) => rooms.next(room, id)));
      on('game:lobby', act((room, id) => rooms.toLobby(room, id)));
    },
  });

  setInterval(() => rooms.cleanup(), 10 * 60 * 1000).unref();
  return rooms;
}
