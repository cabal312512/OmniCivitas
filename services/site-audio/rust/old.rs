use serde_json::{json, Value};
use serde::Deserialize;
use std::io::{self, Read};

#[path = "../../../pinia/stock13/artifact.rs"]
mod warehouse;
#[path = "2.rs"]
mod schedule;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    audio: String,
    midi: Option<String>,
    #[serde(rename = "schemaVersion")]
    schema_version: Option<u64>,
}

fn digit(byte: u8) -> Result<u8, String> {
    match byte {
        b'A'..=b'Z' => Ok(byte - b'A'), b'a'..=b'z' => Ok(byte - b'a' + 26),
        b'0'..=b'9' => Ok(byte - b'0' + 52), b'+' => Ok(62), b'/' => Ok(63),
        _ => Err("artifact base64 contains an invalid character".into()),
    }
}
fn decode(value: &str, limit: usize) -> Result<Vec<u8>, String> {
    let bytes = value.as_bytes();
    if bytes.is_empty() || bytes.len() % 4 != 0 || bytes.len() > (limit + 2) / 3 * 4 {
        return Err("artifact base64 length is invalid or exceeds its limit".into());
    }
    let mut output = Vec::with_capacity(bytes.len() / 4 * 3);
    for (index, block) in bytes.chunks_exact(4).enumerate() {
        let a = digit(block[0])?; let b = digit(block[1])?;
        let last = index + 1 == bytes.len() / 4;
        let padding = if block[2] == b'=' { 2 } else if block[3] == b'=' { 1 } else { 0 };
        if padding > 0 && !last { return Err("artifact base64 padding appears before the end".into()); }
        if padding == 2 && (block[3] != b'=' || b & 15 != 0) { return Err("artifact base64 has noncanonical two-byte padding".into()); }
        let c = if padding == 2 { 0 } else { digit(block[2])? };
        if padding == 1 && c & 3 != 0 { return Err("artifact base64 has noncanonical one-byte padding".into()); }
        let d = if padding > 0 { 0 } else { digit(block[3])? };
        output.push(a << 2 | b >> 4);
        if padding < 2 { output.push(b << 4 | c >> 2); }
        if padding == 0 { output.push(c << 6 | d); }
    }
    if output.len() > limit { return Err("decoded artifact exceeds its byte limit".into()); }
    Ok(output)
}

fn receipt(input: &Envelope) -> Result<Value, String> {
    if input.schema_version.is_some_and(|version| version != 1) {
        return Err("unsupported receipt schemaVersion".into());
    }
    let wav = warehouse::inspect(&decode(&input.audio, 2 * 1024 * 1024)?)?;
    let midi = match &input.midi {
        None => Value::Null,
        Some(encoded) => schedule::inspect(&decode(encoded, 128 * 1024)?)?,
    };
    Ok(json!({"ok": true, "schemaVersion": 1, "engine": "ocv-site-receipt/1", "wav": wav, "midi": midi}))
}

fn main() {
    let mut input = Vec::new();
    let result = io::stdin().take(4 * 1024 * 1024 + 1).read_to_end(&mut input)
        .map_err(|_| "receipt stdin read failed".to_owned())
        .and_then(|_| {
            if input.len() > 4 * 1024 * 1024 { return Err("receipt request exceeds 4 MiB".into()); }
            serde_json::from_slice::<Envelope>(&input).map_err(|_| "invalid receipt JSON or fields".to_owned())
        }).and_then(|value| receipt(&value));
    match result {
        Ok(value) => println!("{value}"),
        Err(error) => {
            println!("{}", json!({"ok": false, "code": "receipt_invalid_artifact", "error": error}));
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::decode;
    #[test]
    fn decodes_real_padding_and_rejects_noncanonical_bits() {
        assert_eq!(decode("TQ==", 1).unwrap(), b"M");
        assert_eq!(decode("TWE=", 2).unwrap(), b"Ma");
        assert!(decode("TR==", 2).is_err()); assert!(decode("TWF=", 2).is_err());
        assert!(decode("TQ==AAAA", 10).is_err()); assert!(decode("====", 10).is_err());
    }
    #[test]
    fn rejects_bounded_overflow_and_data_urls() {
        assert!(decode("TWFu", 2).is_err());
        assert!(decode("data:audio/wav;base64,TWFu", 100).is_err());
    }
}
