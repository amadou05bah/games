/**
 * POLICE — mode en ligne. Le téléphone ne reçoit que son propre rôle (`role:yours`) ;
 * l'état commun ne contient les rôles qu'après la révélation de la manche.
 */
import { useEffect, useRef, useState } from 'react';
import { useOnline } from '../../lib/useOnline.js';
import { inviteLink, inviteCode } from '../../lib/socket.js';
import { validateConfig } from '../../../../shared/police/roles.js';
import RoleCard from './RoleCard.jsx';
import RoleConfig from './RoleConfig.jsx';
import Reveal from './Reveal.jsx';
import { TopBar, ServerDown, OnlineMenu, CreateRoomForm, JoinRoomForm, RoomCode } from '../../components/ui.jsx';
import { PlayerList, GameBoard, EndGameModal, RoundsPicker, FinalScore } from './PoliceUI.jsx';

export default function OnlinePolice({ onExit }) {
  const [role, setRole] = useState(null);
  const o = useOnline('police', { 'role:yours': ({ role: r }) => setRole(r) });
  const { room, me, isHost, call, emit, error, busy } = o;

  if (o.conn === 'error' && o.view !== 'room') return <ServerDown onRetry={o.retry} onBack={onExit} />;
  if (o.view === 'menu') return <OnlineMenu title="POLICE" notice={o.notice} connecting={o.conn !== 'ok'} onBack={onExit} onCreate={() => o.setView('create')} onJoin={() => o.setView('join')} />;
  if (o.view === 'create') return <CreateRoomForm title="POLICE" defaultGameName="Partie de Police" busy={busy || o.conn !== 'ok'} error={error} onBack={() => { o.setError(''); o.setView('menu'); }} onSubmit={o.create} />;
  if (o.view === 'join') return <JoinRoomForm title="POLICE" initialCode={inviteCode()} busy={busy || o.conn !== 'ok'} error={error} onBack={() => { o.setError(''); o.setView('menu'); }} onSubmit={o.join} />;
  if (!room) return <div className="privacy"><p className="mute">Connexion à la salle…</p></div>;

  const myState = room.players.find((p) => p.id === me);
  const offline = o.conn !== 'ok' && <div className="error">Connexion perdue, reconnexion en cours… Ta place est gardée.</div>;

  if (room.status === 'lobby') return <Lobby room={room} me={me} isHost={isHost} busy={busy} error={error} call={call} emit={emit} onLeave={o.leave} offline={offline} />;

  if (room.status === 'playing') {
    if (!myState?.seenRole) {
      return <RoleScreen key={room.round} name={myState?.name} round={room.round} role={role} onSeen={() => emit('role:seen')} onNeedRole={async () => { const r = await emit('role:get'); if (r.ok) setRole(r.role); }} />;
    }
    return <PlayingScreen room={room} me={me} isHost={isHost} role={role} call={call} error={error} offline={offline} />;
  }

  if (room.status === 'revealed') {
    const last = room.maxRounds != null && room.round >= room.maxRounds;
    return (
      <div className="screen">
        <Reveal key={room.round} players={room.players} reveal={room.reveal} result={room.result} scores={room.scores} round={room.round}>
          {error && <div className="error">{error}</div>}
          {isHost ? (
            last ? <button className="btn red" disabled={busy} onClick={() => call('game:stop')}>Voir le score final</button> : (
              <>
                <button className="btn red" disabled={busy} onClick={() => call('game:next')}>Manche suivante ({room.round + 1}{room.maxRounds ? ` / ${room.maxRounds}` : ''})</button>
                <button className="btn ghost" disabled={busy} onClick={() => call('game:stop')}>Arrêter — score final</button>
              </>
            )
          ) : <p className="center mute small">L’hôte lance la manche suivante ou arrête la partie.</p>}
        </Reveal>
      </div>
    );
  }

  // finished
  return (
    <FinalScore gameName={room.gameName} players={room.players} scores={room.scores} rounds={room.round}>
      {error && <div className="error">{error}</div>}
      {isHost ? <button className="btn red" disabled={busy} onClick={() => call('game:lobby')}>Nouvelle partie (salle d’attente)</button> : <p className="center mute small">L’hôte peut lancer une nouvelle partie.</p>}
      <button className="btn ghost" onClick={o.leave}>Quitter la salle</button>
    </FinalScore>
  );
}

