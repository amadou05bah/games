/** POLICE — entrée du jeu : accueil, choix du mode, puis mode local ou en ligne. */
import { useState } from 'react';
import { inviteCode } from '../../lib/socket.js';
import { ModeChoice } from '../../components/ui.jsx';
import LocalPolice from './LocalPolice.jsx';
import OnlinePolice from './OnlinePolice.jsx';

export default function PoliceApp({ onExit, startOnline }) {
  const [screen, setScreen] = useState(startOnline || inviteCode() ? 'online' : 'home');
  if (screen === 'local') return <LocalPolice onExit={() => setScreen('mode')} />;
  if (screen === 'online') return <OnlinePolice onExit={() => setScreen('mode')} />;
  if (screen === 'mode') return <ModeChoice title="POLICE" onBack={() => setScreen('home')} onPick={setScreen} />;
  return (
    <div className="home screen">
      <div className="siren"><i /><i /></div>
      <h1 className="logo">POLICE</h1>
      <div><span className="tape"><span>LE JEU TRADITIONNEL GUINÉEN 🇬🇳</span></span></div>
      <p className="mute" style={{ maxWidth: 360, margin: '0 auto 30px' }}>Les rôles sont distribués en secret. Le policier doit retrouver le voleur.</p>
      <div className="stack">
        <button className="btn red" onClick={() => setScreen('mode')}>Jouer</button>
        <button className="btn ghost" onClick={onExit}>‹ Tous les jeux</button>
      </div>
    </div>
  );
}
