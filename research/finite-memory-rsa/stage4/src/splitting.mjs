/** Fixed-effort nested-level splitting. No rare-entry probability is an input. */
export function splitContribution({ particles, levels, initialState, advanceLevel, terminalMark, rng, recordMark }) {
  if (!Number.isInteger(particles) || particles < 1 || !Number.isInteger(levels) || levels < 1) throw new RangeError('Positive particle and level counts required');
  let cohort = Array.from({ length: particles }, () => initialState()), entryEstimate = 1, oracleCalls = 0, resamplingDraws = 0;
  const survivorCounts = [];
  for (let level = 0; level < levels; level++) {
    const survivors = [];
    for (const state of cohort) { const next = advanceLevel(state, level, rng); oracleCalls++; if (next !== null) survivors.push(next); }
    survivorCounts.push(survivors.length); entryEstimate *= survivors.length / particles;
    if (!survivors.length) return { entryEstimate:0, contribution:0, survivorCounts, oracleCalls, resamplingDraws, extinct:true };
    cohort = Array.from({ length: particles }, () => { resamplingDraws++; return structuredClone(survivors[rng.integer(survivors.length)]); });
  }
  let marks = 0;
  cohort.forEach((state, i) => { const mark = terminalMark(state, rng); oracleCalls++;
    if (!Number.isFinite(mark) || mark < 0) throw new RangeError('Finite nonnegative terminal contribution required');
    marks += mark; if (recordMark) recordMark(i, mark); });
  return { entryEstimate, contribution:entryEstimate * marks / particles, conditionalMarkMean:marks / particles,
    survivorCounts, oracleCalls, resamplingDraws, extinct:false };
}
export function productLevelRelativeVariance({ conditionalProbabilities, particles, geometricHazard }) {
  if (conditionalProbabilities.some(p=>!(p>0&&p<=1)) || !(geometricHazard>0&&geometricHazard<=1)) throw new RangeError('Invalid benchmark probabilities');
  return conditionalProbabilities.reduce((value,p)=>value*(1+(1-p)/(particles*p)),1)*(1+(1-geometricHazard)/particles)-1;
}
