/**
 * Logique des rôles — partagée par le client (mode local) et le serveur (mode en ligne).
 *
 * Aucune règle de jeu n'est ajoutée ici : ce module ne fait que
 *  1. décrire une configuration de rôles (nom, type, nombre),
 *  2. vérifier qu'elle correspond au nombre de participants,
 *  3. distribuer les rôles au hasard (un seul rôle par joueur).
 *
 * Le « type » sert uniquement à la révélation finale (identifier le policier et le voleur),
 * le nom affiché reste librement modifiable pour respecter les variantes locales.
 */

export const ROLE_TYPES = {
  POLICIER: 'policier',
  GENDARME: 'gendarme',
  VOLEUR: 'voleur',
  AUTRE: 'autre',
};

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 30;
export const MAX_ROLE_NAME = 24;

/** Configuration par défaut : 1 policier, 1 gendarme, 1 voleur, le reste en rôle libre (renommable). */
export function defaultRoles(playerCount = MIN_PLAYERS) {
  const n = Math.max(0, playerCount);
  return [
    { id: 'policier', name: 'Policier', type: ROLE_TYPES.POLICIER, count: 1 },
    { id: 'gendarme', name: 'Gendarme', type: ROLE_TYPES.GENDARME, count: n >= 3 ? 1 : 0 },
    { id: 'voleur', name: 'Voleur', type: ROLE_TYPES.VOLEUR, count: 1 },
    { id: 'citoyen', name: 'Citoyen', type: ROLE_TYPES.AUTRE, count: Math.max(0, n - 3) },
  ];
}

/** Nettoie une configuration reçue (côté serveur : on ne fait jamais confiance au client). */
export function sanitizeRoles(input) {
  if (!Array.isArray(input)) throw new Error('Configuration des rôles invalide.');
  if (input.length > 20) throw new Error('Trop de rôles différents (20 maximum).');
  const allowed = Object.values(ROLE_TYPES);
  return input.map((r, i) => ({
    id: String(r?.id ?? `role-${i}`).slice(0, 40),
    name: String(r?.name ?? '').trim().slice(0, MAX_ROLE_NAME),
    type: allowed.includes(r?.type) ? r.type : ROLE_TYPES.AUTRE,
    count: Math.max(0, Math.min(MAX_PLAYERS, Math.floor(Number(r?.count) || 0))),
  }));
}

export function totalRoles(roles) {
  return roles.reduce((s, r) => s + (r.count || 0), 0);
}

/**
 * Vérifie qu'une partie peut être lancée.
 * @returns {{ ok: boolean, total: number, errors: string[] }}
 */
export function validateConfig(roles, playerCount) {
  const errors = [];
  const total = totalRoles(roles);
  if (playerCount < MIN_PLAYERS) errors.push(`Il faut au moins ${MIN_PLAYERS} participants.`);
  if (playerCount > MAX_PLAYERS) errors.push(`${MAX_PLAYERS} participants maximum.`);
  if (total !== playerCount) {
    errors.push(
      total < playerCount
        ? `Il manque ${playerCount - total} rôle(s) : ${total} rôle(s) pour ${playerCount} participant(s).`
        : `${total - playerCount} rôle(s) en trop : ${total} rôle(s) pour ${playerCount} participant(s).`
    );
  }
  const count = (t) => roles.filter((r) => r.type === t).reduce((s, r) => s + r.count, 0);
  if (count(ROLE_TYPES.POLICIER) < 1) errors.push('Il faut au moins un policier.');
  if (count(ROLE_TYPES.VOLEUR) < 1) errors.push('Il faut au moins un voleur.');
  const named = roles.filter((r) => r.count > 0);
  if (named.some((r) => !r.name)) errors.push('Chaque rôle utilisé doit avoir un nom.');
  const names = named.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) errors.push('Deux rôles portent le même nom.');
  return { ok: errors.length === 0, total, errors };
}

/**
 * Distribue un rôle par joueur, au hasard (mélange de Fisher-Yates).
 * @param {Array<{id:string}>} players
 * @param {Array} roles  configuration validée
 * @param {(max:number)=>number} randomInt  entier aléatoire dans [0, max) — cryptographique de préférence
 * @returns {Map<string, {name:string,type:string}>} playerId -> rôle
 */
export function assignRoles(players, roles, randomInt) {
  const deck = [];
  for (const r of roles) for (let i = 0; i < r.count; i++) deck.push({ name: r.name, type: r.type });
  if (deck.length !== players.length) throw new Error('Le nombre de rôles ne correspond pas au nombre de participants.');
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const out = new Map();
  players.forEach((p, i) => out.set(p.id, deck[i]));
  return out;
}

/** Résultat de la révélation : le policier a-t-il désigné un voleur ? (null si non renseigné) */
export function policeResult(assignments, accusedId) {
  if (!accusedId || !assignments.has(accusedId)) return null;
  return assignments.get(accusedId).type === ROLE_TYPES.VOLEUR;
}

/* ------------------------------------------------------------------
 * COMPTAGE DES POINTS (règle validée par le joueur)
 *  - Chaque joueur marque 1 point par manche…
 *  - … sauf le voleur démasqué : 0 point ;
 *  - … et le policier qui se trompe : 0 point.
 * ------------------------------------------------------------------ */

/**
 * @param {{id:string}[]} players
 * @param {Map<string,{type:string}>} assignments
 * @param {string} accusedId  joueur désigné par le policier
 * @returns {Record<string, number>} points de la manche par joueur
 */
export function roundPoints(players, assignments, accusedId) {
  const correct = policeResult(assignments, accusedId);
  const points = {};
  for (const p of players) {
    const role = assignments.get(p.id);
    let pts = 1;
    if (correct === true && p.id === accusedId) pts = 0; // voleur démasqué
    if (correct === false && role?.type === ROLE_TYPES.POLICIER) pts = 0; // policier trompé
    points[p.id] = pts;
  }
  return points;
}

/** Choix du nombre de manches : null = illimité (jusqu'à ce qu'on arrête). */
export const ROUND_CHOICES = [null, 3, 5, 10, 15];
export const roundsLabel = (n) => (n == null ? 'Illimité' : `${n} manches`);
