import { enumeratePlacements } from '../../src/exact.mjs';
export const popcount = mask => { let count = 0; while (mask) { mask &= mask - 1; count++; } return count; };
export function geometryModel({ L, k, boundary = 'periodic' }) {
  const placements = enumeratePlacements(L, k, boundary), M = placements[0].length;
  const nodes = [], ids = new Map();
  const get = (mask, h) => {
    const key = `${mask}:${h}`;
    if (!ids.has(key)) { ids.set(key, nodes.length); nodes.push({ mask, h, n: popcount(mask) / k }); }
    return ids.get(key);
  };
  get(0, 0);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.successors = placements.map((row, a) => {
      const counted = new Map();
      for (const p of row) if (!(p & node.mask)) {
        const target = get(node.mask | p, node.h + Number(a === 0));
        counted.set(target, (counted.get(target) ?? 0) + 1);
      }
      return [...counted].map(([target, multiplicity]) => ({ target, multiplicity }));
    });
    node.legal = node.successors.map(row => row.reduce((total, edge) => total + edge.multiplicity, 0));
    node.jam = node.legal.every(x => x === 0);
  }
  const order = nodes.map((_, i) => i).sort((a, b) => nodes[b].n - nodes[a].n || a - b);
  const Nmax = Math.max(...nodes.filter(x => x.jam).map(x => x.n));
  return { L, k, boundary, M, nodes, order, Nmax, initial: 0 };
}
