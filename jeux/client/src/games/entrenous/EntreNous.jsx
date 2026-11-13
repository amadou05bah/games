/**
 * ENTRE NOUS — jeu autonome (un seul téléphone), intégré tel quel dans un cadre isolé
 * pour que ses styles et sa mémoire locale ne se mélangent pas avec les autres jeux.
 */
import html from './entre-nous.html?raw';

export default function EntreNous({ onExit }) {
  return (
    <div className="embed">
      <div className="embed-bar">
        <button className="back" onClick={onExit} aria-label="Tous les jeux">‹</button>
        <span className="eyebrow">Entre Nous</span>
      </div>
      <iframe title="Entre Nous" srcDoc={html} className="embed-frame" />
    </div>
  );
}
