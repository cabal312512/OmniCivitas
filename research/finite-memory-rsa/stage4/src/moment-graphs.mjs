import { Polynomial, RationalFunction } from '../../stage3/src/phase-type.mjs';
import { rational, Fraction, ZERO, ONE, json } from './rational.mjs';
const none = () => ({ power: Infinity, coefficient: ZERO });
const unit = () => ({ power: 0, coefficient: ONE });
const plus = (a, b) => a.power < b.power ? a : b.power < a.power ? b :
  { power: a.power, coefficient: a.coefficient.add(b.coefficient) };
const times = (a, b) => !Number.isFinite(a.power) || !Number.isFinite(b.power) ? none() :
  { power: a.power + b.power, coefficient: a.coefficient.mul(b.coefficient) };
const weight = x => {
  const value = RationalFunction.of(x);
  if (value.zero) return none();
  const lead = value.leading(), coefficient = rational(`${lead.constant.numerator}/${lead.constant.denominator}`);
  if (coefficient.n <= 0n || lead.power < 0) throw new RangeError('Probability must have a nonnegative-order positive leading germ');
  return { power: lead.power, coefficient };
};
const factorial = n => { let value = 1n; for (let j = 2; j <= n; j++) value *= BigInt(j); return value; };
const multiply = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((total, x, k) => plus(total, times(x, B[k][j])), none())));
const publicLead = lead => Number.isFinite(lead.power) ? { zero: false, power: lead.power, poleOrder: lead.power === 0 ? 0 : -lead.power,
  constant: json(lead.coefficient) } : { zero: true, power: null, poleOrder: null, constant: json(ZERO) };

/** Leading raw moments from positive rooted forests and layered graph products, no determinants. */
export function graphMomentValuations({ kernel, initial = 0, maxOrder = 6 }) {
  const originalSize = kernel.length;
  if (originalSize < 1 || originalSize > 6 || kernel.some(row => row.length !== originalSize) || maxOrder < 1 || maxOrder > 8) throw new RangeError('Graph enumeration supports <=6 states, <=8 moment orders');
  const original = kernel.map(row => row.map(x => RationalFunction.of(x)));
  const originalRho = Number.isInteger(initial) ? Array.from({ length: originalSize }, (_, i) => RationalFunction.of(Number(i === initial))) : initial.map(x => RationalFunction.of(x));
  if (originalRho.length !== originalSize || (Number.isInteger(initial) && (initial < 0 || initial >= originalSize))) throw new RangeError('Invalid initial state');
  original.flat().forEach(weight); originalRho.forEach(weight);
  weight(RationalFunction.of(1).sub(originalRho.reduce((a, b) => a.add(b), RationalFunction.of(0))));
  const reachable = new Set(originalRho.flatMap((x, i) => x.zero ? [] : [i]));
  let changed = true;
  while (changed) { changed = false; for (const i of [...reachable]) for (let j = 0; j < originalSize; j++) if (!original[i][j].zero && !reachable.has(j)) { reachable.add(j); changed = true; } }
  const states = [...reachable].sort((a, b) => a - b), n = states.length;
  if (!n) return { states, moments: Array.from({ length: maxOrder }, (_, i) => ({ order: i + 1, ...publicLead(none()) })) };
  const F = states.map(i => states.map(j => original[i][j])), rho = states.map(i => weight(originalRho[i]));
  const edges = F.map((row, i) => {
    const leak = RationalFunction.of(1).sub(row.reduce((a, b) => a.add(b), RationalFunction.of(0)));
    const candidates = [...row.flatMap((x, j) => i === j || x.zero ? [] : [{ to:j, weight:weight(x) }]),
      ...(leak.zero ? [] : [{ to:n, weight:weight(leak) }])];
    return candidates;
  });
  let tree = none(), treeCount = 0;
  const forests = Array.from({ length: n }, () => Array.from({ length: n }, none));
  const forestCounts = Array.from({ length: n }, () => Array(n).fill(0));
  const enumerate = (secondRoot, callback) => {
    const nodes = Array.from({ length: n }, (_, i) => i).filter(i => i !== secondRoot), next = Array(n).fill(null);
    const visit = (position, product) => {
      if (position < nodes.length) { const i = nodes[position]; for (const edge of edges[i]) { next[i] = edge.to; visit(position + 1, times(product, edge.weight)); } return; }
      const roots = [];
      for (let i = 0; i < n; i++) {
        let q = i; const seen = new Set();
        while (q !== n && q !== secondRoot) { if (seen.has(q)) return; seen.add(q); q = next[q]; }
        roots.push(q);
      }
      callback(roots, product);
    }; visit(0, unit());
  };
  enumerate(null, (_, product) => { tree = plus(tree, product); treeCount++; });
  if (!Number.isFinite(tree.power)) throw new RangeError('No absorbing sink tree on reachable support');
  for (let j = 0; j < n; j++) enumerate(j, (roots, product) => {
    for (let i = 0; i < n; i++) if (roots[i] === j) { forests[i][j] = plus(forests[i][j], product); forestCounts[i][j]++; }
  });
  const G = forests.map(row => row.map(lead => Number.isFinite(lead.power) ? {
    power:lead.power - tree.power, coefficient:lead.coefficient.div(tree.coefficient) } : none()));
  const H = multiply(F.map(row => row.map(weight)), G);
  const ones = Array.from({ length:n }, unit);
  let row = [rho], factorialLeads = [];
  for (let order = 1; order <= maxOrder; order++) {
    const product = multiply(row, G)[0];
    const value = product.reduce((total, x, j) => plus(total, times(x, ones[j])), none());
    factorialLeads.push(times(value, { power:0, coefficient:new Fraction(factorial(order)) }));
    // rho (G F)^(order-1) G 1; updating rho by G F is equivalent to G(FG)^(order-1).
    row = multiply(row, multiply(G, F.map(r => r.map(weight))));
  }
  const S = Array.from({ length:maxOrder + 1 }, () => Array(maxOrder + 1).fill(0n)); S[0][0] = 1n;
  for (let j = 1; j <= maxOrder; j++) for (let l = 1; l <= j; l++) S[j][l] = S[j - 1][l - 1] + BigInt(l) * S[j - 1][l];
  const moments = [];
  for (let order = 1; order <= maxOrder; order++) {
    let value = none(); const contributions = [];
    for (let l = 1; l <= order; l++) {
      const term = times(factorialLeads[l - 1], { power:0, coefficient:new Fraction(S[order][l]) });
      value = plus(value, term); contributions.push({ factorialOrder:l, stirling:S[order][l].toString(), ...publicLead(term) });
    }
    moments.push({ order, ...publicLead(value), contributions });
  }
  return { states, tree:publicLead(tree), treeCount, forests:forests.map(row => row.map(publicLead)), forestCounts,
    green: G.map(row => row.map(publicLead)), factorialMoments:factorialLeads.map((x, i) => ({ order:i + 1, ...publicLead(x) })), moments,
    determinantCalls:0,
    proof: 'Positive all-minors forests give each Green entry; layered G/F products give factorial-moment germs; positive Stirling sums give raw moments. No repeated determinant algebra.',
    assumptions:'Nonnegative substochastic rational germs for sufficiently small positive epsilon, reachable support pruned, absorbing sink reachable. This computes leading terms, not the full rational moments.' };
}
