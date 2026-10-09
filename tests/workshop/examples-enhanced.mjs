import {testDeps} from '../runtime-location.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { wasmRunner } from './wasm.mjs';

export const enhancedExampleIds = Object.freeze([
  'compound-lift', 'switchback-sorter', 'parallel-transfer', 'isolated-conveyor'
]);
const pose = (frame, id) => {
  const value = frame.bodies.find(body => body.id === id);
  assert.ok(value, `Missing published pose ${id}`);
  return value;
};
const span = (frames, id, key) => {
  const values = frames.map(frame => pose(frame, id)[key]);
  return Math.max(...values) - Math.min(...values);
};
const separation = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rotationTravel = (frames, id) => frames.slice(1).reduce((sum, frame, index) => {
  const delta = pose(frame, id).angle - pose(frames[index], id).angle;
  return sum + Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
}, 0);
const event = (result, id, at) => {
  const found = result.keyMoments.find(moment => moment.kind === 'control' && moment.id === id);
  assert.ok(found, `Missing actual control ${id}`);
  if (at !== undefined) assert.ok(Math.abs(found.t - at) <= .025, `Control ${id} occurred at ${found.t}`);
  return found;
};
const touches = (result, a, b) => result.keyMoments.some(moment => moment.kind === 'contact'
  && [moment.a, moment.b].includes(a) && [moment.a, moment.b].includes(b));

export function checkEnhancedExample(id, project, result) {
  assert.ok(enhancedExampleIds.includes(id), `Unknown enhanced example ${id}`);
  assert.equal(result.schema, 'ocv.workshop-result/1');
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.summary.complete, true);
  assert.equal(project.world.durationS, 8);
  assert.ok(project.world.bodies.length >= 20 && project.world.bodies.length <= 45);
  assert.ok(project.world.joints.length <= 64 && project.world.motors.length <= 8 && project.world.controls.length <= 16);
  assert.ok(result.frames.length >= 100 && result.frames.length <= 256);
  assert.equal(result.frames.length, result.summary.frameCount);
  assert.ok(result.summary.steps <= 1921);
  for (const frame of result.frames) {
    assert.ok(Number.isFinite(frame.t));
    assert.equal(frame.bodies.length, project.world.bodies.length);
    for (const body of frame.bodies) {
      const initial = project.world.bodies.find(candidate => candidate.id === body.id);
      assert.ok(initial);
      for (const key of ['x', 'y', 'angle', 'vx', 'vy', 'omega']) assert.ok(Number.isFinite(body[key]), `${id}:${body.id}:${key}`);
      assert.ok(Math.hypot(body.x, body.y) < 30, `${id}:${body.id} escaped`);
      if (initial.mode === 'fixed') {
        assert.ok(Math.abs(body.x - initial.x) < .00001 && Math.abs(body.y - initial.y) < .00001);
      }
    }
  }
  assert.equal(result.summary.challengeComplete, true, `${id} did not complete its physical challenge`);
  assert.ok(result.keyMoments.some(moment => moment.kind === 'challenge' && moment.id === project.challenge.id && moment.complete));
  const last = result.frames.at(-1);
  switch (id) {
    case 'compound-lift': {
      const strokes = [], rodErrors = [];
      for (let i = 0; i < 4; i++) {
        const stroke = span(result.frames, `lift${i}`, 'y');
        assert.ok(stroke > 1.1, `Lift ${i} must complete a real crank stroke`);
        assert.ok(span(result.frames, `lift${i}`, 'x') < .025);
        strokes.push(stroke);
        const rod = project.world.joints.find(joint => joint.id === `connecting${i}`);
        const error = Math.max(...result.frames.map(frame => Math.abs(separation(pose(frame, rod.a), pose(frame, rod.b)) - rod.restLength)));
        assert.ok(error < .035, `Bilateral connecting rod ${i}: ${error}`);
        rodErrors.push(error);
      }
      const residuals = [
        Math.abs(pose(last, 'shaft1').omega + (4 / 3) * pose(last, 'shaft0').omega),
        Math.abs(pose(last, 'shaft2').omega + .75 * pose(last, 'shaft1').omega),
        Math.abs(pose(last, 'shaft3').omega - .5 * pose(last, 'shaft2').omega)
      ];
      assert.ok(residuals.every(value => value < .05));
      const reversals = result.keyMoments.filter(moment => moment.kind === 'control' && moment.id === 'reverse');
      assert.equal(reversals.length, 2);
      assert.ok(Math.abs(reversals[0].t - 3.4) < .025 && Math.abs(reversals[1].t - 6.8) < .025);
      return { strokes, maxRodError: Math.max(...rodErrors), transmissionResiduals: residuals, challengeTime: result.summary.completionTime };
    }
    case 'switchback-sorter': {
      event(result, 'release', .65); event(result, 'gateCoast', 1.9); event(result, 'park', 1.9);
      assert.ok(span(result.frames, 'gate', 'angle') > 1.0, 'The entrance gate must really open');
      const large = ['large0', 'large1'].map(id => pose(last, id));
      for (const body of large) {
        assert.ok(body.x > 5.8 && body.y > 4.8, 'Large marbles must remain on the upper route');
        assert.equal(touches(result, body.id, 'lower'), false);
      }
      const smallIds = ['small0', 'small1', 'small2'];
      const separated = smallIds.filter(id => pose(last, id).x > 4.5 && pose(last, id).y < 3.4);
      assert.ok(separated.length >= 1, 'A small marble must actually fall through the screen and travel down the lower rail');
      assert.ok(smallIds.some(id => touches(result, id, 'upperLeft') && touches(result, id, 'lower')));
      event(result, 'arrive'); event(result, 'count');
      return { lowerRouteMarbles: separated, largeFinal: large.map(body => ({ id: body.id, x: body.x, y: body.y })), challengeTime: result.summary.completionTime };
    }
    case 'parallel-transfer': {
      const transfers = [];
      for (let cell = 0; cell < 2; cell++) {
        const travel = span(result.frames, `tray${cell}`, 'x');
        assert.ok(travel > .5 && span(result.frames, `tray${cell}`, 'y') > .2);
        const angleError = Math.max(...result.frames.map(frame => Math.abs(pose(frame, `tray${cell}`).angle)));
        const pinError = Math.max(...result.frames.map(frame => Math.abs(separation(pose(frame, `pin${cell}_0`), pose(frame, `pin${cell}_1`)) - 4)));
        assert.ok(angleError < .04 && pinError < .045, 'The linked tray must keep its parallel attitude');
        for (const frame of result.frames) {
          const tray = pose(frame, `tray${cell}`), left = pose(frame, `load${cell}a`), right = pose(frame, `load${cell}b`);
          assert.ok(Math.abs(separation(left, right) - 1.3) < .04);
          assert.ok(Math.abs(separation(left, tray) - Math.hypot(.65, .43)) < .04);
        }
        transfers.push({ travel, maxAngleError: angleError, maxPinDistanceError: pinError });
      }
      const reversals = result.keyMoments.filter(moment => moment.kind === 'control' && moment.id === 'swing');
      assert.equal(reversals.length, 7);
      assert.deepEqual(reversals.map(moment => moment.sequence), [1, 2, 3, 4, 5, 6, 7]);
      event(result, 'coast', 7.85);
      return { transfers, reversals: reversals.length, challengeTime: result.summary.completionTime };
    }
    case 'isolated-conveyor': {
      event(result, 'start', .35); event(result, 'coast', 6.8);
      const bedTravel = span(result.frames, 'bed', 'y');
      assert.ok(bedTravel > .035 && bedTravel <= 1.035, 'The suspended bed must respond within the prismatic travel limit');
      assert.ok(span(result.frames, 'bed', 'x') < .03 && span(result.frames, 'bed', 'angle') < .03);
      const rollerTravel = Array.from({ length: 10 }, (_, i) => rotationTravel(result.frames, `roller${i}`));
      assert.ok(rollerTravel.filter(value => value > 12).length >= 8, 'The real roller bank must be driven');
      const travelled = pose(last, 'parcel0').x - project.world.bodies.find(body => body.id === 'parcel0').x;
      assert.ok(travelled > 7, 'A workpiece must move by actual contact rather than a cosmetic belt');
      const contactedRollers = Array.from({ length: 10 }, (_, i) => `roller${i}`).filter(id => touches(result, 'parcel0', id));
      assert.ok(contactedRollers.length >= 3);
      assert.ok(touches(result, 'parcel0', 'receiver'));
      event(result, 'receipt'); event(result, 'count');
      return { bedTravel, drivenRollers: rollerTravel.filter(value => value > 12).length, travelled, contactedRollers, challengeTime: result.summary.completionTime };
    }
  }
}

