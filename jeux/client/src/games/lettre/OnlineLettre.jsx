/**
 * DÉFIE TA LETTRE — mode en ligne.
 * Le serveur tire la lettre, tient le chronomètre (synchronisé via l'heure serveur) et verrouille les réponses.
 * Les réponses sont sauvegardées automatiquement ; celles des autres ne sont visibles qu'à la correction.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnline } from '../../lib/useOnline.js';
import { inviteLink, inviteCode } from '../../lib/socket.js';
import { CATEGORY_BY_ID } from '../../../../shared/lettre/categories.js';
import { CATEGORIES_PER_ROUND, TOTAL_ROUNDS } from '../../../../shared/lettre/engine.js';
import { TopBar, ServerDown, OnlineMenu, CreateRoomForm, JoinRoomForm, RoomCode, initial } from '../../components/ui.jsx';
import {
  SettingsPanel, LetterReveal, Countdown, AnswerSheet, CorrectionTable, Legend, CellDialog, RoundRanking, FinalResults,
} from './LettreUI.jsx';

const emptySheet = () => Array(CATEGORIES_PER_ROUND).fill('');

export default function OnlineLettre({ onExit }) {
  const [answers, setAnswers] = useState(emptySheet);
  const restored = useRef(null);
  const o = useOnline('lettre', {
    'sheet:yours': ({ answers: a }) => { if (a) { restored.current = a; setAnswers(a); } },
  });
  const { room, me, isHost, call, error, busy } = o;

  // Décalage entre l'horloge du serveur et celle du téléphone (pour un décompte synchronisé).
  const offset = useRef(0);
  useEffect(() => { if (room?.serverNow) offset.current = room.serverNow - Date.now(); }, [room]);
  const toLocal = (t) => (t ? t - offset.current : t);

  // Nouvelle feuille vierge à chaque tour (sauf reprise après reconnexion).
  const roundKey = room ? `${room.round}-${room.letter}` : '';
  useEffect(() => {
    if (restored.current) { restored.current = null; return; }
    setAnswers(emptySheet());
  }, [roundKey]);

  if (o.conn === 'error' && o.view !== 'room') return <ServerDown onRetry={o.retry} onBack={onExit} />;
  if (o.view === 'menu') return <OnlineMenu title="Défie ta lettre" notice={o.notice} connecting={o.conn !== 'ok'} onBack={onExit} onCreate={() => o.setView('create')} onJoin={() => o.setView('join')} />;
  if (o.view === 'create') return <CreateRoomForm title="Défie ta lettre" defaultGameName="Défie ta lettre" busy={busy || o.conn !== 'ok'} error={error} onBack={() => { o.setError(''); o.setView('menu'); }} onSubmit={o.create} />;
  if (o.view === 'join') return <JoinRoomForm title="Défie ta lettre" initialCode={inviteCode()} busy={busy || o.conn !== 'ok'} error={error} onBack={() => { o.setError(''); o.setView('menu'); }} onSubmit={o.join} />;
  if (!room) return <div className="privacy"><p className="mute">Connexion à la salle…</p></div>;

  const offline = o.conn !== 'ok' && <div className="error">Connexion perdue, reconnexion en cours… Tes réponses sont gardées.</div>;

  if (room.status === 'lobby') return <Lobby room={room} me={me} isHost={isHost} busy={busy} error={error} call={call} onLeave={o.leave} offline={offline} />;
  if (room.status === 'playing') {
    return <Playing key={roundKey} room={room} me={me} isHost={isHost} answers={answers} setAnswers={setAnswers} emit={o.emit} call={call} toLocal={toLocal} offline={offline} error={error} />;
  }
  if (room.status === 'review') return <Review room={room} me={me} isHost={isHost} call={call} emit={o.emit} busy={busy} error={error} offline={offline} />;
  if (room.status === 'scores') {
    const h = room.history[room.history.length - 1];
    const last = room.round >= TOTAL_ROUNDS;
    return (
      <RoundRanking players={room.players} roundPoints={room.roundPoints} scores={room.scores} round={room.round} letter={h?.letter}>
        {offline}
        {isHost ? <button className="btn yellow" disabled={busy} onClick={() => call('game:next')}>{last ? 'Résultats finaux' : `Tour suivant (${room.round + 1} / ${TOTAL_ROUNDS})`}</button>
          : <p className="center mute small">L’hôte lance la suite.</p>}
      </RoundRanking>
    );
  }
  return (
    <FinalResults players={room.players} scores={room.scores} history={room.history}>
      {isHost ? <button className="btn yellow" disabled={busy} onClick={() => call('game:lobby')}>Nouvelle partie (salle d’attente)</button> : <p className="center mute small">L’hôte peut relancer une partie.</p>}
      <button className="btn ghost" onClick={o.leave}>Quitter la salle</button>
    </FinalResults>
  );
}

function Lobby({ room, me, isHost, busy, error, call, onLeave, offline }) {
  const ready = room.players.length >= 2 && room.config.categories.length === CATEGORIES_PER_ROUND;
  return (
    <div className="stack screen">
      <TopBar onBack={onLeave}><div className="eyebrow">{room.gameName} · salle d’attente</div></TopBar>
      {offline}
      <RoomCode code={room.code} link={inviteLink('lettre', room.code)} />
      <div>
        <span className="label">Joueurs ({room.players.length})</span>
        <div className="players">
          {room.players.map((p) => (
            <div className="player" key={p.id}>
              <span className="avatar">{initial(p.name)}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name} {p.id === me && <span className="mute small">(toi)</span>}</span>
              {p.id === room.hostId && <span className="tag host">Hôte</span>}
              <span className={`dot ${p.connected ? '' : 'off'}`} />
              {isHost && p.id !== room.hostId && <button className="tag" onClick={() => call('room:kick', { playerId: p.id })}>Retirer</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="card small mute">5 tours · 10 catégories · 1 point par bonne réponse (50 points maximum).</div>
      <SettingsPanel config={room.config} readOnly={!isHost} onChange={(patch) => call('config:set', patch)} />
      {error && <div className="error">{error}</div>}
      {isHost ? (
        <button className="btn yellow" disabled={busy || !ready} onClick={() => call('game:start')}>{room.players.length < 2 ? 'En attente d’au moins 2 joueurs' : 'Lancer la partie'}</button>
      ) : <p className="center mute small">En attente du lancement par l’hôte…</p>}
      <button className="btn ghost" onClick={onLeave}>Quitter la salle</button>
    </div>
  );
}

function Playing({ room, me, isHost, answers, setAnswers, emit, call, toLocal, offline, error }) {
  const startsAt = toLocal(room.startsAt);
  const endsAt = toLocal(room.endsAt);
  const [phase, setPhase] = useState(() => (Date.now() < startsAt ? 'reveal' : 'write'));
  const mine = room.players.find((p) => p.id === me);
  const latest = useRef(answers);
  latest.current = answers;

  // Sauvegarde automatique (brouillon) pendant la saisie.
  useEffect(() => {
    if (phase !== 'write' || mine?.submitted) return undefined;
    const t = setTimeout(() => emit('sheet:save', { answers }), 600);
    return () => clearTimeout(t);
  }, [answers, phase, mine?.submitted, emit]);

  const onExpire = useCallback(() => { emit('sheet:save', { answers: latest.current }); }, [emit]);
  const onRevealDone = useCallback(() => setPhase('write'), []);

  if (phase === 'reveal') return <LetterReveal letter={room.letter} until={startsAt} round={room.round} onDone={onRevealDone} />;

  const done = room.players.filter((p) => p.submitted).length;
  if (mine?.submitted) {
    return (
      <div className="stack screen">
        <div className="sheet-head"><div className="letter-chip">{room.letter}</div><div style={{ flex: 1 }}><div className="eyebrow">Tour {room.round} / {TOTAL_ROUNDS}</div><Countdown endsAt={endsAt} total={room.config.timer} /></div></div>
        {offline}
        <div className="card center"><div style={{ fontSize: 40 }}>📨</div><h3 className="title">Réponses envoyées</h3><p className="mute">En attente des autres joueurs ({done} / {room.players.length})</p></div>
        <div className="players">
          {room.players.map((p) => <div className="player" key={p.id}><span className="avatar">{initial(p.name)}</span><span style={{ flex: 1 }}>{p.name}</span>{p.submitted ? <span className="tag ok">A rendu ✓</span> : <span className="tag">Écrit…</span>}</div>)}
        </div>
        {isHost && <button className="btn ghost" onClick={() => call('round:end')}>Terminer le tour maintenant</button>}
      </div>
    );
  }
  return (
    <>
      {offline}
      <AnswerSheet letter={room.letter} categories={room.config.categories} answers={answers} onChange={setAnswers}
        timer={<Countdown endsAt={endsAt} total={room.config.timer} onExpire={onExpire} />}
        footer={
          <div className="stack">
            {error && <div className="error">{error}</div>}
            <button className="btn yellow" onClick={() => call('sheet:submit', { answers })}>J’ai fini — envoyer mes réponses</button>
            <p className="center small mute">{done} / {room.players.length} joueur{room.players.length > 1 ? 's ont' : ' a'} rendu</p>
            {isHost && !room.endsAt && <button className="btn ghost" onClick={() => call('round:end')}>Terminer le tour pour tout le monde</button>}
          </div>
        } />
    </>
  );
}

function Review({ room, me, isHost, call, emit, busy, error, offline }) {
  const [cell, setCell] = useState(null);
  const detail = cell && room.results[cell.pid]?.[cell.i];
  const openVotes = Object.entries(room.contests).filter(([, c]) => c.open);
  const nameOf = (id) => room.players.find((p) => p.id === id)?.name;
  const catOf = (i) => CATEGORY_BY_ID[room.config.categories[i]];

  return (
    <div className="stack screen">
      <div className="center"><div className="eyebrow">Tour {room.round} / {TOTAL_ROUNDS}</div><h2 className="title">Correction — lettre {room.letter}</h2></div>
      {offline}
      <p className="small mute center">Touchez une réponse pour la contester (ou demander sa validation). Les autres joueurs votent.</p>
      {openVotes.length > 0 && (
        <div className="stack">
          {openVotes.map(([key, c]) => {
            const [pid, i] = key.split(':');
            const res = room.results[pid][Number(i)];
            const myVote = c.votes[me];
            const canVote = pid !== me;
            return (
              <div className="card vote-card" key={key}>
                <div className="small mute">Vote · {catOf(Number(i)).icon} {catOf(Number(i)).name} · réponse de {nameOf(pid)}</div>
                <div className="title" style={{ fontSize: 26 }}>« {res.answer} »</div>
                <div className="small mute">{Object.keys(c.votes).length} vote(s) · contestée par {nameOf(c.by)}</div>
                {canVote ? (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className={`btn green ${myVote === true ? '' : 'dim'}`} onClick={() => emit('contest:vote', { key, accept: true })}>✓ Valable</button>
                    <button className={`btn red ${myVote === false ? '' : 'dim'}`} onClick={() => emit('contest:vote', { key, accept: false })}>✗ Refusée</button>
                  </div>
                ) : <p className="small mute">C’est ta réponse : les autres votent.</p>}
              </div>
            );
          })}
        </div>
      )}
      <Legend />
      <CorrectionTable players={room.players} categories={room.config.categories} results={room.results} contests={room.contests} onCell={(pid, i) => setCell({ pid, i })} />
      {error && <div className="error">{error}</div>}
      {isHost ? <button className="btn yellow" disabled={busy} onClick={() => call('review:finish')}>Valider la correction{openVotes.length ? ' (clôt les votes)' : ''}</button>
        : <p className="center mute small">L’hôte valide la correction quand tout le monde est d’accord.</p>}
      {detail && (
        <CellDialog player={room.players.find((p) => p.id === cell.pid)} category={catOf(cell.i)} result={detail} onClose={() => setCell(null)}>
          {detail.status !== 'empty' && !room.contests[`${cell.pid}:${cell.i}`]?.open && (
            <button className="btn" onClick={async () => { await call('contest:open', { playerId: cell.pid, index: cell.i }); setCell(null); }}>
              {cell.pid === me ? 'Demander un vote sur ma réponse' : 'Contester / soumettre au vote'}
            </button>
          )}
          {room.contests[`${cell.pid}:${cell.i}`]?.open && <p className="small mute">Un vote est en cours sur cette réponse.</p>}
        </CellDialog>
      )}
    </div>
  );
}
