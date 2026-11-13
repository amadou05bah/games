/**
 * DÉFIE TA LETTRE — mode un seul téléphone.
 * Chaque joueur, à son tour : écran de confidentialité → tirage (même lettre pour tous) → saisie chronométrée.
 * Les réponses sont gardées en mémoire, puis révélées toutes ensemble à la correction.
 * Arbitrage manuel : le groupe touche une réponse pour l'accepter ou la refuser.
 */
import { useCallback, useState } from 'react';
import { DEFAULT_CATEGORIES, CATEGORY_BY_ID } from '../../../../shared/lettre/categories.js';
import { TOTAL_ROUNDS, CATEGORIES_PER_ROUND, drawLetter, checkSheet, sheetScore } from '../../../../shared/lettre/engine.js';
import { store, cryptoInt } from '../../lib/store.js';
import { TopBar, Counter } from '../../components/ui.jsx';
import {
  SettingsPanel, LetterReveal, Countdown, AnswerSheet, CorrectionTable, Legend, CellDialog, RoundRanking, FinalResults,
} from './LettreUI.jsx';

const MIN = 2;
const MAX = 12;
const emptySheet = () => Array(CATEGORIES_PER_ROUND).fill('');

export default function LocalLettre({ onExit }) {
  const [step, setStep] = useState('setup'); // setup → handoff → reveal → write → … → correction → ranking → … → final
  const [names, setNames] = useState(() => {
    const saved = store.get('lettre_local_names', []);
    return saved.length >= MIN ? saved : ['', ''];
  });
  const [config, setConfig] = useState({ categories: [...DEFAULT_CATEGORIES], timer: 90, hardLetters: false });
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(0);
  const [letters, setLetters] = useState([]);
  const [turn, setTurn] = useState(0);
  const [sheets, setSheets] = useState({});
  const [results, setResults] = useState({});
  const [scores, setScores] = useState({});
  const [history, setHistory] = useState([]);
  const [revealUntil, setRevealUntil] = useState(0);
  const [endsAt, setEndsAt] = useState(null);
  const [cell, setCell] = useState(null);
  const [error, setError] = useState('');

  const letter = letters[round - 1];
  const player = players[turn];

  const start = () => {
    const final = names.map((n, i) => n.trim() || `Joueur ${i + 1}`);
    if (new Set(final.map((n) => n.toLowerCase())).size !== final.length) { setError('Deux joueurs ont le même nom.'); return; }
    if (config.categories.length !== CATEGORIES_PER_ROUND) { setError(`Choisis exactement ${CATEGORIES_PER_ROUND} catégories.`); return; }
    setError('');
    store.set('lettre_local_names', final);
    const ps = final.map((name, i) => ({ id: `p${i}`, name }));
    setPlayers(ps);
    setScores(Object.fromEntries(ps.map((p) => [p.id, 0])));
    setHistory([]);
    newRound(1, []);
  };

  const newRound = (r, used) => {
    const l = drawLetter(used, config.hardLetters, cryptoInt);
    setLetters([...used, l]);
    setRound(r);
    setTurn(0);
    setSheets({});
    setResults({});
    setStep('handoff');
  };

  const beginTurn = () => {
    setRevealUntil(Date.now() + 3000);
    setStep('reveal');
  };

  const startWriting = useCallback(() => {
    setSheets((s) => ({ ...s, [players[turn].id]: s[players[turn].id] || emptySheet() }));
    setEndsAt(config.timer ? Date.now() + config.timer * 1000 : null);
    setStep('write');
  }, [players, turn, config.timer]);

  /** Fin de la saisie (bouton ou temps écoulé) : réponses verrouillées, joueur suivant. */
  const lockTurn = useCallback(() => {
    if (turn + 1 < players.length) { setTurn(turn + 1); setStep('handoff'); return; }
    // tout le monde a joué → correction automatique
    setResults(Object.fromEntries(players.map((p) => [p.id, checkSheet(sheets[p.id], letter, config.categories)])));
    setStep('correction');
  }, [turn, players, letter, config.categories, sheets]);

  const arbitrate = (pid, i, override) => {
    setResults((r) => ({ ...r, [pid]: r[pid].map((x, j) => (j === i ? { ...x, override } : x)) }));
    setCell(null);
  };

  const finishCorrection = () => {
    const points = Object.fromEntries(players.map((p) => [p.id, sheetScore(results[p.id])]));
    setScores((s) => Object.fromEntries(players.map((p) => [p.id, (s[p.id] || 0) + points[p.id]])));
    setHistory((h) => [...h, { round, letter, points }]);
    setStep('ranking');
  };

  /* ================= Rendu ================= */

  if (step === 'setup') {
    return (
      <div className="stack screen">
        <TopBar onBack={onExit}><div className="eyebrow">Défie ta lettre · un seul téléphone</div></TopBar>
        <h2 className="title">Créer une partie</h2>
        <div className="row">
          <span className="label" style={{ margin: 0, flex: 1 }}>Nombre de joueurs</span>
          <Counter value={names.length} min={MIN} max={MAX} onChange={(n) => setNames((p) => (n > p.length ? [...p, ''] : p.slice(0, n)))} />
        </div>
        <div className="players">
          {names.map((n, i) => (
            <div className="row" key={i}>
              <span className="avatar">{i + 1}</span>
              <input className="input" maxLength={20} placeholder={`Prénom du joueur ${i + 1}`} value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
        <SettingsPanel config={config} onChange={(patch) => setConfig({ ...config, ...patch })} />
        {error && <div className="error">{error}</div>}
        <button className="btn yellow" disabled={config.categories.length !== CATEGORIES_PER_ROUND} onClick={start}>Commencer (5 tours)</button>
      </div>
    );
  }

  if (step === 'handoff') {
    return (
      <div className="privacy screen" key={`h${round}-${turn}`}>
        <div className="progress">{players.map((p, i) => <i key={p.id} className={i < turn ? 'on' : ''} />)}</div>
        <div className="eyebrow">Tour {round} / {TOTAL_ROUNDS}</div>
        <div className="mute">Passe le téléphone à</div>
        <div className="big">{player.name}</div>
        <p className="mute small">Les autres ne regardent pas. Le chrono démarre dès que la lettre apparaît{config.timer ? ` (${config.timer} s)` : ''}.</p>
        <div style={{ width: '100%', maxWidth: 340 }}><button className="btn yellow" onClick={beginTurn}>Je suis {player.name}, je suis prêt·e</button></div>
      </div>
    );
  }

  if (step === 'reveal') return <LetterReveal letter={letter} until={revealUntil} round={round} onDone={startWriting} />;

  if (step === 'write') {
    return (
      <AnswerSheet key={`w${round}-${turn}`} who={player.name} letter={letter} categories={config.categories}
        answers={sheets[player.id] || emptySheet()}
        onChange={(a) => setSheets((s) => ({ ...s, [player.id]: a }))}
        timer={<Countdown endsAt={endsAt} total={config.timer} onExpire={lockTurn} />}
        footer={<button className="btn yellow" onClick={lockTurn}>J’ai fini — verrouiller mes réponses</button>} />
    );
  }

  if (step === 'correction') {
    const detail = cell && results[cell.pid]?.[cell.i];
    return (
      <div className="stack screen">
        <div className="center"><div className="eyebrow">Tour {round} / {TOTAL_ROUNDS}</div><h2 className="title">Correction — lettre {letter}</h2></div>
        <p className="small mute center">Arbitrage : touchez une réponse contestée pour l’accepter ou la refuser ensemble.</p>
        <Legend />
        <CorrectionTable players={players} categories={config.categories} results={results} onCell={(pid, i) => setCell({ pid, i })} />
        <button className="btn yellow" onClick={finishCorrection}>Valider la correction</button>
        {detail && (
          <CellDialog player={players.find((p) => p.id === cell.pid)} category={CATEGORY_BY_ID[config.categories[cell.i]]} result={detail} onClose={() => setCell(null)}>
            {detail.status !== 'empty' && (
              <div className="row">
                <button className="btn green" onClick={() => arbitrate(cell.pid, cell.i, true)}>✓ Accepter</button>
                <button className="btn red" onClick={() => arbitrate(cell.pid, cell.i, false)}>✗ Refuser</button>
              </div>
            )}
            {detail.override !== undefined && <button className="btn ghost" onClick={() => arbitrate(cell.pid, cell.i, undefined)}>Revenir à la décision automatique</button>}
          </CellDialog>
        )}
      </div>
    );
  }

  if (step === 'ranking') {
    const last = round >= TOTAL_ROUNDS;
    return (
      <RoundRanking players={players} roundPoints={history[history.length - 1]?.points || {}} scores={scores} round={round} letter={letter}>
        <button className="btn yellow" onClick={() => (last ? setStep('final') : newRound(round + 1, letters))}>{last ? 'Résultats finaux' : `Tour suivant (${round + 1} / ${TOTAL_ROUNDS})`}</button>
      </RoundRanking>
    );
  }

  return (
    <FinalResults players={players} scores={scores} history={history}>
      <button className="btn yellow" onClick={start}>Rejouer (mêmes joueurs)</button>
      <button className="btn ghost" onClick={() => setStep('setup')}>Modifier la partie</button>
      <button className="btn ghost" onClick={onExit}>Retour</button>
    </FinalResults>
  );
}