export async function checkEnhancedExamples({ directory = 'config/parts/examples', wasm, reportPath } = {}) {
  const catalogue = JSON.parse(await readFile(join(directory, 'catalogue.json'), 'utf8'));
  const wasmPath = wasm || 'config/apps/portal/public/workshop/engines/mechanics.wasm';
  const run = await wasmRunner(wasmPath);
  const report = { schema: 'ocv.workshop-enhanced-examples-validation/1', passed: true,
    scope: 'Four new assemblies, one unchanged local WASM instance, serial simulations; no native backend jobs.',
    wasmSha256: createHash('sha256').update(await readFile(wasmPath)).digest('hex'), examples: [] };
  for (const id of enhancedExampleIds) {
    const entry = catalogue.entries.find(entry => entry.id === id); assert.ok(entry, `Missing catalogue entry ${id}`);
    const source = await readFile(join(directory, entry.file), 'utf8'), project = JSON.parse(source);
    assert.equal(project.name, entry.name);
    const started = performance.now();
    const result = run({ schema: 'ocv.workshop-run/1', op: 'simulate', world: project.world, challenge: project.challenge });
    const row = { id, name: project.name, sha256: createHash('sha256').update(source).digest('hex'),
      bodies: project.world.bodies.length, joints: project.world.joints.length, motors: project.world.motors.length,
      controls: project.world.controls.length, engine: result.version, summary: result.summary, diagnostics: result.diagnostics };
    try { row.evidence = checkEnhancedExample(id, project, result); row.passed = true; }
    catch (error) { row.passed = false; row.error = error.message; report.passed = false; }
    row.elapsedMs = performance.now() - started; report.examples.push(row);
  }
  const output = reportPath || process.env.OCV_WORKSHOP_ENHANCED_REPORT
    || join(testDeps, 'runtime', 'reports', 'phase12-workshop-enhanced.json');
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, examples: report.examples.map(({ id, passed, error, evidence }) => ({ id, passed, error, evidence })), report: output }));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkEnhancedExamples({ directory: process.argv[2], wasm: process.argv[3] });
  if (!report.passed) process.exitCode = 1;
}
