/** DÉFIE TA LETTRE — composants d'écran partagés par le mode local et le mode en ligne. */
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_BY_ID, DEFAULT_CATEGORIES } from '../../../../shared/lettre/categories.js';
import { ALPHABET, CATEGORIES_PER_ROUND, TIMER_CHOICES, TOTAL_ROUNDS, core, isAccepted } from '../../../../shared/lettre/engine.js';
import { rankPlayers } from '../../../../shared/ranking.js';
import { Ranking, Seg, initial } from '../../components/ui.jsx';

export const timerLabel = (t) => (t ? `${t} s` : 'Illimité');

/* ---------- Configuration ---------- */

export function CategoryPicker({ selected, onChange, readOnly }) {
  const full = selected.length >= CATEGORIES_PER_ROUND;
  const toggle = (id) => {
    if (readOnly) return;
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (!full) onChange([...selected, id]);
  };
  return (
    <div className="stack">
      <div className={`total ${selected.length === CATEGORIES_PER_ROUND ? 'ok' : 'bad'}`}>
        <span>Catégories choisies</span><span>{selected.length} / {CATEGORIES_PER_ROUND} {selected.length === CATEGORIES_PER_ROUND ? '✓' : ''}</span>
      </div>
      <div className="cat-grid">
        {(readOnly ? selected.map((id) => CATEGORY_BY_ID[id]) : CATEGORIES).map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} className={`cat-chip ${on ? 'on' : ''}`} disabled={readOnly || (!on && full)} onClick={() => toggle(c.id)}>
              <span>{c.icon}</span>{c.name}{on && !readOnly && <b className="cat-n">{selected.indexOf(c.id) + 1}</b>}
            </button>
          );
        })}
      </div>
      {!readOnly && (
        <div className="row">
          <button className="btn ghost small" onClick={() => onChange([...DEFAULT_CATEGORIES])}>Catégories classiques</button>
          <button className="btn ghost small" onClick={() => onChange([])}>Tout retirer</button>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ config, onChange, readOnly }) {
  return (
    <div className="stack">
      <div>
        <span className="label">Chronomètre par tour</span>
        <Seg options={TIMER_CHOICES.map((t) => ({ value: t, label: timerLabel(t) }))} value={config.timer} disabled={readOnly} onChange={(timer) => onChange({ timer })} />
      </div>
      <label className="row small" style={{ cursor: readOnly ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={config.hardLetters} disabled={readOnly} onChange={(e) => onChange({ hardLetters: e.target.checked })} />
        <span>Inclure les lettres difficiles (K, Q, W, X, Y, Z)</span>
      </label>
      <div>
        <span className="label">Les 10 catégories</span>
        <CategoryPicker selected={config.categories} readOnly={readOnly} onChange={(categories) => onChange({ categories })} />
      </div>
    </div>
  );
}

/* ---------- Tirage de la lettre ---------- */

/** Animation « machine à sous » jusqu'à `until` (horodatage local), puis la lettre s'affiche en grand. */
export function LetterReveal({ letter, until, round, onDone }) {
  const [shown, setShown] = useState(ALPHABET[0]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() >= until - 700) { setShown(letter); setDone(true); clearInterval(iv); return; }
      setShown(ALPHABET[Math.floor(Math.random() * 26)]);
    }, 70);
    return () => clearInterval(iv);
  }, [letter, until]);
  useEffect(() => {
    if (!done || !onDone) return undefined;
    const t = setTimeout(onDone, Math.max(0, until - Date.now()));
    return () => clearTimeout(t);
  }, [done, until, onDone]);
  return (
    <div className="privacy">
      <div className="eyebrow">Tour {round} / {TOTAL_ROUNDS}</div>
      <p className="mute">{done ? 'La lettre est…' : 'Tirage de la lettre…'}</p>
      <div className={`letter-big ${done ? 'landed' : 'spin'}`}>{shown}</div>
      {done && <p className="mute">Prêts ? C’est parti !</p>}
    </div>
  );
}

/* ---------- Chronomètre ---------- */

