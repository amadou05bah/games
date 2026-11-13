/** POLICE — composants d'écran : liste des joueurs, fin de manche, partie, points, score final. */
import { useState } from 'react';
import RoleCard from './RoleCard.jsx';
import { initial, Ranking, Seg } from '../../components/ui.jsx';
import { rankPlayers } from '../../../../shared/ranking.js';
import { ROUND_CHOICES, roundsLabel } from '../../../../shared/police/roles.js';

export function PlayerList({ players, hostId, meId, showSeen, scores, onKick }) {
  return (
    <div className="players">
      {players.map((p) => (
        <div className="player" key={p.id}>
          <span className="avatar">{initial(p.name)}</span>
          <span style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>
            {p.name} {p.id === meId && <span className="mute small">(toi)</span>}
          </span>
          {p.id === hostId && <span className="tag host">Hôte</span>}
          {showSeen && (p.seenRole ? <span className="tag ok">Rôle vu ✓</span> : <span className="tag">Pas encore vu</span>)}
          {scores && <span className="tag">{scores[p.id] ?? 0} pt{(scores[p.id] ?? 0) > 1 ? 's' : ''}</span>}
          {p.connected !== undefined && <span className={`dot ${p.connected ? '' : 'off'}`} title={p.connected ? 'Connecté' : 'Déconnecté'} />}
          {onKick && p.id !== hostId && <button className="tag" onClick={() => onKick(p)} aria-label={`Retirer ${p.name}`}>Retirer</button>}
        </div>
      ))}
    </div>
  );
}

/** Nombre de manches : défini ou illimité. */
export function RoundsPicker({ value, onChange, disabled }) {
  return (
    <div>
      <span className="label">Nombre de manches</span>
      <Seg options={ROUND_CHOICES.map((n) => ({ value: n, label: n == null ? '∞ Illimité' : String(n) }))} value={value} onChange={onChange} disabled={disabled} />
      <p className="small mute" style={{ marginTop: 6 }}>
        {value == null ? 'On joue jusqu’à ce que l’hôte arrête la partie.' : `${roundsLabel(value)}, puis score final.`}
      </p>
    </div>
  );
}

/** Fin de manche : la désignation du policier est nécessaire pour compter les points. */
export function EndGameModal({ players, onCancel, onConfirm }) {
  const [accused, setAccused] = useState(null);
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h3 className="title">Fin de la manche</h3>
        <p className="mute small">Qui le policier a-t-il désigné comme voleur ?</p>
        <div className="players">
          {players.map((p) => (
            <button key={p.id} className={`opt ${accused === p.id ? 'sel' : ''}`} onClick={() => setAccused(p.id)}>
              <span className="avatar">{initial(p.name)}</span>{p.name}
            </button>
          ))}
        </div>
        <button className="btn red" disabled={!accused} onClick={() => onConfirm(accused)}>Révéler les rôles</button>
        <button className="btn ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

/** Écran de manche minimaliste : aucune mécanique imposée. */
export function GameBoard({ gameName, round, maxRounds, players, hostId, meId, isHost, showSeen, scores, myRole, onEnd, onPeek, children }) {
  const [showRole, setShowRole] = useState(false);
  return (
    <div className="stack screen">
      <div className="row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{gameName}</div>
          <h2 className="title">Manche en cours</h2>
        </div>
        <span className="pill live">Manche {round}{maxRounds ? ` / ${maxRounds}` : ''}</span>
      </div>
      <div className="card small mute">
        Tous les rôles sont distribués. Jouez selon vos habitudes : le policier cherche le voleur.
        {isHost ? ' À la fin, indiquez qui il a désigné pour révéler les rôles et compter les points.' : ' L’hôte révélera les rôles à la fin.'}
      </div>
      {myRole !== undefined && (
        <div className="card center stack">
          <RoleCard role={myRole} revealed={showRole} hint="Touche pour voir ton rôle" onClick={() => setShowRole((v) => !v)} />
          <button className="btn ghost" onClick={() => setShowRole((v) => !v)}>{showRole ? 'Cacher mon rôle' : 'Voir mon rôle'}</button>
        </div>
      )}
      {onPeek && <button className="btn ghost" onClick={onPeek}>Revoir mon rôle</button>}
      <div>
        <span className="label">Participants ({players.length})</span>
        <PlayerList players={players} hostId={hostId} meId={meId} showSeen={showSeen} scores={scores} />
      </div>
      {children}
      {isHost ? <button className="btn red" onClick={onEnd}>Terminer la manche</button> : <p className="center mute small">En attente de l’hôte pour la révélation…</p>}
    </div>
  );
}

/** Points de la manche + classement cumulé. */
export function RoundScores({ players, points, scores }) {
  const rows = rankPlayers(players.map((p) => ({ id: p.id, name: p.name, score: scores[p.id] || 0, delta: points[p.id] })));
  return (
    <div>
      <span className="label">Points de la manche et total</span>
      <Ranking rows={rows} />
    </div>
  );
}

/** Score final. */
export function FinalScore({ gameName, players, scores, rounds, children }) {
  const rows = rankPlayers(players.map((p) => ({ id: p.id, name: p.name, score: scores[p.id] || 0 })));
  const winners = rows.filter((r) => r.rank === 1);
  return (
    <div className="stack screen">
      <div className="center">
        <div className="eyebrow">{gameName} · {rounds} manche{rounds > 1 ? 's' : ''}</div>
        <div style={{ fontSize: 64, lineHeight: 1.1, margin: '10px 0' }}>🏆</div>
        <h2 className="title">{winners.length > 1 ? 'Égalité !' : `${winners[0]?.name} gagne !`}</h2>
        {winners.length > 1 && <p className="mute">{winners.map((w) => w.name).join(' et ')} — ex æquo</p>}
      </div>
      <Ranking rows={rows} />
      {children}
    </div>
  );
}
