/**
 * POLICE — événements temps réel (espace de noms /police).
 *
 * Communs : room:create, room:join, room:resume, room:leave, room:kick
 * Spécifiques (accusé { ok, error? }) :
 *   roles:set { roles } · roles:reset · rounds:set { maxRounds }   (hôte, salle d'attente)
 *   game:start                     (hôte) 1re manche
 *   role:get → { role }            (uniquement SON rôle)
 *   role:seen
 *   game:end { accusedId }         (hôte) fin de manche + points
 *   game:next                      (hôte) manche suivante
 *   game:stop                      (hôte) arrêt → score final
 *   game:lobby                     (hôte) nouvelle partie
 * Serveur → client : room:state (public), role:yours (privé), room:closed
 */
import { PoliceRooms } from './rooms.js';
import { mountNamespace } from '../common.js';

export function mountPolice(io, db) {
  const nsp = io.of('/police');
  const rooms = new PoliceRooms(db);

  const broadcast = (room, { sendRoles = false } = {}) => {
    nsp.to(room.code).emit('room:state', rooms.publicState(room));
    if (sendRoles) {
      for (const p of room.players) {
        if (p.socketId) nsp.to(p.socketId).emit('role:yours', { role: rooms.privateRole(room, p.id) });
      }
    }
  };

  mountNamespace(nsp, rooms, {
    broadcast,
    onAttach: (socket, room, player) => socket.emit('role:yours', { role: rooms.privateRole(room, player.id) }),
    handlers: ({ on, current, session }) => {
      const host = (fn, opts) => () => { const room = current(); fn(room, session.playerId); broadcast(room, opts); };
      on('roles:set', ({ roles }) => { const room = current(); rooms.setRoles(room, session.playerId, roles); broadcast(room); });
      on('roles:reset', host((r, id) => rooms.resetRoles(r, id)));
      on('rounds:set', ({ maxRounds }) => { const room = current(); rooms.setMaxRounds(room, session.playerId, maxRounds); broadcast(room); });
      on('game:start', host((r, id) => rooms.start(r, id), { sendRoles: true }));
      on('game:next', host((r, id) => rooms.nextRound(r, id), { sendRoles: true }));
      on('game:stop', host((r, id) => rooms.stop(r, id)));
      on('game:lobby', host((r, id) => rooms.toLobby(r, id), { sendRoles: true }));
      on('role:get', () => ({ role: rooms.privateRole(current(), session.playerId) }));
      on('role:seen', () => { const room = current(); rooms.markSeen(room, session.playerId); broadcast(room); });
      on('game:end', ({ accusedId }) => { const room = current(); rooms.end(room, session.playerId, accusedId); broadcast(room); });
    },
  });

  setInterval(() => rooms.cleanup(), 10 * 60 * 1000).unref();
  return rooms;
}
