/**
 * Carte de rôle avec illustration distincte par type, et retournement animé.
 * Confidentialité : le recto (nom du rôle) n'est rendu dans le DOM que lorsque la carte est retournée.
 */
export const ROLE_COLORS = {
  policier: '#3a86ff',
  gendarme: '#8fb8ff',
  voleur: '#e63946',
  autre: '#e9edf5',
};

export function RoleArt({ type, className = 'art' }) {
  const c = ROLE_COLORS[type] || ROLE_COLORS.autre;
  const dark = '#0b1226';
  switch (type) {
    case 'policier': // casquette de policier avec insigne étoilé
      return (
        <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill={c} opacity=".12" />
          <path d="M20 60 Q60 18 100 60 L95 68 H25 Z" fill={c} />
          <rect x="24" y="64" width="72" height="11" rx="3" fill={dark} stroke={c} strokeWidth="2" />
          <path d="M28 75 Q60 96 92 75 Z" fill={dark} stroke={c} strokeWidth="2" />
          <polygon points="60,36 62.9,43.4 70.9,43.6 64.7,48.6 66.9,56.3 60,51.8 53.1,56.3 55.3,48.6 49.1,43.6 57.1,43.4" fill="#fff" />
        </svg>
      );
    case 'gendarme': // képi
      return (
        <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill={c} opacity=".12" />
          <path d="M37 30 H83 L88 72 H32 Z" fill={c} />
          <rect x="33" y="60" width="54" height="6" fill="#fff" />
          <rect x="34" y="52" width="52" height="3" fill="#fff" opacity=".7" />
          <circle cx="60" cy="42" r="6" fill="#fff" />
          <path d="M26 72 H94 Q82 90 60 90 Q38 90 26 72 Z" fill={dark} stroke={c} strokeWidth="2" />
        </svg>
      );
    case 'voleur': // masque de voleur
      return (
        <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill={c} opacity=".12" />
          <path d="M12 54 Q60 30 108 54 Q106 80 80 82 Q66 82 60 71 Q54 82 40 82 Q14 80 12 54 Z" fill={c} />
          <ellipse cx="39" cy="60" rx="11" ry="7.5" fill={dark} />
          <ellipse cx="81" cy="60" rx="11" ry="7.5" fill={dark} />
          <path d="M106 56 Q118 64 112 80" stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M106 56 Q122 58 120 70" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      );
    default: // rôle personnalisé : silhouette
      return (
        <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill={c} opacity=".1" />
          <circle cx="60" cy="44" r="17" fill={c} />
          <path d="M28 98 Q30 66 60 66 Q90 66 92 98 Z" fill={c} />
        </svg>
      );
  }
}

export function Shield({ className = 'shield' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="shg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a86ff" />
          <stop offset="1" stopColor="#e63946" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 20 V48 Q88 78 50 94 Q12 78 12 48 V20 Z" fill="#0d1530" stroke="url(#shg)" strokeWidth="4" />
      <polygon points="50,30 55.9,42.6 69.5,43.8 59.2,52.8 62.4,66.2 50,59 37.6,66.2 40.8,52.8 30.5,43.8 44.1,42.6" fill="#fff" />
    </svg>
  );
}

/**
 * @param {{role?:{name:string,type:string}, revealed:boolean, small?:boolean, who?:string,
 *          hint?:string, highlight?:boolean, onClick?:()=>void}} props
 */
export default function RoleCard({ role, revealed, small, who, hint, highlight, onClick }) {
  const cls = ['rc', revealed && 'on', small && 'sm', highlight && role && `hl-${role.type}`].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="rc-in">
        <div className="rc-face rc-back">
          <Shield className={small ? 'art' : 'shield'} />
          <div className="brand">POLICE</div>
          {who && <div className="rc-who">{who}</div>}
          {hint && <div className="small mute">{hint}</div>}
        </div>
        <div className="rc-face rc-front" style={{ '--rc': ROLE_COLORS[role?.type] || ROLE_COLORS.autre }}>
          {revealed && role && (
            <>
              <RoleArt type={role.type} />
              <div className="rc-name">{role.name}</div>
              {who && <div className="rc-who">{who}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
