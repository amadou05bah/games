/**
 * Configuration des rôles : ajouter / supprimer / renommer / compter.
 * Le total est comparé en permanence au nombre de participants.
 */
import { validateConfig, MAX_ROLE_NAME } from '../../../../shared/police/roles.js';
import { RoleArt } from './RoleCard.jsx';

const TYPE_LABEL = { policier: 'Policier', gendarme: 'Gendarme', voleur: 'Voleur', autre: 'Rôle libre' };

export default function RoleConfig({ roles, playerCount, onChange, onReset, readOnly }) {
  const check = validateConfig(roles, playerCount);
  const update = (i, patch) => onChange(roles.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(roles.filter((_, j) => j !== i));
  const add = () => onChange([...roles, { id: `custom-${Date.now()}`, name: '', type: 'autre', count: 1 }]);
  const locked = (r) => r.type === 'policier' || r.type === 'voleur';

  return (
    <div className="stack">
      {roles.map((r, i) => (
        <div className="role-row" key={r.id}>
          <RoleArt type={r.type} className="ico" />
          <div className="grow" style={{ flex: 1, minWidth: 0 }}>
            {readOnly ? (
              <b>{r.name || '—'}</b>
            ) : (
              <input
                value={r.name}
                maxLength={MAX_ROLE_NAME}
                placeholder="Nom du rôle"
                aria-label={`Nom du rôle ${TYPE_LABEL[r.type]}`}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            )}
            <div className="small mute">{TYPE_LABEL[r.type]}</div>
          </div>
          {readOnly ? (
            <b style={{ fontSize: 20, minWidth: 28, textAlign: 'center' }}>×{r.count}</b>
          ) : (
            <div className="counter">
              <button disabled={r.count <= 0} onClick={() => update(i, { count: r.count - 1 })} aria-label="Moins">−</button>
              <b>{r.count}</b>
              <button onClick={() => update(i, { count: r.count + 1 })} aria-label="Plus">+</button>
            </div>
          )}
          {!readOnly && !locked(r) && (
            <button className="x" onClick={() => remove(i)} aria-label="Supprimer ce rôle">✕</button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="row">
          <button className="btn ghost grow" onClick={add}>+ Ajouter un rôle</button>
          {onReset && <button className="btn ghost small" onClick={onReset}>Réinitialiser</button>}
        </div>
      )}

      <div className={`total ${check.ok ? 'ok' : 'bad'}`}>
        <span>Total des rôles</span>
        <span>{check.total} / {playerCount} {check.ok ? '✓' : ''}</span>
      </div>
      {!check.ok && (
        <div className="error">
          {check.errors.map((e) => <div key={e}>• {e}</div>)}
        </div>
      )}
    </div>
  );
}
