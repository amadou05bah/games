/** Outils communs aux salles des différents jeux. */
import crypto from 'node:crypto';

export class GameError extends Error {}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I/L
export function newRoomCode(exists, length = 6) {
  for (;;) {
    let code = '';
    for (let i = 0; i < length; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!exists(code)) return code;
  }
}
export const newId = () => crypto.randomBytes(8).toString('hex');
export const newToken = () => crypto.randomBytes(24).toString('hex');
export const cleanName = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Branche un espace de noms Socket.IO générique : session (salle + joueur), accusés de réception,
 * reconnexion par jeton. Chaque jeu fournit ses propres gestionnaires via `handlers(ctx)`.
 */
export function mountNamespace(nsp, manager, { broadcast, handlers, onAttach }) {
  nsp.on('connection', (socket) => {
    const session = { code: null, playerId: null };

    const attach = (room, player) => {
      if (session.code && session.code !== room.code) socket.leave(session.code);
      session.code = room.code;
      session.playerId = player.id;
      player.connected = true;
      player.socketId = socket.id;
      socket.join(room.code);
      onAttach?.(socket, room, player);
    };
    const current = () => {
      if (!session.code) throw new GameError('Tu n’es dans aucune salle.');
      return manager.get(session.code);
    };
    const on = (event, handler) => {
      socket.on(event, async (payload, ack) => {
        if (typeof payload === 'function') { ack = payload; payload = {}; }
        try {
          const result = (await handler(payload || {})) || {};
          ack?.({ ok: true, ...result });
        } catch (e) {
          if (!(e instanceof GameError)) console.error(`[${nsp.name} ${event}]`, e);
          ack?.({ ok: false, error: e instanceof GameError ? e.message : 'Erreur inattendue.' });
        }
      });
    };

    on('room:create', (p) => {
      const { room, player } = manager.createRoom(p);
      attach(room, player); broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    });
    on('room:join', (p) => {
      const { room, player } = manager.join(p);
      attach(room, player); broadcast(room);
      return { code: room.code, playerId: player.id, token: player.token };
    });
    on('room:resume', (p) => {
      const { room, player } = manager.resume(p);
      attach(room, player); broadcast(room);
      return { code: room.code, playerId: player.id };
    });
    on('room:leave', () => {
      if (!session.code) return;
      const room = current();
      manager.leave(room, session.playerId);
      socket.leave(room.code);
      if (manager.rooms.has(room.code)) broadcast(room);
      session.code = session.playerId = null;
    });
    on('room:kick', ({ playerId }) => {
      const room = current();
      const target = manager.kick(room, session.playerId, playerId);
      if (target.socketId) {
        nsp.to(target.socketId).emit('room:closed', { reason: 'L’hôte t’a retiré de la salle.' });
        nsp.sockets.get(target.socketId)?.leave(room.code);
      }
      broadcast(room);
    });

    handlers({ on, current, session, socket });

    socket.on('disconnect', () => {
      if (!session.code || !manager.rooms.has(session.code)) return;
      const room = manager.rooms.get(session.code);
      const p = room.players.find((x) => x.id === session.playerId);
      if (p && p.socketId === socket.id) { p.connected = false; p.socketId = null; }
      broadcast(room);
    });
  });
}
