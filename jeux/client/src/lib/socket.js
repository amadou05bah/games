/**
 * Connexions Socket.IO : un espace de noms par jeu (/police, /lettre).
 * VITE_SERVER_URL permet de viser un serveur distinct (sinon : même origine que la page).
 */
import { io } from 'socket.io-client';

const BASE = import.meta.env.VITE_SERVER_URL || '';
const sockets = {};

export function getSocket(ns) {
  if (!sockets[ns]) sockets[ns] = io(`${BASE}/${ns}`, { autoConnect: false, reconnection: true, reconnectionDelay: 800 });
  return sockets[ns];
}

/** Envoie un événement et attend l'accusé { ok, error?, ... }. */
export function emitTo(socket, event, payload = {}) {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve({ ok: false, error: 'Pas de connexion au serveur.' });
    socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: 'Le serveur ne répond pas.' } : res));
  });
}

/** Session de reconnexion gardée sur le téléphone, par jeu. */
export function makeSession(game) {
  const KEY = `onjoue_session_${game}`;
  return {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
  };
}

/** Lien d'invitation vers une salle. */
export const inviteLink = (game, code) => `${location.origin}${location.pathname}?game=${game}&code=${code}`;
export const inviteCode = () => new URLSearchParams(location.search).get('code') || '';