function Lobby({ room, me, isHost, busy, error, call, emit, onLeave, offline }) {
  const [draft, setDraft] = useState(room.roles);
  const lastSent = useRef(JSON.stringify(room.roles));
  useEffect(() => {
    const incoming = JSON.stringify(room.roles);
    if (incoming !== lastSent.current) { lastSent.current = incoming; setDraft(room.roles); }
  }, [room.roles]);
  const change = (roles) => { setDraft(roles); lastSent.current = JSON.stringify(roles); emit('roles:set', { roles }); };
  const check = validateConfig(isHost ? draft : room.roles, room.players.length);

  return (
    <div className="stack screen">
      <TopBar onBack={onLeave}><div className="eyebrow">{room.gameName} · salle d’attente</div></TopBar>
      {offline}
      <RoomCode code={room.code} link={inviteLink('police', room.code)} />
      <div>
        <span className="label">Participants ({room.players.length})</span>
        <PlayerList players={room.players} hostId={room.hostId} meId={me} onKick={isHost ? (p) => call('room:kick', { playerId: p.id }) : null} />
      </div>
      <RoundsPicker value={room.maxRounds} disabled={!isHost} onChange={(v) => call('rounds:set', { maxRounds: v })} />
      <div>
        <span className="label">Rôles {isHost ? '' : '(configurés par l’hôte)'}</span>
        <RoleConfig roles={isHost ? draft : room.roles} playerCount={room.players.length} readOnly={!isHost} onChange={change} onReset={() => call('roles:reset')} />
      </div>
      <div className="card small mute"><b style={{ color: 'var(--ink)' }}>Points :</b> 1 point par joueur à chaque manche, sauf le voleur démasqué (0) et le policier qui se trompe (0).</div>
      {error && <div className="error">{error}</div>}
      {isHost ? <button className="btn red" disabled={busy || !check.ok} onClick={() => call('game:start')}>Lancer la partie</button> : <p className="center mute small">En attente du lancement par l’hôte…</p>}
      <button className="btn ghost" onClick={onLeave}>Quitter la salle</button>
    </div>
  );
}

function RoleScreen({ name, round, role, onSeen, onNeedRole }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { if (!role) onNeedRole(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="privacy screen">
      <div className="eyebrow">Manche {round} · {name}, voici ton rôle</div>
      <p className="mute small">Assure-toi que personne ne regarde ton écran.</p>
      <RoleCard role={role} revealed={shown && !!role} hint="Touche pour découvrir" onClick={() => setShown((v) => !v)} />
      <div style={{ width: '100%', maxWidth: 340 }}>
        {!shown ? <button className="btn" disabled={!role} onClick={() => setShown(true)}>Découvrir mon rôle</button>
          : <button className="btn ghost" onClick={onSeen}>J’ai vu — cacher et continuer</button>}
      </div>
    </div>
  );
}

function PlayingScreen({ room, me, isHost, role, call, error, offline }) {
  const [ending, setEnding] = useState(false);
  const allSeen = room.players.every((p) => p.seenRole);
  return (
    <>
      <GameBoard gameName={room.gameName} round={room.round} maxRounds={room.maxRounds} players={room.players} hostId={room.hostId} meId={me}
        isHost={isHost} showSeen scores={room.scores} myRole={role} onEnd={() => setEnding(true)}>
        {offline}
        {!allSeen && <p className="small mute center">Certains joueurs n’ont pas encore regardé leur rôle.</p>}
        {error && <div className="error">{error}</div>}
      </GameBoard>
      {ending && <EndGameModal players={room.players} onCancel={() => setEnding(false)} onConfirm={async (accusedId) => { const r = await call('game:end', { accusedId }); if (r.ok) setEnding(false); }} />}
    </>
  );
}
