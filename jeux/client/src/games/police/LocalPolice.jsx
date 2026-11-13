/**
 * POLICE — mode un seul téléphone.
 * Distribution sur l'appareil (générateur cryptographique). Les rôles ne sont jamais enregistrés.
 * Points : 1 pt par joueur et par manche ; voleur démasqué → 0 ; policier qui se trompe → 0.
 */
import { useState } from 'react';
import { defaultRoles, validateConfig, assignRoles, policeResult, roundPoints, MIN_PLAYERS, MAX_PLAYERS } from '../../../../shared/police/roles.js';
import { store, cryptoInt } from '../../lib/store.js';
import RoleCard, { Shield } from './RoleCard.jsx';
import RoleConfig from './RoleConfig.jsx';
import Reveal from './Reveal.jsx';
import { TopBar, Counter, initial } from '../../components/ui.jsx';
import { GameBoard, EndGameModal, RoundsPicker, FinalScore } from './PoliceUI.jsx';

export default function LocalPolice({ onExit }) {
  const [step, setStep] = useState('setup'); // setup → roles → distribute → game → reveal → final | new
  const [gameName, setGameName] = useState('Partie de Police');
  const [names, setNames] = useState(() => {
    const saved = store.get('police_local_names', []);
    return saved.length >= MIN_PLAYERS ? saved : ['', '', '', '', ''];
  });
  const [maxRounds, setMaxRounds] = useState(null);
  const [roles, setRoles] = useState(null);
  const [rolesTouched, setRolesTouched] = useState(false);
  const [players, setPlayers] = useState([]);
  const [assignments, setAssignments] = useState(null);
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState({});
  const [turn, setTurn] = useState(0);
  const [shown, setShown] = useState(false);
  const [result, setResult] = useState(null);
  const [ending, setEnding] = useState(false);
  const [peek, setPeek] = useState(null);
  const [error, setError] = useState('');

  const setCount = (n) => setNames((prev) => (n > prev.length ? [...prev, ...Array(n - prev.length).fill('')] : prev.slice(0, n)));

  const goToRoles = () => {
    const final = names.map((n, i) => n.trim() || `Joueur ${i + 1}`);
    if (new Set(final.map((n) => n.toLowerCase())).size !== final.length) { setError('Deux participants ont le même nom.'); return; }
    setError('');
    store.set('police_local_names', final);
    setPlayers(final.map((name, i) => ({ id: `p${i}`, name })));
    if (!roles || !rolesTouched) setRoles(defaultRoles(final.length));
    setStep('roles');
  };

  /** Nouvelle partie : scores remis à zéro, puis 1re manche. */
  const startGame = () => {
    const check = validateConfig(roles, players.length);
    if (!check.ok) { setError(check.errors[0]); return; }
    setError('');
    setScores(Object.fromEntries(players.map((p) => [p.id, 0])));
    setRound(0);
    deal(0);
  };

  /** Distribution d'une manche. */
  const deal = (currentRound = round) => {
    setAssignments(assignRoles(players, roles, cryptoInt));
    setRound(currentRound + 1);
    setTurn(0);
    setShown(false);
    setResult(null);
    setStep('distribute');
  };

  const nextPlayer = () => {
    setShown(false);
    if (turn + 1 < players.length) setTurn(turn + 1);
    else setStep('game');
  };

  const endRound = (accusedId) => {
    const points = roundPoints(players, assignments, accusedId);
    setScores((s) => Object.fromEntries(players.map((p) => [p.id, (s[p.id] || 0) + points[p.id]])));
    setResult({ accusedId, correct: policeResult(assignments, accusedId), points });
    setEnding(false);
    setStep('reveal');
  };

  const lastRound = maxRounds != null && round >= maxRounds;

  /* ================= Rendu ================= */

  if (step === 'setup') {
    return (
      <div className="stack screen">
        <TopBar onBack={onExit}><div className="eyebrow">POLICE · un seul téléphone</div></TopBar>
        <h2 className="title">Créer une partie</h2>
        <div>
          <label className="label" htmlFor="gname">Nom de la partie</label>
          <input id="gname" className="input" maxLength={40} value={gameName} onChange={(e) => setGameName(e.target.value)} />
        </div>
        <div className="row">
          <span className="label" style={{ margin: 0, flex: 1 }}>Nombre de participants</span>
          <Counter value={names.length} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={setCount} />
        </div>
        <div className="players">
          {names.map((n, i) => (
            <div className="row" key={i}>
              <span className="avatar">{i + 1}</span>
              <input className="input" maxLength={20} placeholder={`Nom ou pseudo du joueur ${i + 1}`} value={n}
                onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
        <RoundsPicker value={maxRounds} onChange={setMaxRounds} />
        {error && <div className="error">{error}</div>}
        <button className="btn" onClick={goToRoles}>Continuer : les rôles</button>
      </div>
    );
  }

  if (step === 'roles') {
    const ok = validateConfig(roles, players.length).ok;
    return (
      <div className="stack screen">
        <TopBar onBack={() => setStep('setup')}><div className="eyebrow">{gameName}</div></TopBar>
        <h2 className="title">Configuration des rôles</h2>
        <p className="mute small">Renommez, ajoutez ou retirez des rôles selon votre variante. Le total doit correspondre aux {players.length} participants.</p>
        <RoleConfig roles={roles} playerCount={players.length}
          onChange={(r) => { setRoles(r); setRolesTouched(true); }}
          onReset={() => { setRoles(defaultRoles(players.length)); setRolesTouched(false); }} />
        <div className="card small mute">
          <b style={{ color: 'var(--ink)' }}>Points :</b> 1 point par joueur à chaque manche, sauf le voleur s’il est démasqué (0) et le policier s’il se trompe (0).
        </div>
        <button className="btn red" disabled={!ok} onClick={startGame}>Distribuer les rôles</button>
      </div>
    );
  }

  if (step === 'distribute') {
    const p = players[turn];
    return (
      <div className="screen" key={`${p.id}-${shown}`}>
        <div className="progress" style={{ marginBottom: 10 }}>{players.map((x, i) => <i key={x.id} className={i < turn ? 'on' : ''} />)}</div>
        {!shown ? (
          <div className="privacy">
            <Shield />
            <div className="eyebrow">Manche {round}{maxRounds ? ` / ${maxRounds}` : ''}</div>
            <div className="mute">Passe le téléphone à</div>
            <div className="big">{p.name}</div>
            <p className="mute small">Les autres, ne regardez pas l’écran.</p>
            <div style={{ width: '100%', maxWidth: 340 }}><button className="btn" onClick={() => setShown(true)}>Je suis {p.name}, voir mon rôle</button></div>
            <p className="small mute">{turn + 1} / {players.length}</p>
          </div>
        ) : (
          <div className="privacy">
            <div className="eyebrow">{p.name}, ton rôle est</div>
            <RoleCard role={assignments.get(p.id)} revealed />
            <p className="mute small">Mémorise-le, puis cache l’écran.</p>
            <div style={{ width: '100%', maxWidth: 340 }}>
              <button className="btn ghost" onClick={nextPlayer}>{turn + 1 < players.length ? 'J’ai vu — cacher et passer' : 'J’ai vu — cacher et commencer'}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'game') {
    if (peek) {
      const who = players.find((x) => x.id === peek.id);
      return (
        <div className="stack screen">
          <TopBar onBack={() => setPeek(null)}><div className="eyebrow">Revoir mon rôle</div></TopBar>
          {!who ? (
            <>
              <p className="mute">Qui es-tu ?</p>
              <div className="players">
                {players.map((x) => <button key={x.id} className="opt" onClick={() => setPeek({ id: x.id, shown: false })}><span className="avatar">{initial(x.name)}</span>{x.name}</button>)}
              </div>
            </>
          ) : (
            <div className="privacy" style={{ minHeight: 0 }}>
              <RoleCard role={assignments.get(who.id)} revealed={peek.shown} who={who.name} hint="Touche pour retourner" onClick={() => setPeek({ ...peek, shown: !peek.shown })} />
              <button className="btn ghost" onClick={() => setPeek(null)}>Cacher et revenir à la partie</button>
            </div>
          )}
        </div>
      );
    }
    return (
      <>
        <GameBoard gameName={gameName} round={round} maxRounds={maxRounds} players={players} isHost scores={scores}
          onPeek={() => setPeek({ id: null, shown: false })} onEnd={() => setEnding(true)} />
        {ending && <EndGameModal players={players} onCancel={() => setEnding(false)} onConfirm={endRound} />}
      </>
    );
  }

  if (step === 'reveal') {
    const reveal = players.map((p) => ({ playerId: p.id, ...assignments.get(p.id) }));
    return (
      <div className="screen">
        <Reveal key={round} players={players} reveal={reveal} result={result} scores={scores} round={round}>
          {lastRound ? (
            <button className="btn red" onClick={() => setStep('final')}>Voir le score final</button>
          ) : (
            <>
              <button className="btn red" onClick={() => deal()}>Manche suivante ({round + 1}{maxRounds ? ` / ${maxRounds}` : ''})</button>
              <button className="btn ghost" onClick={() => setStep('final')}>Arrêter — score final</button>
            </>
          )}
        </Reveal>
      </div>
    );
  }

  if (step === 'final') {
    return (
      <FinalScore gameName={gameName} players={players} scores={scores} rounds={round}>
        <button className="btn red" onClick={startGame}>Rejouer (mêmes joueurs)</button>
        <button className="btn ghost" onClick={() => setStep('new')}>Nouvelle partie</button>
      </FinalScore>
    );
  }

  // step === 'new' — écran de nouvelle partie
  return (
    <div className="stack screen">
      <TopBar onBack={() => setStep('final')}><div className="eyebrow">{gameName}</div></TopBar>
      <h2 className="title">Nouvelle partie</h2>
      <button className="btn red" onClick={startGame}>Recommencer avec les mêmes réglages</button>
      <button className="btn ghost" onClick={() => setStep('roles')}>Modifier les rôles</button>
      <button className="btn ghost" onClick={() => setStep('setup')}>Changer les participants ou les manches</button>
      <button className="btn ghost" onClick={onExit}>Retour</button>
    </div>
  );
}
