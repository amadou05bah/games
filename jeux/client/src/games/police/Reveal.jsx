/**
 * POLICE — révélation avec suspense : les cartes se retournent une à une, policier puis voleur en dernier.
 * Affiche ensuite le résultat de la désignation et les points de la manche.
 */
import { useEffect, useMemo, useState } from 'react';
import RoleCard from './RoleCard.jsx';
import { RoundScores } from './PoliceUI.jsx';

const ORDER = { autre: 0, gendarme: 1, policier: 2, voleur: 3 };

export default function Reveal({ players, reveal, result, scores, round, children }) {
  const byId = useMemo(() => Object.fromEntries(reveal.map((r) => [r.playerId, r])), [reveal]);
  const ordered = useMemo(() => [...players].sort((a, b) => (ORDER[byId[a.id]?.type] ?? 0) - (ORDER[byId[b.id]?.type] ?? 0)), [players, byId]);
  const [shown, setShown] = useState(0);
  const done = shown >= ordered.length;

  useEffect(() => {
    if (done) return undefined;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 800 : 1000);
    return () => clearTimeout(t);
  }, [shown, done]);

  const nameOf = (id) => players.find((p) => p.id === id)?.name;
  const ofType = (t) => players.filter((p) => byId[p.id]?.type === t).map((p) => p.name);
  const accused = result?.accusedId ? byId[result.accusedId] : null;

  return (
    <div className="stack">
      <div className="center">
        <div className="eyebrow">Fin de la manche {round}</div>
        <h2 className="title">Révélation des rôles</h2>
      </div>
      <div className="reveal-grid">
        {ordered.map((p, i) => <RoleCard key={p.id} small role={byId[p.id]} who={p.name} revealed={i < shown} highlight={done} />)}
      </div>
      {!done && <button className="btn ghost" onClick={() => setShown(ordered.length)}>Tout révéler</button>}
      {done && (
        <div className="stack screen">
          {result?.correct === true && (
            <div className="result win">
              <div className="title">Voleur démasqué !</div>
              <div>Le policier a désigné <b>{nameOf(result.accusedId)}</b> : c’était bien le voleur. Le voleur marque 0.</div>
            </div>
          )}
          {result?.correct === false && (
            <div className="result lose">
              <div className="title">Le policier s’est trompé</div>
              <div>Il a désigné <b>{nameOf(result.accusedId)}</b> ({accused?.name}). Le policier marque 0.</div>
            </div>
          )}
          <div className="card">
            <div className="row"><span style={{ flex: 1 }} className="mute">Policier</span><b style={{ color: 'var(--blue)' }}>{ofType('policier').join(', ')}</b></div>
            <div className="row" style={{ marginTop: 8 }}><span style={{ flex: 1 }} className="mute">Voleur</span><b style={{ color: 'var(--red)' }}>{ofType('voleur').join(', ')}</b></div>
          </div>
          {result?.points && scores && <RoundScores players={players} points={result.points} scores={scores} />}
          {children}
        </div>
      )}
    </div>
  );
}
