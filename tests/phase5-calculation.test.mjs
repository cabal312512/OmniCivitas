import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  tools, timestampToMilliseconds, parseIsoDate, timeZoneText, convertUnits,
  calculateExpression, parseMatrix, matrixOperation, convertRadix,
  parseColor, colorFormats, rgbToHsl, hslToRgb, numberToRoman, romanToNumber,
  octalToPermissions, permissionsToOctal,
} from '../config/apps/portal/src/math1/报价单_final2.mjs';

const tool = id => tools.find(entry => entry.id === id);
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' ≠ ' + expected);

test('all ten descriptors execute real defaults with string output', async () => {
  assert.deepEqual(tools.map(entry => entry.id), ['timestamp', 'time-zone', 'convert', 'calculator', 'scientific', 'matrix', 'radix', 'color', 'roman', 'permissions']);
  for (const entry of tools) {
    const defaults = Object.fromEntries(entry.fields.map(field => [field.key, field.default]));
    const result = await entry.run(defaults, {});
    assert.equal(typeof result.text, 'string', entry.id);
    assert.ok(result.text.length > 0, entry.id);
    if (result.table) assert.ok(result.table.every(row => row.every(value => typeof value === 'string')));
  }
}, 60000); // Cold Math.js module transformation on a fresh CI workspace.

test('timestamp zero, pre-epoch, fractional seconds and explicit precision', async () => {
  assert.equal(timestampToMilliseconds('0'), 0);
  assert.equal(timestampToMilliseconds('-0.001'), -1);
  assert.equal(timestampToMilliseconds('+1.25'), 1250);
  assert.equal(timestampToMilliseconds('1234', 'milliseconds'), 1234);
  assert.equal((await tool('timestamp').run({ mode: 'forward', value: '0', precision: 'seconds' })).text, '1970-01-01T00:00:00.000Z');
  assert.equal((await tool('timestamp').run({ mode: 'reverse', value: '1969-12-31T23:59:59.999Z', precision: 'seconds' })).text, '-0.001');
  assert.equal((await tool('timestamp').run({ mode: 'reverse', value: '1970-01-01T00:00:00.001Z', precision: 'milliseconds' })).text, '1');
  for (const value of ['', '1.0001', '1e3', 'NaN', 'Infinity', '99999999999999999']) assert.throws(() => timestampToMilliseconds(value));
  assert.throws(() => timestampToMilliseconds('1.5', 'milliseconds'));
  assert.equal(timestampToMilliseconds('8640000000000000', 'milliseconds'), 8640000000000000);
  assert.throws(() => timestampToMilliseconds('8640000000000001', 'milliseconds'));
  assert.equal((await tool('timestamp').run({ mode: 'reverse', value: '+275760-09-13T00:00:00.000Z', precision: 'milliseconds' })).text, '8640000000000000');
});

test('ISO parsing verifies actual calendar and does not inherit host timezone', () => {
  assert.equal(parseIsoDate('1970-01-01T08:00:00+08:00'), 0);
  assert.equal(parseIsoDate('1969-12-31T16:00:00-08:00'), 0);
  assert.equal(parseIsoDate('2000-02-29T00:00:00Z'), 951782400000);
  assert.equal(new Date(parseIsoDate('0000-02-29T00:00:00Z')).toISOString(), '0000-02-29T00:00:00.000Z');
  assert.equal(new Date(parseIsoDate('0099-12-31T23:59:59.123Z')).toISOString(), '0099-12-31T23:59:59.123Z');
  for (const value of ['1900-02-29T00:00:00Z', '2023-02-29T00:00:00Z', '2024-04-31T00:00:00Z', '2024-00-01T00:00:00Z', '2024-01-00T00:00:00Z', '2024-01-01T24:00:00Z', '2024-01-01T00:60:00Z', '2024-01-01T00:00:60Z', '2024-01-01T00:00:00+24:00', '2024-01-01T00:00:00+08:60', '2024-01-01', '2024-01-01T00:00:00', '2024-01-01T00:00:00.1234Z']) assert.throws(() => parseIsoDate(value), undefined, value);
});

