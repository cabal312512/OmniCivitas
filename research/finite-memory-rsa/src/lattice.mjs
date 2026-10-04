/** Dense legal-anchor sets with O(1) deletion and uniform conditional sampling.
 * This is an internal simulator optimization: no counts or coordinates enter
 * the controller. Each accepted rod invalidates only anchors crossing its cells.
 */
export class Lattice {
  constructor(L, k, boundary = 'periodic') {
    if (!Number.isInteger(L) || L < 2 || !Number.isInteger(k) || k < 1 || k > L || !['periodic','open'].includes(boundary)) throw new RangeError('Require L>=2 and 1<=k<=L');
    this.L = L; this.k = k; this.boundary = boundary; this.N = L * L;
    this.M = boundary === 'periodic' ? this.N : L * (L - k + 1);
    this.occupancy = new Uint8Array(this.N);
    this.legal = [new Int32Array(this.N), new Int32Array(this.N)];
    this.index = [new Int32Array(this.N).fill(-1), new Int32Array(this.N).fill(-1)];
    this.counts = [0,0];
    for (let o = 0; o < 2; o++) for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
      if (boundary === 'open' && (o === 0 ? x : y) + k > L) continue;
      const a = y * L + x, j = this.counts[o]++;
      this.legal[o][j] = a; this.index[o][a] = j;
    }
    this.particles = [0,0];
  }
  footprint(o, anchor) {
    const x = anchor % this.L, y = Math.floor(anchor / this.L), result = [];
    for (let j = 0; j < this.k; j++) result.push(o === 0 ? y*this.L+(x+j)%this.L : ((y+j)%this.L)*this.L+x);
    return result;
  }
  canPlace(o, anchor) {
    if (anchor < 0 || anchor >= this.N || ![0,1].includes(o)) return false;
    const x = anchor % this.L, y = Math.floor(anchor / this.L);
    if (this.boundary === 'open' && (o === 0 ? x : y) + this.k > this.L) return false;
    return this.footprint(o, anchor).every(cell => this.occupancy[cell] === 0);
  }
  remove(o, a) {
    const j = this.index[o][a]; if (j < 0) return;
    const last = this.legal[o][--this.counts[o]];
    this.legal[o][j] = last; this.index[o][last] = j; this.index[o][a] = -1;
  }
  place(o, anchor) {
    if (this.index[o][anchor] < 0) throw new Error('Overlapping or invalid placement');
    const L = this.L, k = this.k, x = anchor % L, y = Math.floor(anchor / L), periodic = this.boundary === 'periodic';
    for (let j = 0; j < k; j++) {
      const cx = o === 0 ? (x+j)%L : x, cy = o === 1 ? (y+j)%L : y;
      this.occupancy[cy*L+cx] = o+1;
      for (let b = 0; b < k; b++) {
        const hx = cx-b, vy = cy-b;
        if (periodic || (hx >= 0 && hx+k <= L)) this.remove(0,cy*L+(hx+L)%L);
        if (periodic || (vy >= 0 && vy+k <= L)) this.remove(1,((vy+L)%L)*L+cx);
      }
    }
    this.particles[o]++;
  }
  uniformAnchor(o, rng) {
    const n = rng.integer(this.M);
    if (this.boundary === 'periodic') return n;
    return o === 0 ? Math.floor(n/(this.L-this.k+1))*this.L+n%(this.L-this.k+1) : n;
  }
  validate() {
    for (let o = 0; o < 2; o++) {
      let counted = 0;
      for (let a = 0; a < this.N; a++) {
        const allowed = this.canPlace(o,a), present = this.index[o][a] >= 0;
        if (allowed !== present) throw new Error(`Legal-set mismatch ${o}:${a}`);
        if (present && this.legal[o][this.index[o][a]] !== a) throw new Error('Dense-set index mismatch');
        counted += allowed;
      }
      if (counted !== this.counts[o]) throw new Error('Legal count mismatch');
    }
    if (this.occupancy.reduce((n,v)=>n+(v!==0),0) !== this.k*(this.particles[0]+this.particles[1])) throw new Error('Coverage mismatch');
    return true;
  }
}
