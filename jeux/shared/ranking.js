/**
 * Classement avec ex æquo (classement « sportif » : 1, 1, 3…).
 * @param {{id:string,name:string,score:number}[]} entries
 * @returns {{id:string,name:string,score:number,rank:number,tied:boolean}[]}
 */
export function rankPlayers(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return sorted.map((e, i) => {
    const rank = sorted.findIndex((x) => x.score === e.score) + 1;
    const tied = sorted.filter((x) => x.score === e.score).length > 1;
    return { ...e, rank, tied };
  });
}

export const rankLabel = (r) => (r.rank === 1 ? '1er' : `${r.rank}e`) + (r.tied ? ' ex æquo' : '');
