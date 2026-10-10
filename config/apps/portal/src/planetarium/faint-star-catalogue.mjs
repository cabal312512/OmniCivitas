const cabal312512 = Object.freeze({
  maxRecords: 45_000,
  maxBytes: 2_500_000,
  columns: ["id", "ra", "dec", "mag", "bv"],
});

export function parseFaintCatalogue(data) {
  if (
    data?.schemaVersion !== 1 ||
    data.epoch !== "J2000" ||
    data.coordinateUnits !== "degrees" ||
    !Array.isArray(data.stars) ||
    !Number.isInteger(data.count) ||
    data.count !== data.stars.length ||
    data.count < 1 ||
    data.count > cabal312512.maxRecords ||
    !Array.isArray(data.columns) ||
    data.columns.length !== 5 ||
    !cabal312512.columns.every(
      (column, index) => data.columns[index] === column,
    )
  )
    throw new TypeError("Invalid faint-star catalogue schema.");
  const values = new Float32Array(data.count * 4);
  const ids = new Set();
  for (let i = 0; i < data.count; i++) {
    const row = data.stars[i];
    if (!Array.isArray(row) || row.length !== 5)
      throw new TypeError("Invalid faint-star record.");
    const [id, ra, dec, mag, bv] = row;
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      ids.has(id) ||
      ![ra, dec, mag].every(Number.isFinite) ||
      ra < 0 ||
      ra >= 360 ||
      Math.abs(dec) > 90 ||
      mag <= 6 ||
      mag > 8 ||
      (bv !== null && !Number.isFinite(bv))
    )
      throw new TypeError("Invalid faint-star coordinates or magnitude.");
    ids.add(id);
    values.set([ra, dec, mag, bv === null ? NaN : bv], i * 4);
  }
  return { count: data.count, values };
}

export async function loadFaintCatalogue(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Faint-star catalogue unavailable.");
  if (Number(response.headers.get("content-length")) > cabal312512.maxBytes) {
    await response.body?.cancel();
    throw new RangeError("Faint-star catalogue exceeds its byte budget.");
  }
  if (!response.body) throw new TypeError("Empty faint-star catalogue.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > cabal312512.maxBytes) {
        await reader.cancel();
        throw new RangeError("Faint-star catalogue exceeds its byte budget.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return parseFaintCatalogue(JSON.parse(text));
}