test('fixed IANA zones use actual Intl DST transitions, including repeated hour', () => {
  assert.equal(timeZoneText(parseIsoDate('2024-03-10T06:59:59Z'), 'America/New_York'), '2024-03-10 01:59:59.000 GMT-05:00 [America/New_York]');
  assert.equal(timeZoneText(parseIsoDate('2024-03-10T07:00:00Z'), 'America/New_York'), '2024-03-10 03:00:00.000 GMT-04:00 [America/New_York]');
  assert.equal(timeZoneText(parseIsoDate('2024-11-03T05:30:00Z'), 'America/New_York'), '2024-11-03 01:30:00.000 GMT-04:00 [America/New_York]');
  assert.equal(timeZoneText(parseIsoDate('2024-11-03T06:30:00Z'), 'America/New_York'), '2024-11-03 01:30:00.000 GMT-05:00 [America/New_York]');
  assert.equal(timeZoneText(0, 'Asia/Shanghai'), '1970-01-01 08:00:00.000 GMT+08:00 [Asia/Shanghai]');
  assert.equal(timeZoneText(parseIsoDate('2024-03-31T01:00:00Z'), 'Europe/London'), '2024-03-31 02:00:00.000 GMT+01:00 [Europe/London]');
  assert.equal(timeZoneText(parseIsoDate('0000-01-01T00:00:00Z'), 'UTC'), '0000-01-01 00:00:00.000 GMT+00:00 [UTC]');
  assert.equal(timeZoneText(parseIsoDate('-000001-01-01T00:00:00Z'), 'UTC'), '-000001-01-01 00:00:00.000 GMT+00:00 [UTC]');
  assert.throws(() => timeZoneText(0, 'Mars/Olympus'));
});

test('bounded unit categories calculate actual ratios and affine temperature', () => {
  close(convertUnits('1', 'length', 'in', 'cm'), 2.54);
  close(convertUnits('1', 'length', 'mi', 'km'), 1.609344);
  close(convertUnits('1', 'mass', 'lb', 'g'), 453.59237);
  close(convertUnits('1', 'mass', 'oz', 'lb'), 1 / 16);
  close(convertUnits('1', 'area', 'ha', 'm2'), 10000);
  close(convertUnits('1', 'area', 'ft2', 'm2'), .09290304);
  close(convertUnits('32', 'temperature', 'F', 'C'), 0);
  close(convertUnits('-40', 'temperature', 'C', 'F'), -40);
  close(convertUnits('0', 'temperature', 'K', 'C'), -273.15);
  close(convertUnits('100', 'temperature', 'C', 'K'), 373.15);
  assert.equal(convertUnits('1e308', 'length', 'km', 'km'), 1e308);
  assert.throws(() => convertUnits('1e308', 'mass', 'kg', 'g'));
  assert.throws(() => convertUnits('1', 'mass', 'm', 'kg'));
  for (const value of ['', 'Infinity', '1abc', '1e999']) assert.throws(() => convertUnits(value, 'length', 'm', 'cm'));
  assert.throws(() => convertUnits('1e308', 'length', 'km', 'mm'));
});

test('Math.js basic expression precedence, negatives and remainder', async () => {
  assert.equal(await calculateExpression('2 + 3 * 4'), 14);
  assert.equal(await calculateExpression('(2 + 3) * 4'), 20);
  assert.equal(await calculateExpression('(-7 + 2) / 2'), -2.5);
  assert.equal(await calculateExpression('17 % 5'), 2);
  close(await calculateExpression('0.1 + 0.2'), .3);
  await assert.rejects(calculateExpression('sin(0)'));
  await assert.rejects(calculateExpression('2^3'));
  assert.equal((await tool('calculator').run({ expression: '9007199254740991 + 0' })).text, '9007199254740991');
});

test('Math.js scientific functions use radians and scalar domains', async () => {
  close(await calculateExpression('sin(pi / 6)^2 + cos(pi / 6)^2', true), 1);
  close(await calculateExpression('log(8, 2)', true), 3);
  assert.equal(await calculateExpression('sqrt(81) + abs(-3)', true), 12);
  assert.equal(await calculateExpression('min(8,3,2) + max(1,4)', true), 6);
  assert.equal(await calculateExpression('round(1.235, 2)', true), 1.24);
  close(await calculateExpression('exp(1)', true), Math.E);
  close(await calculateExpression('atan(1)', true), Math.PI / 4);
  for (const expression of ['sqrt(-1)', 'acos(2)', 'log(0)', '1 / 0', 'exp(1000)', '1e308 * 1e308']) await assert.rejects(calculateExpression(expression, true), undefined, expression);
});

