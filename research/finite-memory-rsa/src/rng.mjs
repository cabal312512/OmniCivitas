/** xoshiro128** 1.1, following Blackman and Vigna (2018).
 * The original algorithm is public domain; provenance: THIRD_PARTY_NOTICES.md.
 * Math.imul and unsigned shifts make the stream reproducible across JS hosts.
 */
export class RNG {
  constructor(seed) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be a uint32');
    let x = seed >>> 0;
    const mix = () => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s = [mix(), mix(), mix(), mix()];
    if (this.s.every(v => v === 0)) this.s[0] = 1;
  }
  uint32() {
    const s = this.s, x = Math.imul(s[1], 5), result = Math.imul((x << 7) | (x >>> 25), 9) >>> 0, t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t;
    s[3] = (s[3] << 11) | (s[3] >>> 21);
    return result;
  }
  uniform() { return (this.uint32() + 0.5) / 4294967296; }
  integer(n) {
    if (!Number.isInteger(n) || n < 1 || n > 0xffffffff) throw new RangeError('Invalid sampling bound');
    const threshold = (4294967296 - n) % n;
    let x; do { x = this.uint32(); } while (x < threshold);
    return x % n;
  }
}
