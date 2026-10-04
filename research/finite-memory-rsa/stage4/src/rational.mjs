export { Fraction } from '../../src/exact.mjs';
export { rational } from '../../stage3/src/phase-type.mjs';
import { Fraction } from '../../src/exact.mjs';
export const ZERO = new Fraction(), ONE = new Fraction(1n);
export const sum = values => values.reduce((total, x) => total.add(x), ZERO);
export const compare = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export const number = x => Number((x.n * 1000000000000000n) / x.d) / 1e15;
export const json = x => ({ numerator: x.n.toString(), denominator: x.d.toString(), value: number(x) });
export function inverse(matrix) {
  const n = matrix.length, a = matrix.map((row, i) => [...row,
    ...Array.from({ length: n }, (_, j) => i === j ? ONE : ZERO)]);
  for (let k = 0; k < n; k++) {
    const pivot = a.findIndex((row, i) => i >= k && !row[k].zero);
    if (pivot < 0) throw new RangeError('Nonabsorbing failure block');
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const divisor = a[k][k]; for (let j = 0; j < 2 * n; j++) a[k][j] = a[k][j].div(divisor);
    for (let i = 0; i < n; i++) if (i !== k) {
      const weight = a[i][k]; if (!weight.zero) for (let j = 0; j < 2 * n; j++) a[i][j] = a[i][j].sub(weight.mul(a[k][j]));
    }
  }
  return a.map(row => row.slice(n));
}
export const matvec = (matrix, vector) => matrix.map(row => sum(row.map((x, j) => x.mul(vector[j]))));