test('expression surface rejects side effects, property access and allocation syntax', async () => {
  const forbidden = ['a=2', 'a=2;a+1', 'import("x")', 'createUnit("x")', 'evaluate("2+2")', 'sqrt.constructor("return 1")()', 'pi.x', 'pi[1]', '[1,2]', '1:1000000', 'ones(10000,10000)', 'factorial(100000)', 'sum(1,2)', 'sin(0,1)', 'max(1,2,3,4,5,6,7,8,9)', '"abc"', 'true', '2 cm', '1 == 1', '1 ? 2 : 3', '2!', 'sin('.repeat(26) + '0' + ')'.repeat(26)];
  for (const expression of forbidden) await assert.rejects(calculateExpression(expression, true), undefined, expression);
  await assert.rejects(calculateExpression('1+'.repeat(201) + '1', true));
  await assert.rejects(calculateExpression('9'.repeat(401), true));
  assert.equal(await calculateExpression('1 + 1', true), 2, 'blocked inputs do not poison following calculations');
});

test('2×2/3×3 matrix operations, determinant and exported TSV are actual', async () => {
  assert.deepEqual(await matrixOperation('[[1,2],[3,4]]', '[[4,3],[2,1]]', 'add'), [[5,5],[5,5]]);
  assert.deepEqual(await matrixOperation('[[1,2],[3,4]]', '[[4,3],[2,1]]', 'subtract'), [[-3,-1],[1,3]]);
  assert.equal(await matrixOperation('[[1,2],[3,4]]', 'ignored', 'determinant'), -2);
  assert.equal(await matrixOperation('[[6,1,1],[4,-2,5],[2,8,7]]', '', 'determinant'), -306);
  close(await matrixOperation('[[0.1,0.2],[0.3,0.4]]', '', 'determinant'), -.02);
  const output = await tool('matrix').run({ a: '[[1,2],[3,4]]', b: '[[4,3],[2,1]]', operation: 'add' });
  assert.equal(output.text, '5\t5\n5\t5');
  assert.equal(output.extension, 'tsv');
});

test('matrix limits reject ragged/nonsquare/nonfinite or mismatched data', async () => {
  for (const value of ['[]', '[[1]]', '[[1,2],[3]]', '[[1,2,3],[4,5,6]]', '[[1,"2"],[3,4]]', '[[1,null],[3,4]]', '[[1,1e999],[3,4]]', '[[1,2,3,4],[1,2,3,4],[1,2,3,4],[1,2,3,4]]', '{"0":[1,2]}', 'not JSON']) assert.throws(() => parseMatrix(value), undefined, value);
  await assert.rejects(matrixOperation('[[1,2],[3,4]]', '[[1,2,3],[4,5,6],[7,8,9]]', 'add'));
  await assert.rejects(matrixOperation('[[1e308,2],[3,4]]', '[[1e308,2],[3,4]]', 'add'));
  await assert.rejects(matrixOperation('[[1e308,2],[3,1e308]]', '', 'determinant'));
});

test('BigInt conversion preserves integers beyond Number precision and signs', () => {
  assert.equal(convertRadix('9007199254740993', 10, 16), '20000000000001');
  assert.equal(convertRadix('-0x20000000000001', 16, 10), '-9007199254740993');
  assert.equal(convertRadix('+0b101010', 2, 8), '52');
  assert.equal(convertRadix('0o755', 8, 10), '493');
  assert.equal(convertRadix('-0', 10, 2), '0');
  const huge = 'f'.repeat(512);
  assert.equal(convertRadix(convertRadix(huge, 16, 10), 10, 16), huge);
  assert.equal(convertRadix('f'.repeat(2048), 16, 2).length, 8192);
});

