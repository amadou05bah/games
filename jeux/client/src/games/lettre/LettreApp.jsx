/** DÉFIE TA LETTRE — entrée du jeu. */
import { useState } from 'react';
import { inviteCode } from '../../lib/socket.js';
import { ModeChoice } from '../../components/ui.jsx';
import LocalLettre from './LocalLettre.jsx';
import OnlineLettre from './OnlineLettre.jsx';

export default function LettreApp({ onExit, startOnline }) {
  const [screen, setScreen] = useState(startOnline || inviteCode() ? 'online' : 'home');
  if (screen === 'local') return <LocalLettre onExit={() => setScreen('mode')} />;
  if (screen === 'online') return <OnlineLettre onExit={() => setScreen('mode')} />;
  if (screen === 'mode') return <ModeChoice title="Défie ta lettre" accent="rgba(255,201,60,.2)" onBack={() => setScreen('home')} onPick={setScreen} />;
  return (
    <div className="home screen">
      <div className="tiles">{['D', 'É', 'F', 'I', 'E'].map((l, i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }}>{l}</span>)}</div>
      <h1 className="logo lettre-logo">TA LETTRE</h1>
      <p className="mute" style={{ maxWidth: 380, margin: '12px auto 26px' }}>
        Une lettre au hasard, 10 catégories, un chrono. Trouve un mot par catégorie avant les autres !
      </p>
      <div className="card small" style={{ textAlign: 'left', marginBottom: 22 }}>
        <b>Exemple avec B :</b> Belgique · Berlin · BMW · Beyoncé · Baleine · Banane · Bordeaux · Basket-ball · Boulanger · Batman
        <div className="mute" style={{ marginTop: 6 }}>5 tours · 1 point par bonne réponse · 50 points maximum</div>
      </div>
      <div className="stack">
        <button className="btn yellow" onClick={() => setScreen('mode')}>Jouer</button>
        <button className="btn ghost" onClick={onExit}>‹ Tous les jeux</button>
      </div>
    </div>
  );
}
