/**
 * Hook commun aux modes en ligne : connexion, reconnexion automatique (jeton gardé sur le téléphone),
 * état public de la salle, appels avec accusé de réception.
 * @param {string} game  'police' | 'lettre'
 * @param {Record<string,(data:any)=>void>} privateEvents  événements privés propres au jeu
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, emitTo, makeSession, inviteCode } from './socket.js';

export function useOnline(game, privateEvents = {}) {
  const socket = getSocket(game);
  const session = useRef(makeSession(game)).current;
  const handlersRef = useRef(privateEvents);
  handlersRef.current = privateEvents;

  const [conn, setConn] = useState('connecting'); // connecting | ok | error
  const [view, setView] = useState(() => (inviteCode() ? 'join' : 'menu')); // menu | create | join | room
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => { session.clear(); setRoom(null); setMe(null); setView('menu'); }, [session]);

  useEffect(() => {
    const onConnect = async () => {
      setConn('ok');
      const s = session.get();
      if (s?.code && s?.token) {
        const r = await emitTo(socket, 'room:resume', s);
        if (r.ok) { setMe(r.playerId); setView('room'); } else { session.clear(); }
      }
    };
    const onError = () => setConn((c) => (c === 'ok' ? 'ok' : 'error'));
    const onDisconnect = () => setConn('connecting');
    const onState = (s) => setRoom(s);
    const onClosed = ({ reason }) => { reset(); setNotice(reason); };
    const priv = Object.keys(handlersRef.current).map((ev) => [ev, (d) => handlersRef.current[ev]?.(d)]);

    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    priv.forEach(([ev, fn]) => socket.on(ev, fn));
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      priv.forEach(([ev, fn]) => socket.off(ev, fn));
      socket.disconnect();
    };
  }, [socket, session, reset]);

  const emit = useCallback((event, payload) => emitTo(socket, event, payload), [socket]);

  const call = useCallback(async (event, payload) => {
    setBusy(true); setError('');
    const r = await emitTo(socket, event, payload);
    setBusy(false);
    if (!r.ok) setError(r.error);
    return r;
  }, [socket]);

  const enter = (r) => { session.set({ code: r.code, token: r.token }); setMe(r.playerId); setNotice(''); setView('room'); };
  const create = async (v) => { const r = await call('room:create', v); if (r.ok) enter(r); };
  const join = async (v) => { const r = await call('room:join', v); if (r.ok) enter(r); };
  const leave = async () => { await emitTo(socket, 'room:leave'); reset(); };
  const retry = () => { setConn('connecting'); socket.connect(); };

  return { socket, conn, view, setView, room, me, error, setError, notice, busy, emit, call, create, join, leave, retry, isHost: room?.hostId === me };
}