test('base validators reject digits, decimals, prefixes and excess lengths', () => {
  for (const [value, base] of [['2',2],['8',8],['12.5',10],['0xff',10],['g',16],['',10],['-',10],['f'.repeat(2049),16]]) assert.throws(() => convertRadix(value, base, 10));
  assert.throws(() => convertRadix('10', 3, 10));
  assert.throws(() => convertRadix('10', 10, 36));
});

test('HEX/RGB/HSL colors cover common formats, gray and hue wrapping', () => {
  assert.deepEqual(parseColor('#03f', 'hex'), [0,51,255]);
  assert.deepEqual(parseColor('rgb(0, 96, 255)', 'rgb'), [0,96,255]);
  assert.deepEqual(parseColor('255,0,0', 'rgb'), [255,0,0]);
  assert.deepEqual(parseColor('hsl(120,100%,50%)', 'hsl'), [0,255,0]);
  assert.deepEqual(parseColor('hsl(-240deg,100%,50%)', 'hsl'), [0,255,0]);
  assert.deepEqual(hslToRgb(0,0,50), [128,128,128]);
  assert.deepEqual(rgbToHsl(0,0,0), [0,0,0]);
  assert.deepEqual(rgbToHsl(255,255,255), [0,0,100]);
  assert.equal(colorFormats([0,96,255]).hex, '#0060FF');
  assert.equal(colorFormats([255,0,0]).hsl, 'hsl(0, 100%, 50%)');
});

test('RGB → HSL → RGB round trips real channels across color cube', () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const rgb = [r,g,b];
    assert.deepEqual(hslToRgb(...rgbToHsl(...rgb)), rgb);
    assert.deepEqual(parseColor(colorFormats(rgb).hsl, 'hsl'), rgb);
  }
});

test('color input rejects channel overflow, unsupported alpha and malformed CSS', () => {
  for (const [value, format] of [['#1234','hex'],['#GGG','hex'],['rgb(256,0,0)','rgb'],['rgb(-1,0,0)','rgb'],['rgb(0.5,0,0)','rgb'],['rgb(1,2,3','rgb'],['1,2,3)','rgb'],['rgba(1,2,3,1)','rgb'],['hsl(20,101%,50%)','hsl'],['hsl(20,50%,-1%)','hsl'],['hsl(20,50,50)','hsl'],['hsl(20,50%,50%','hsl']]) assert.throws(() => parseColor(value, format), undefined, value);
});

test('Roman conversion is canonical and exhaustive for supported integers', () => {
  assert.equal(numberToRoman(1994), 'MCMXCIV');
  assert.equal(romanToNumber('mcmxciv'), 1994);
  assert.equal(numberToRoman(3999), 'MMMCMXCIX');
  for (let number = 1; number <= 3999; number++) assert.equal(romanToNumber(numberToRoman(number)), number);
  for (const value of ['', 'IIII', 'IIV', 'IC', 'VX', 'MMMM', 'MIXA']) assert.throws(() => romanToNumber(value));
  for (const value of ['0', '-1', '4000', '1.2', 'Infinity']) assert.throws(() => numberToRoman(value));
});

test('Unix permission bits, setuid/setgid/sticky and exhaustive mode round trip', () => {
  assert.equal(octalToPermissions('755'), 'rwxr-xr-x');
  assert.equal(permissionsToOctal('-rwxr-xr-x'), '755');
  assert.equal(octalToPermissions('4755'), 'rwsr-xr-x');
  assert.equal(octalToPermissions('2644'), 'rw-r-Sr--');
  assert.equal(octalToPermissions('1777'), 'rwxrwxrwt');
  assert.equal(octalToPermissions('1000'), '--------T');
  for (let mode = 0; mode <= 4095; mode++) {
    const octal = mode.toString(8).padStart(3, '0');
    assert.equal(Number.parseInt(permissionsToOctal(octalToPermissions(octal)), 8), mode);
  }
  for (const value of ['888', '75', '07777', '-755', 'rw-rw-rws', 'rwxrwxrwq', 'rwsrwsrws']) {
    assert.throws(() => /^\d|^-/.test(value) ? octalToPermissions(value) : permissionsToOctal(value), undefined, value);
  }
});
