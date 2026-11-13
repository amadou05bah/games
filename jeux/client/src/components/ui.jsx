/** Petits composants d'interface communs à tous les jeux. */
import { rankLabel } from '../../../shared/ranking.js';

export function TopBar({ onBack, children, right }) {
  return (
    <div className="topbar">
      {onBack && <button className="back" onClick={onBack} aria-label="Retour">‹</button>}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {right}
    </div>
  );
}

export const initial = (name) => (name || '?').trim()[0]?.toUpperCase() ?? '?';

export function Counter({ value, min, max, onChange, label }) {
  return (
    <div className="counter" aria-label={label}>
      <button disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Moins">−</button>
      <b>{value}</b>
      <button disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Plus">+</button>
    </div>
  );
}

/** Choix segmenté. options : [{ value, label }] */
export function Seg({ options, value, onChange, disabled }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Tableau de classement (avec ex æquo). rows : sortie de rankPlayers + champ optionnel `delta`. */
export function Ranking({ rows, unit = 'pts', max }) {
  return (
    <div className="card">
      {rows.map((r) => (
        <div className={`rank-row ${r.rank === 1 ? 'first' : ''}`} key={r.id}>
          <span className="rank-pos">{r.rank === 1 ? '🏆' : r.rank}</span>
          <span className="avatar">{initial(r.name)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{r.name}</b>
            <div className="small mute">{rankLabel(r)}</div>
          </span>
          {r.delta !== undefined && <span className={`delta ${r.delta === 0 ? 'zero' : ''}`}>+{r.delta}</span>}
          <span className="score">{r.score}<small>{max ? ` / ${max}` : ` ${unit}`}</small></span>
        </div>
      ))}
    </div>
  );
}

/** Écran affiché quand le serveur en ligne est injoignable. */
export function ServerDown({ onRetry, onBack }) {
  return (
    <div className="stack screen">
      <TopBar onBack={onBack}><div className="eyebrow">En ligne</div></TopBar>
      <div className="privacy" style={{ minHeight: '60vh' }}>
        <div style={{ fontSize: 56 }}>📡</div>
        <h2 className="title">Serveur injoignable</h2>
        <p className="mute">Le mode en ligne a besoin du serveur de l’appli (Node.js + Socket.IO). Lancez-le puis réessayez. Le mode « un seul téléphone » fonctionne sans connexion.</p>
        <button className="btn" onClick={onRetry}>Réessayer</button>
        <button className="btn ghost" onClick={onBack}>Retour</button>
      </div>
    </div>
  );
}

/** Choix « un seul téléphone » / « en ligne » commun aux jeux. */
export function ModeChoice({ title, onBack, onPick, accent = 'rgba(58,134,255,.2)' }) {
  return (
    <div className="stack screen">
      <TopBar onBack={onBack}><div className="eyebrow">{title}</div></TopBar>
      <h2 className="title">Comment jouez-vous ?</h2>
      <button className="choice" onClick={() => onPick('local')}>
        <span className="ic" style={{ background: accent }}>📱</span>
        <span><h3 className="title">Un seul téléphone</h3><span className="mute small">On se passe le téléphone, chacun son tour.</span></span>
      </button>
      <button className="choice" onClick={() => onPick('online')}>
        <span className="ic" style={{ background: 'rgba(230,57,70,.2)' }}>🌐</span>
        <span><h3 className="title">En ligne</h3><span className="mute small">Chacun sur son téléphone, avec un code de salle.</span></span>
      </button>
    </div>
  );
}

/** Formulaires « Créer une salle » et « Rejoindre ». */
export function CreateRoomForm({ title, defaultGameName, busy, error, onBack, onSubmit }) {
  return (
    <form className="stack screen" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ hostName: f.get('hostName'), gameName: f.get('gameName') }); }}>
      <TopBar onBack={onBack}><div className="eyebrow">{title} · en ligne</div></TopBar>
      <h2 className="title">Créer une salle</h2>
      <div><label className="label" htmlFor="hn">Ton prénom ou pseudo</label><input id="hn" name="hostName" className="input" maxLength={20} required autoFocus /></div>
      <div><label className="label" htmlFor="gn">Nom de la partie</label><input id="gn" name="gameName" className="input" maxLength={40} defaultValue={defaultGameName} /></div>
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>Créer la salle</button>
    </form>
  );
}

export function JoinRoomForm({ title, initialCode, busy, error, onBack, onSubmit }) {
  return (
    <form className="stack screen" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ code: String(f.get('code')).trim().toUpperCase(), name: f.get('name') }); }}>
      <TopBar onBack={onBack}><div className="eyebrow">{title} · en ligne</div></TopBar>
      <h2 className="title">Rejoindre une partie</h2>
      <div><label className="label" htmlFor="cd">Code de la salle</label><input id="cd" name="code" className="input code" maxLength={6} minLength={6} required defaultValue={initialCode} autoComplete="off" onInput={(e) => { e.target.value = e.target.value.toUpperCase(); }} /></div>
      <div><label className="label" htmlFor="nm">Ton prénom ou pseudo</label><input id="nm" name="name" className="input" maxLength={20} required /></div>
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>Rejoindre</button>
    </form>
  );
}

export function OnlineMenu({ title, notice, connecting, onBack, onCreate, onJoin }) {
  return (
    <div className="stack screen">
      <TopBar onBack={onBack}><div className="eyebrow">{title} · en ligne {connecting && '· connexion…'}</div></TopBar>
      <h2 className="title">Jouer en ligne</h2>
      <p className="mute">Chaque joueur utilise son propre téléphone.</p>
      {notice && <div className="error">{notice}</div>}
      <button className="choice" onClick={onCreate}>
        <span className="ic" style={{ background: 'rgba(58,134,255,.2)' }}>🛡️</span>
        <span><h3 className="title">Créer une salle</h3><span className="mute small">Tu seras l’hôte et tu régleras la partie.</span></span>
      </button>
      <button className="choice" onClick={onJoin}>
        <span className="ic" style={{ background: 'rgba(230,57,70,.2)' }}>🔑</span>
        <span><h3 className="title">Rejoindre avec un code</h3><span className="mute small">Entre le code donné par l’hôte.</span></span>
      </button>
    </div>
  );
}

/** Affichage du code de salle avec copie du lien d'invitation. */
export function RoomCode({ code, link }) {
  const copy = async (e) => {
    const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(link); btn.textContent = 'Lien copié ✓'; setTimeout(() => { btn.textContent = 'Copier le lien d’invitation'; }, 2000); } catch { /* refusé */ }
  };
  return (
    <div className="card center">
      <div className="eyebrow">Code de la salle</div>
      <div className="room-code">{code}</div>
      <button className="btn ghost small" onClick={copy}>Copier le lien d’invitation</button>
    </div>
  );
}
