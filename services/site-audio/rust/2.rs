use serde_json::{json, Value};

fn big16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let b = bytes.get(offset..offset + 2).ok_or("truncated MIDI integer")?;
    Ok(u16::from_be_bytes([b[0], b[1]]))
}
fn big32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let b = bytes.get(offset..offset + 4).ok_or("truncated MIDI integer")?;
    Ok(u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
}
fn take(bytes: &[u8], cursor: &mut usize) -> Result<u8, String> {
    let result = *bytes.get(*cursor).ok_or("truncated MIDI event")?;
    *cursor += 1;
    Ok(result)
}
fn vlq(bytes: &[u8], cursor: &mut usize) -> Result<u32, String> {
    let mut value = 0;
    for _ in 0..4 {
        let byte = take(bytes, cursor)?;
        value = (value << 7) | u32::from(byte & 0x7f);
        if byte & 0x80 == 0 { return Ok(value); }
    }
    Err("MIDI VLQ exceeds four bytes".into())
}
fn payload<'a>(bytes: &'a [u8], cursor: &mut usize, length: usize) -> Result<&'a [u8], String> {
    let end = cursor.checked_add(length).ok_or("MIDI payload overflow")?;
    let content = bytes.get(*cursor..end).ok_or("MIDI payload exceeds track bytes")?;
    *cursor = end;
    Ok(content)
}
#[derive(Default)]
struct Track {
    ticks: u64,
    events: usize,
    notes: usize,
    channel_events: usize,
    meta_events: usize,
    sysex_events: usize,
    tempos: Vec<(u64, u32)>,
}

fn track(bytes: &[u8], index: usize, format: u16, global_events: &mut usize) -> Result<Track, String> {
    let mut result = Track::default();
    let mut cursor = 0usize;
    let mut running_status = None;
    let mut ended = false;
    let mut voices = [[0u16; 128]; 16];
    while cursor < bytes.len() {
        *global_events += 1;
        result.events += 1;
        if *global_events > 4096 { return Err("MIDI event budget exceeds 4096".into()); }
        result.ticks = result.ticks.checked_add(u64::from(vlq(bytes, &mut cursor)?)).ok_or("MIDI tick overflow")?;
        if result.ticks > 16000000 { return Err("MIDI tick count exceeds bounded receipt policy".into()); }
        let first = *bytes.get(cursor).ok_or("missing MIDI status")?;
        let status = if first >= 0x80 {
            cursor += 1;
            if first < 0xf0 { running_status = Some(first); } else { running_status = None; }
            first
        } else { running_status.ok_or("MIDI data byte has no running status")? };
        match status {
            0x80..=0xef => {
                result.channel_events += 1;
                let kind = status & 0xf0;
                let channel = usize::from(status & 0x0f);
                let count = if kind == 0xc0 || kind == 0xd0 { 1 } else { 2 };
                let data = payload(bytes, &mut cursor, count)?;
                if data.iter().any(|b| *b >= 0x80) { return Err("MIDI channel data contains a status byte".into()); }
                if kind == 0x90 && data[1] > 0 {
                    let note = usize::from(data[0]);
                    voices[channel][note] = voices[channel][note].checked_add(1).ok_or("MIDI voice count overflow")?;
                    result.notes += 1;
                    if result.notes > 256 { return Err("MIDI note budget exceeds 256 per track".into()); }
                } else if kind == 0x80 || (kind == 0x90 && data[1] == 0) {
                    let voice = &mut voices[channel][usize::from(data[0])];
                    if *voice == 0 { return Err("receipt policy requires each note-off to match a note-on".into()); }
                    *voice -= 1;
                }
            }
            0xff => {
                result.meta_events += 1;
                let kind = take(bytes, &mut cursor)?;
                if kind >= 0x80 { return Err("MIDI meta type must be a data byte".into()); }
                let length = vlq(bytes, &mut cursor)? as usize;
                let content = payload(bytes, &mut cursor, length)?;
                match kind {
                    0x2f => {
                        if length != 0 || cursor != bytes.len() { return Err("end-of-track must be empty and last".into()); }
                        ended = true;
                    }
                    0x51 => {
                        if length != 3 { return Err("tempo meta event requires three bytes".into()); }
                        let tempo = u32::from(content[0]) << 16 | u32::from(content[1]) << 8 | u32::from(content[2]);
                        if tempo == 0 || (format == 1 && index != 0) { return Err("invalid tempo or tempo outside track zero".into()); }
                        if result.tempos.len() >= 128 { return Err("MIDI tempo event budget exceeds 128".into()); }
                        result.tempos.push((result.ticks, tempo));
                    }
                    0x58 => {
                        if length != 4 || content[0] == 0 || content[1] > 7 { return Err("unsupported MIDI time signature".into()); }
                    }
                    0x59 => {
                        if length != 2 || !(-7..=7).contains(&(content[0] as i8)) || content[1] > 1 {
                            return Err("invalid MIDI key signature".into());
                        }
                    }
                    0x20 => if length != 1 || content[0] > 15 { return Err("invalid MIDI channel prefix".into()); },
                    0x21 => if length != 1 || content[0] > 127 { return Err("invalid MIDI port".into()); },
                    0x00 => if length != 0 && length != 2 { return Err("invalid MIDI sequence number".into()); },
                    _ => (),
                }
            }
            0xf0 | 0xf7 => {
                result.sysex_events += 1;
                let length = vlq(bytes, &mut cursor)? as usize;
                payload(bytes, &mut cursor, length)?;
            }
            _ => return Err("unsupported status in Standard MIDI File".into()),
        }
    }
    if !ended { return Err("missing MIDI end-of-track".into()); }
    if voices.iter().flatten().any(|v| *v != 0) { return Err("MIDI track leaves notes active".into()); }
    Ok(result)
}

