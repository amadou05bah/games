/**
 * ON JOUE ? — une seule appli, trois jeux :
 *  - Entre Nous      (un seul téléphone)
 *  - POLICE          (un seul téléphone ou en ligne)
 *  - Défie ta lettre (un seul téléphone ou en ligne)
 * Un lien d'invitation (?game=police|lettre&code=XXXXXX) ouvre directement le bon jeu.
 */
import { useEffect, useState } from 'react';
import PoliceApp from './games/police/PoliceApp.jsx';
import LettreApp from './games/lettre/LettreApp.jsx';
import EntreNous from './games/entrenous/EntreNous.jsx';
import { makeSession } from './lib/socket.js';

const GAMES = [
  { id: 'entrenous', name: 'Entre Nous', tag: 'Secrets, fils invisibles et histoire commune', modes: '2–12 joueurs · un téléphone', cls: 'g-entre', icon: '✦' },
  { id: 'police', name: 'POLICE', tag: 'Le jeu traditionnel guinéen 🇬🇳', modes: '3–30 joueurs · un téléphone ou en ligne', cls: 'g-police', icon: '🚨' },
  { id: 'lettre', name: 'Défie ta lettre', tag: 'Une lettre, 10 catégories, un chrono', modes: '2–20 joueurs · un téléphone ou en ligne', cls: 'g-lettre', icon: 'B' },
];

export default function App() {
  const [game, setGame] = useState(() => {
    const g = new URLSearchParams(location.search).get('game');
    return GAMES.some((x) => x.id === g) ? g : null;
  });
  useEffect(() => { window.scrollTo(0, 0); }, [game]);
  const exit = () => setGame(null);

  if (game === 'entrenous') return <EntreNous onExit={exit} />;
  return (
    <div className={`app ${game ? `theme-${game}` : ''}`}>
      {game === 'police' && <PoliceApp onExit={exit} startOnline={!!makeSession('police').get()} />}
      {game === 'lettre' && <LettreApp onExit={exit} startOnline={!!makeSession('lettre').get()} />}
      {!game && <Hub onPick={setGame} />}
    </div>
  );
}

function Hub({ onPick }) {
  const live = { police: !!makeSession('police').get(), lettre: !!makeSession('lettre').get() };
  return (
    <div className="hub screen">
      <div className="center">
        <h1 className="hub-logo">ON JOUE&nbsp;?</h1>
        <p className="mute">Trois jeux pour vos soirées, sur un seul téléphone ou chacun le sien.</p>
      </div>
      <div className="stack" style={{ marginTop: 26 }}>
        {GAMES.map((g, i) => (
          <button key={g.id} className={`game-card ${g.cls}`} style={{ animationDelay: `${i * 0.08}s` }} onClick={() => onPick(g.id)}>
            <span className="g-icon">{g.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="g-name">{g.name}</span>
              <span className="g-tag">{g.tag}</span>
              <span className="g-modes">{g.modes}</span>
            </span>
            {live[g.id] && <span className="tag ok">Salle en cours</span>}
            <span className="g-go">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
