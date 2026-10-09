use serde_json::{json, Value};

fn u16le(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let pair = bytes.get(offset..offset + 2).ok_or("truncated WAV integer")?;
    Ok(u16::from_le_bytes([pair[0], pair[1]]))
}
fn u32le(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let word = bytes.get(offset..offset + 4).ok_or("truncated WAV integer")?;
    Ok(u32::from_le_bytes([word[0], word[1], word[2], word[3]]))
}

// This parser does not use the C++ manifest, measurements or chunk offsets.
pub fn inspect(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() < 44 || bytes.len() > 2 * 1024 * 1024 {
        return Err("WAV byte count is outside the bounded receipt policy".into());
    }
    if bytes.get(0..4) != Some(b"RIFF") || bytes.get(8..12) != Some(b"WAVE") {
        return Err("expected a RIFF/WAVE file".into());
    }
    if u32le(bytes, 4)? as usize != bytes.len() - 8 {
        return Err("RIFF declared length does not equal actual bytes".into());
    }
    let mut cursor = 12;
    let mut format = None;
    let mut data: Option<&[u8]> = None;
    let mut chunk_count = 0;
    let mut unknown_chunks = 0;
    while cursor < bytes.len() {
        chunk_count += 1;
        if chunk_count > 32 { return Err("WAV chunk count exceeds 32".into()); }
        let header = bytes.get(cursor..cursor + 8).ok_or("truncated WAV chunk header")?;
        let length = u32le(header, 4)? as usize;
        cursor += 8;
        let end = cursor.checked_add(length).ok_or("WAV chunk length overflow")?;
        let content = bytes.get(cursor..end).ok_or("WAV chunk exceeds actual bytes")?;
        match &header[0..4] {
            b"fmt " => {
                if format.is_some() { return Err("duplicate WAV format chunk".into()); }
                if length != 16 && length != 18 { return Err("supported PCM format chunk lengths are 16 and 18".into()); }
                if length == 18 && u16le(content, 16)? != 0 { return Err("PCM format extension must be empty".into()); }
                let codec = u16le(content, 0)?;
                let channels = u16le(content, 2)?;
                let rate = u32le(content, 4)?;
                let byte_rate = u32le(content, 8)?;
                let alignment = u16le(content, 12)?;
                let bits = u16le(content, 14)?;
                if codec != 1 || channels != 1 || bits != 16 || alignment != 2 {
                    return Err("receipt supports mono PCM16 only".into());
                }
                if !matches!(rate, 8000 | 16000 | 22050 | 44100) || byte_rate != rate * 2 {
                    return Err("WAV sample rate or byte rate is inconsistent".into());
                }
                format = Some(rate);
            }
            b"data" => {
                if format.is_none() { return Err("WAV format chunk must precede audio data".into()); }
                if data.is_some() { return Err("duplicate WAV data chunk".into()); }
                if length == 0 || length % 2 != 0 { return Err("PCM16 data must contain complete nonempty frames".into()); }
                data = Some(content);
            }
            _ => unknown_chunks += 1,
        }
        cursor = end.checked_add(length % 2).ok_or("WAV padding overflow")?;
        if cursor > bytes.len() { return Err("missing WAV word-alignment padding".into()); }
    }
    let rate = format.ok_or("missing WAV format chunk")?;
    let pcm = data.ok_or("missing WAV data chunk")?;
    let frames = pcm.len() / 2;
    if frames > rate as usize * 20 { return Err("WAV duration exceeds 20 seconds".into()); }
    let mut square = 0.0;
    let mut peak: f64 = 0.0;
    let mut zero_crossings = 0usize;
    let mut full_scale_frames = 0usize;
    let mut previous = None;
    for pair in pcm.chunks_exact(2) {
        let sample = i16::from_le_bytes([pair[0], pair[1]]);
        let value = f64::from(sample) / 32768.0;
        square += value * value;
        peak = peak.max(value.abs());
        if sample == i16::MIN || sample == i16::MAX { full_scale_frames += 1; }
        if let Some(prior) = previous {
            if (prior < 0 && sample >= 0) || (prior >= 0 && sample < 0) { zero_crossings += 1; }
        }
        previous = Some(sample);
    }
    Ok(json!({
        "valid": true, "format": "RIFF/WAVE PCM", "sampleRate": rate,
        "channels": 1, "bitsPerSample": 16, "blockAlign": 2,
        "frames": frames, "dataBytes": pcm.len(), "fileBytes": bytes.len(),
        "durationMs": frames as f64 * 1000.0 / f64::from(rate),
        "rms": (square / frames as f64).sqrt(), "peak": peak,
        "zeroCrossings": zero_crossings, "fullScaleFrames": full_scale_frames,
        "chunkCount": chunk_count, "unknownChunks": unknown_chunks,
        "scope": "bounded mono PCM16 receipt; independent raw-byte measurements"
    }))
}

#[cfg(test)]
mod tests {
    use super::inspect;
    fn fixture() -> Vec<u8> {
        let mut b = b"RIFF".to_vec();
        b.extend(40u32.to_le_bytes()); b.extend(b"WAVEfmt ");
        b.extend(16u32.to_le_bytes()); b.extend(1u16.to_le_bytes()); b.extend(1u16.to_le_bytes());
        b.extend(8000u32.to_le_bytes()); b.extend(16000u32.to_le_bytes());
        b.extend(2u16.to_le_bytes()); b.extend(16u16.to_le_bytes()); b.extend(b"data");
        b.extend(4u32.to_le_bytes()); b.extend(16384i16.to_le_bytes()); b.extend((-16384i16).to_le_bytes());
        b
    }
    #[test]
    fn measures_actual_pcm() {
        let result = inspect(&fixture()).unwrap();
        assert_eq!(result["frames"], 2); assert_eq!(result["peak"], 0.5);
        assert_eq!(result["rms"], 0.5); assert_eq!(result["zeroCrossings"], 1);
    }
    #[test]
    fn rejects_magic_only_and_wrong_outer_length() {
        assert!(inspect(b"RIFF0000WAVE").is_err());
        let mut b = fixture(); b[4] = 1; assert!(inspect(&b).is_err());
    }
    #[test]
    fn rejects_inconsistent_rate_and_truncated_data() {
        let mut b = fixture(); b[28] ^= 1; assert!(inspect(&b).is_err());
        let mut b = fixture(); b.pop(); assert!(inspect(&b).is_err());
    }
    #[test]
    fn rejects_duplicate_or_preformat_data() {
        let original = fixture();
        let mut reordered = original[..12].to_vec();
        reordered.extend(&original[36..]); reordered.extend(&original[12..36]);
        assert!(inspect(&reordered).is_err());
        let mut b = fixture(); b.extend(b"data"); b.extend(2u32.to_le_bytes()); b.extend([0, 0]);
        let size = (b.len() - 8) as u32; b[4..8].copy_from_slice(&size.to_le_bytes());
        assert!(inspect(&b).is_err());
    }
    #[test]
    fn accepts_unknown_padded_chunk_but_rejects_missing_padding() {
        let mut b = fixture(); b.extend(b"JUNK"); b.extend(1u32.to_le_bytes()); b.extend([7, 0]);
        let size = (b.len() - 8) as u32; b[4..8].copy_from_slice(&size.to_le_bytes());
        assert_eq!(inspect(&b).unwrap()["unknownChunks"], 1);
        b.pop(); let size = (b.len() - 8) as u32; b[4..8].copy_from_slice(&size.to_le_bytes());
        assert!(inspect(&b).is_err());
    }
}
