/**
 * DÉFIE TA LETTRE — moteur de règles (partagé client local / serveur en ligne).
 *
 * Règles fixes du jeu :
 *  - une partie = exactement 5 tours ; un tour = une lettre + exactement 10 catégories ;
 *  - 1 point par bonne réponse → 10 points max par tour, 50 par partie ;
 *  - classement ex æquo en cas d'égalité.
 *
 * Validation d'une réponse (statuts) :
 *  - empty      : pas de réponse (0 pt)
 *  - invalid    : ne commence pas par la lettre, trop courte/vague, ou déjà utilisée par le même joueur (0 pt)
 *  - valid      : reconnue dans la liste de la catégorie (1 pt)
 *  - plausible  : commence par la bonne lettre mais inconnue de la liste → ACCEPTÉE (1 pt), contestable
 * L'arbitrage (vote ou décision manuelle) peut forcer accepté/refusé via `override`.
 */
import { CATEGORY_BY_ID } from './categories.js';

export const TOTAL_ROUNDS = 5;
export const CATEGORIES_PER_ROUND = 10;
export const TIMER_CHOICES = [60, 90, 120, 0]; // 0 = temps illimité
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const HARD_LETTERS = 'KQWXYZ';

/** Minuscules, sans accents, sans ponctuation, espaces nettoyés. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARTICLES = /^(le |la |les |l'|un |une |des |du |de la |de l'|the )/;
/** Forme comparable : normalisée, sans article initial (« La Belgique » → « belgique »). */
export function core(s) {
  return normalize(s).replace(ARTICLES, '').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Index des réponses connues, construit une fois. */
const KNOWN = {};
for (const [id, cat] of Object.entries(CATEGORY_BY_ID)) {
  KNOWN[id] = new Set((cat.known || []).map(core));
}
export const isKnown = (catId, answer) => KNOWN[catId]?.has(core(answer)) ?? false;

/** Tire une lettre jamais tirée dans la partie. */
export function drawLetter(used, allowHard, randomInt) {
  const pool = [...ALPHABET].filter((l) => !used.includes(l) && (allowHard || !HARD_LETTERS.includes(l)));
  return pool[randomInt(pool.length)];
}

/**
 * Correction automatique d'une feuille de 10 réponses.
 * @returns {{answer:string,status:string,reason:string}[]}
 */
export function checkSheet(answers, letter, categoryIds) {
  const L = letter.toLowerCase();
  const used = new Set();
  return categoryIds.map((catId, i) => {
    const answer = String(answers?.[i] ?? '').trim().slice(0, 60);
    const c = core(answer);
    const cat = CATEGORY_BY_ID[catId];
    if (!c) return { answer: '', status: 'empty', reason: 'Sans réponse' };
    if (!(c.startsWith(L) || normalize(answer).startsWith(L))) return { answer, status: 'invalid', reason: `Ne commence pas par ${letter}` };
    if (c.replace(/ /g, '').length < 2) return { answer, status: 'invalid', reason: 'Réponse trop courte' };
    if (cat && core(cat.name) === c) return { answer, status: 'invalid', reason: 'Réponse trop vague' };
    if (used.has(c)) return { answer, status: 'invalid', reason: 'Déjà utilisée dans une autre catégorie' };
    used.add(c);
    if (isKnown(catId, answer)) return { answer, status: 'valid', reason: 'Réponse reconnue' };
    return { answer, status: 'plausible', reason: 'Non reconnue automatiquement — acceptée sauf contestation' };
  });
}

/** Une réponse rapporte-t-elle le point ? (l'arbitrage a le dernier mot) */
export function isAccepted(res) {
  if (res.status === 'empty') return false;
  if (typeof res.override === 'boolean') return res.override;
  return res.status === 'valid' || res.status === 'plausible';
}

export const sheetScore = (results) => results.filter(isAccepted).length;

/**
 * Résultat d'un vote de contestation : majorité des votants. Égalité → la décision automatique est conservée.
 * @param {Record<string, boolean>} votes  votant → accepter ?
 * @returns {boolean|undefined} override à appliquer (undefined = inchangé)
 */
export function voteOutcome(votes) {
  const v = Object.values(votes);
  const yes = v.filter(Boolean).length;
  const no = v.length - yes;
  if (yes === no) return undefined;
  return yes > no;
}