/** Décompte jusqu'à `endsAt` (horodatage local). onExpire est appelé une seule fois. */
export function Countdown({ endsAt, total, onExpire }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    if (!endsAt) return undefined;
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, [endsAt]);
  const left = endsAt ? Math.max(0, endsAt - now) : null;
  useEffect(() => {
    if (endsAt && left === 0 && !fired.current) { fired.current = true; onExpire?.(); }
  }, [left, endsAt, onExpire]);
  if (!endsAt) return <div className="timer"><span>⏱️ Temps illimité</span></div>;
  const s = Math.ceil(left / 1000);
  const pct = total ? (left / (total * 1000)) * 100 : 0;
  return (
    <div className={`timer ${s <= 10 ? 'urgent' : ''}`}>
      <span>⏱️ {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
      <div className="tbar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ---------- Saisie des 10 réponses ---------- */

export function AnswerSheet({ letter, categories, answers, onChange, locked, timer, footer, who }) {
  const L = letter.toLowerCase();
  return (
    <div className="screen">
      <div className="sheet-head">
        <div className="letter-chip">{letter}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{who ? `${who} · ` : ''}Tout commence par {letter}</div>
          {timer}
        </div>
      </div>
      <div className="sheet">
        {categories.map((id, i) => {
          const cat = CATEGORY_BY_ID[id];
          const val = answers[i] || '';
          const c = core(val);
          const state = !c ? '' : c.startsWith(L) ? 'good' : 'bad';
          return (
            <label key={id} className={`answer ${state}`}>
              <span className="a-cat"><span>{cat.icon}</span>{i + 1}. {cat.name}</span>
              <span className="a-row">
                <input value={val} disabled={locked} maxLength={60} placeholder={`${letter}…`} autoComplete="off" autoCapitalize="words"
                  onChange={(e) => onChange(answers.map((a, j) => (j === i ? e.target.value : a)))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.closest('.sheet')?.querySelectorAll('input')[i + 1]?.focus(); } }} />
                {state === 'good' && <span className="a-ok">✓</span>}
                {state === 'bad' && <span className="a-ko" title={`Doit commencer par ${letter}`}>{letter}?</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>{footer}</div>
    </div>
  );
}

/* ---------- Correction ---------- */

const cellClass = (r) => (r.status === 'empty' ? 'empty' : isAccepted(r) ? (r.status === 'valid' && r.override === undefined ? 'ok' : 'maybe') : 'ko');
const cellIcon = (r) => (r.status === 'empty' ? '—' : isAccepted(r) ? (r.status === 'valid' && r.override === undefined ? '✓' : r.override === true ? '✓' : '?') : '✗');

/**
 * Tableau Catégorie × Joueur. Touchez une case pour voir le détail / arbitrer.
 * @param {{players:{id,name}[], categories:string[], results:Record<string,any[]>, contests?:Record<string,any>, onCell:(pid,i)=>void}} p
 */
export function CorrectionTable({ players, categories, results, contests = {}, onCell }) {
  return (
    <div className="ctable-wrap">
      <table className="ctable">
        <thead>
          <tr><th>Catégorie</th>{players.map((p) => <th key={p.id}>{p.name}</th>)}</tr>
        </thead>
        <tbody>
          {categories.map((id, i) => (
            <tr key={id}>
              <th>{CATEGORY_BY_ID[id].icon} {CATEGORY_BY_ID[id].name}</th>
              {players.map((p) => {
                const r = results[p.id]?.[i];
                if (!r) return <td key={p.id} />;
                const vote = contests[`${p.id}:${i}`];
                return (
                  <td key={p.id} className={cellClass(r)} onClick={() => onCell(p.id, i)}>
                    <span className="c-ic">{cellIcon(r)}</span>{r.answer || <i>vide</i>}
                    {vote?.open && <span className="c-vote">vote</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="c-total">
            <th>Score du tour</th>
            {players.map((p) => <td key={p.id}><b>{(results[p.id] || []).filter(isAccepted).length}</b> / 10</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend small">
      <span><i className="ok" /> reconnue</span>
      <span><i className="maybe" /> acceptée, contestable</span>
      <span><i className="ko" /> refusée</span>
      <span><i className="empty" /> sans réponse</span>
    </div>
  );
}

/** Fenêtre de détail d'une réponse. `actions` contient les boutons d'arbitrage selon le mode. */
export function CellDialog({ player, category, result, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">{player.name} · {category.icon} {category.name}</div>
        <h3 className="title" style={{ fontSize: 32 }}>{result.answer || '—'}</h3>
        <div className={`pill ${cellClass(result)}`}>{isAccepted(result) ? 'Point accordé' : 'Pas de point'}</div>
        <p className="mute small">{result.override === true ? 'Validée par arbitrage.' : result.override === false ? 'Refusée par arbitrage.' : result.reason}</p>
        {children}
        <button className="btn ghost" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

/* ---------- Classements ---------- */

export function RoundRanking({ players, roundPoints, scores, round, letter, children }) {
  const rows = rankPlayers(players.map((p) => ({ id: p.id, name: p.name, score: scores[p.id] || 0, delta: roundPoints[p.id] || 0 })));
  return (
    <div className="stack screen">
      <div className="center">
        <div className="eyebrow">Tour {round} / {TOTAL_ROUNDS} · lettre {letter}</div>
        <h2 className="title">Classement du tour</h2>
      </div>
      <Ranking rows={rows} max={TOTAL_ROUNDS * CATEGORIES_PER_ROUND} />
      {children}
    </div>
  );
}

export function FinalResults({ players, scores, history, children }) {
  const rows = rankPlayers(players.map((p) => ({ id: p.id, name: p.name, score: scores[p.id] || 0 })));
  const winners = rows.filter((r) => r.rank === 1);
  return (
    <div className="stack screen">
      <div className="center">
        <div className="eyebrow">Résultats après {TOTAL_ROUNDS} tours</div>
        <div style={{ fontSize: 64, lineHeight: 1.1, margin: '8px 0' }}>🏆</div>
        <h2 className="title">{winners.length > 1 ? 'Égalité au sommet !' : `${winners[0]?.name} gagne !`}</h2>
        {winners.length > 1 && <p className="mute">{winners.map((w) => w.name).join(' et ')} — ex æquo</p>}
      </div>
      <Ranking rows={rows} max={TOTAL_ROUNDS * CATEGORIES_PER_ROUND} />
      <div className="ctable-wrap">
        <table className="ctable">
          <thead><tr><th>Tour</th>{players.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.round}><th>{h.round}. Lettre {h.letter}</th>{players.map((p) => <td key={p.id}>{h.points[p.id] ?? 0}</td>)}</tr>
            ))}
            <tr className="c-total"><th>Total</th>{players.map((p) => <td key={p.id}><b>{scores[p.id] || 0}</b> / 50</td>)}</tr>
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}

export { initial };
