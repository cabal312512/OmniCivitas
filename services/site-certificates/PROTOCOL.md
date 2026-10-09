# Tool certificate protocol

WEB3 is an optional Haskell/Servant service for existing tool results. Successful normal matrix/base/JSON/CSV runs automatically submit a bounded certificate request; the result button only opens a completed record. It does not own progress, projects, jobs, versions, accounts, scientific results, game state, or engineering validation. The gateway and existing PostgreSQL task authority own submission, storage, and lifecycle. A certificate never overwrites the original frontend result or download.

`POST /ReturnOrder.asmx` accepts UTF-8 `application/json`:

```json
{
  "schema": "ocv.tool-certificate/1",
  "kind": "matrix",
  "input": {
    "operation": "add",
    "a": "[[0.1,0],[0,0]]",
    "b": "[[0.2,0],[0,0]]"
  },
  "expected": "0.30000000000000004\t0\n0\t0"
}
```

Only `schema`, `kind`, `input`, and optional `expected` are permitted. `input` is an object. Unknown fields and schema/kind versions are rejected by the typed request parser. Kind input schemas are fixed:

| Kind | Input | Original result comparison |
| --- | --- | --- |
| `matrix` | `operation`: `add`, `subtract`, or `determinant`; `a`: original matrix JSON text; `b`: original JSON text for add/subtract | Original scalar number/text, numeric array, or TSV text. Shape must match. Each decimal display satisfies `abs(display-exact) <= 1e-12 + 1e-10*abs(exact)`. |
| `base` | `value`: original integer text; `from`, `to`: numeric 2, 8, 10, or 16 | Original lowercase target-base text must match exactly. Optional sign/matching prefix follows the existing tool. Negative zero becomes zero. |
| `json` | `source`: original JSON text; optional `structure`: `{root: "any"|"object"|"array", requiredKeys?: string[]}` | Original rendered JSON text or decoded value. Object keys and array/string/bool/null values match; finite numeric displays use absolute `1e-12` plus relative `1e-10` tolerance. Required keys need an explicitly declared object root. |
| `csv` | `source`: original CSV text; optional `delimiter`: comma/semicolon/tab; optional `header`: false by default; optional `structure`: `{width?: integer, columns?: string[]}` | Original rendered CSV text or string-cell table is decoded and compared exactly. Ordered column names require `header: true`. Width zero/omitted means unspecified. |

The existing matrix range remains 2x2/3x3, add/subtract/determinant, at most 800 characters per original JSON. Decimal JSON literals are parsed through Scientific and converted directly to reduced `Rational`, without an intermediate floating calculation. Every original numeric cell must also be a finite frontend number. Certification bounds decimal powers to +/-1024 and each exact fraction to 8192 characters. A frontend-accepted underflow literal beyond those certification bounds receives an explicit invalid certificate; its original local result remains available. Exact results use `numerator/positive-denominator` strings. Matrix and base values are dimensionless.

Base input remains at most 2048 source digits, plus an optional sign and matching `0b`, `0o`, or `0x` prefix. Arbitrary-precision integers preserve values beyond JavaScript's safe integer range. Expansion to another base can exceed 2048 output digits, as the original tool allows.

JSON/CSV certification covers a 64 KiB UTF-8 subset of the existing local 2 MiB tools. JSON depth is at most 32, node count at most 8192, with at most 64 bounded required-key names. It retains the local tool's finite-number and safe-integer rule; large integers must be strings. Duplicate-object-key uniqueness is explicitly not proved. CSV is limited to 5000 rows and 256 columns, and preserves trailing empty rows and ragged rows. Quoted delimiters, doubled quotes and quoted newlines are decoded. Ragged rows produce a warning unless an explicit width schema requires them to fail.

Success and failed supported-kind checks both return HTTP 200 certificates. `valid` is true only when every check passed. Typed request/schema failures use HTTP 400; request bodies exceeding 192 KiB use 413; nesting beyond 40 or a result exceeding 512 KiB uses 422. Empty/invalid format data is an invalid certificate with explicit diagnostics. No submitted content is logged. The service has no SQL, evaluation, dynamic-code, filesystem-write, or account routes.

Certificates contain `schema`, `formatVersion` (`"1"`), `kind`, `valid`, SHA-256 `inputDigest`, `digestAlgorithm`, `digestScope`, bounded `result`, finite `steps`, `checks`, `warnings`, and `download`. Digest input is sorted-key UTF-8 canonical JSON of `{schema,kind,input}`; `expected` is excluded. This is a content fingerprint, not a signature or a proof of third-party identity.

`download.json` and `download.csv` contain `{filename,mime,text}`. Both contain the same certificate core without a recursively embedded download field. CSV has four cells: schema/kind/valid/`certificateJson`; its final cell contains the JSON certificate text with CSV quoting. The actual generation path parses the CSV and checks recovered content. The fixture suite additionally decodes the embedded JSON and compares certificate status and digest.

`GET /ready` reports service readiness. Default port is 7083. Runtime uses one GHC capability, 160 MiB heap ceiling and a ten-second Warp request timeout; deployment should also apply container CPU/memory/PID/log limits and gateway deadlines. There is no second scheduler or persistence authority.

Build from repository root with the supplied Dockerfile after storage verification and serial resource admission. Debian packaged GHC/Servant/Aeson/Warp/cryptohash-sha256 avoid a large Cabal compilation. The Dockerfile compiles the server and a separate fixture executable. Run `/usr/local/bin/certificate-fixtures +RTS -N1 -M160m -RTS` in an admitted, bounded container; it emits one JSON report and exits nonzero on any failed case. Fixtures cover exact decimal addition, 2x2/3x3/singular determinants, original-result mismatch, negative/prefixed base inputs and maximum digit limits, bad JSON/schema/depth/size/safe-integer cases, quoted CSV and structural mismatches, and actual JSON/CSV download recovery. Source existence alone is not runtime verification.

The HTTP API uses [Servant's typed request and server combinators](https://docs.servant.dev/en/latest/tutorial/Server.html), served through Warp. Dependency licensing follows the installed Debian package metadata; the implementation contains no copied third-party sources.