pub fn inspect(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() < 26 || bytes.len() > 128 * 1024 { return Err("MIDI byte count is outside bounded receipt policy".into()); }
    if bytes.get(0..4) != Some(b"MThd") || big32(bytes, 4)? != 6 { return Err("expected a six-byte Standard MIDI header".into()); }
    let format = big16(bytes, 8)?;
    let count = big16(bytes, 10)?;
    let division = big16(bytes, 12)?;
    if format > 1 || count == 0 || count > 16 || (format == 0 && count != 1) {
        return Err("receipt supports MIDI format zero/one with 1 to 16 tracks".into());
    }
    if division == 0 || division & 0x8000 != 0 { return Err("receipt supports positive PPQ timing, not SMPTE division".into()); }
    let mut cursor = 14usize;
    let mut tracks = Vec::new();
    let mut events = 0usize;
    let mut notes = 0usize;
    let mut maximum_tick = 0u64;
    let mut tempos = Vec::new();
    for index in 0..usize::from(count) {
        let header = payload(bytes, &mut cursor, 8)?;
        if header.get(0..4) != Some(b"MTrk") { return Err("missing declared MIDI track chunk".into()); }
        let length = big32(header, 4)? as usize;
        let result = track(payload(bytes, &mut cursor, length)?, index, format, &mut events)?;
        maximum_tick = maximum_tick.max(result.ticks);
        notes += result.notes;
        if notes > 256 { return Err("MIDI total note budget exceeds 256".into()); }
        if index == 0 { tempos = result.tempos; }
        tracks.push(json!({"index": index, "endTick": result.ticks, "events": result.events,
            "noteOns": result.notes, "channelEvents": result.channel_events,
            "metaEvents": result.meta_events, "sysexEvents": result.sysex_events}));
    }
    if cursor != bytes.len() { return Err("MIDI contains undeclared trailing chunks or bytes".into()); }
    let mut previous = 0u64;
    let mut tempo = 500000u32;
    let mut microseconds = 0.0;
    for (at, next) in &tempos {
        microseconds += (at - previous) as f64 * f64::from(tempo) / f64::from(division);
        previous = *at; tempo = *next;
    }
    microseconds += (maximum_tick - previous) as f64 * f64::from(tempo) / f64::from(division);
    // The C++ writer rounds PPQ ticks; at its slowest tempo one tick is < 5 ms.
    if microseconds > 20005000.0 { return Err("MIDI timeline exceeds 20 seconds plus 5 ms quantization allowance".into()); }
    Ok(json!({"valid": true, "format": format, "trackCount": count, "divisionPpq": division,
        "events": events, "noteOns": notes, "endTick": maximum_tick,
        "durationMs": microseconds / 1000.0, "tempoEvents": tempos.len(),
        "fileBytes": bytes.len(), "tracks": tracks,
        "scope": "bounded SMF0/SMF1, PPQ timing, balanced notes; not a MIDI device execution"}))
}

#[cfg(test)]
mod tests {
    use super::inspect;
    fn wrap(track: &[u8]) -> Vec<u8> {
        let mut b = b"MThd\0\0\0\x06\0\0\0\x01\x01\xe0MTrk".to_vec();
        b.extend((track.len() as u32).to_be_bytes()); b.extend(track); b
    }
    #[test]
    fn parses_notes_tempo_and_duration() {
        let b = wrap(&[0, 255, 81, 3, 7, 161, 32, 0, 144, 69, 100, 0x83, 0x60, 128, 69, 0, 0, 255, 47, 0]);
        let result = inspect(&b).unwrap();
        assert_eq!(result["noteOns"], 1); assert_eq!(result["durationMs"], 500.0);
    }
    #[test]
    fn supports_channel_running_status() {
        let b = wrap(&[0, 144, 60, 100, 1, 60, 0, 0, 255, 47, 0]);
        assert_eq!(inspect(&b).unwrap()["noteOns"], 1);
    }
    #[test]
    fn rejects_five_byte_vlq_and_hanging_notes() {
        assert!(inspect(&wrap(&[128, 128, 128, 128, 0, 255, 47, 0])).is_err());
        assert!(inspect(&wrap(&[0, 144, 60, 100, 0, 255, 47, 0])).is_err());
    }
    #[test]
    fn rejects_wrong_track_lengths_and_missing_eot() {
        let mut b = wrap(&[0, 255, 47, 0]); b[21] = 99; assert!(inspect(&b).is_err());
        assert!(inspect(&wrap(&[0, 192, 1])).is_err());
    }
    #[test]
    fn rejects_data_without_status_and_nonempty_eot() {
        assert!(inspect(&wrap(&[0, 60, 0, 0, 255, 47, 0])).is_err());
        assert!(inspect(&wrap(&[0, 255, 47, 1, 0])).is_err());
    }
}
