use crate::common::{Answer, Data, Issue, integer, number};
use std::f64::consts::TAU;

// The receipt is not a waveform cache: every cell below runs the same bounded
// sampled channel as a single transmission. One seed supplies common random
// numbers across the scan; cells are correlated, not independent trials.
struct Noise { state: u64, spare: Option<f64> }
impl Noise {
    fn uniform(&mut self) -> f64 {
        self.state ^= self.state >> 12; self.state ^= self.state << 25; self.state ^= self.state >> 27;
        ((self.state.wrapping_mul(2685821657736338717) >> 11) as f64 + 0.5) / 9007199254740992.0
    }
    fn gaussian(&mut self) -> f64 {
        if let Some(value) = self.spare.take() { return value; }
        let radius = (-2.0 * self.uniform().ln()).sqrt(); let angle = TAU * self.uniform();
        self.spare = Some(radius * angle.sin()); radius * angle.cos()
    }
}

pub fn crc16(bits: &[u8]) -> u16 {
    let mut crc = 0xffffu16;
    for &bit in bits { let high = ((crc >> 15) & 1) as u8 ^ bit; crc <<= 1; if high != 0 { crc ^= 0x1021; } }
    crc
}
fn binary(bits: &[u8]) -> String { bits.iter().map(|bit| char::from(b'0' + bit)).collect() }
fn flag(input: &Data, key: &str, fallback: bool) -> Answer<bool> {
    match input.get(key) { Data::Null => Ok(fallback), Data::Flag(value) => Ok(*value), _ => Err(Issue::new("MODEL", format!("{key} must be boolean."))) }
}
fn text<'a>(input: &'a Data, key: &str, default: &'a str, supported: &[&str]) -> Answer<&'a str> {
    let value = match input.get(key) { Data::Null => default, Data::Text(value) => value, _ => return Err(Issue::new("MODEL", format!("{key} must be text."))) };
    if !supported.contains(&value) { return Err(Issue::new("UNSUPPORTED", format!("Unsupported {key}: {value}."))); } Ok(value)
}
fn interval(errors: usize, count: usize) -> Data {
    let n = count as f64; let p = errors as f64 / n; let z = 1.959963984540054; let d = 1.0 + z * z / n;
    let center = (p + z * z / (2.0 * n)) / d; let radius = z * (p * (1.0 - p) / n + z * z / (4.0 * n * n)).sqrt() / d;
    Data::object([("lower", (center - radius).max(0.0).into()), ("upper", (center + radius).min(1.0).into()), ("confidence", 0.95.into()), ("method", "Wilson score / finite payload bits".into())])
}
fn shift(samples: &[(f64, f64)], position: f64) -> (f64, f64) {
    let at = position.floor() as isize; let fraction = position - position.floor();
    let item = |index: isize| samples.get(index as usize).copied().unwrap_or((0.0, 0.0));
    let a = item(at); let b = item(at + 1); (a.0 * (1.0 - fraction) + b.0 * fraction, a.1 * (1.0 - fraction) + b.1 * fraction)
}
fn waterfall(samples: &[(f64, f64)], rate: f64) -> Data {
    let width = samples.len().min(64); let frames = ((samples.len() + width - 1) / width).min(12);
    let mut rows = Vec::new(); let mut minimum = f64::INFINITY; let mut maximum = f64::NEG_INFINITY;
    for frame in 0..frames {
        let start = if frames > 1 { frame * (samples.len() - width) / (frames - 1) } else { 0 };
        for column in 0..width {
            let bin = column as isize - (width / 2) as isize; let mut real = 0.0; let mut imaginary = 0.0;
            for sample in 0..width {
                let window = if width > 1 { 0.5 - 0.5 * (TAU * sample as f64 / (width - 1) as f64).cos() } else { 1.0 };
                let angle = TAU * bin as f64 * sample as f64 / width as f64; let (i, q) = samples[start + sample];
                real += window * (i * angle.cos() + q * angle.sin()); imaginary += window * (q * angle.cos() - i * angle.sin());
            }
            let power = 10.0 * ((real * real + imaginary * imaginary) / (width * width) as f64).max(1e-14).log10();
            minimum = minimum.min(power); maximum = maximum.max(power);
            rows.push(Data::object([("frame", frame.into()), ("bin", column.into()), ("t", ((start + width / 2) as f64 / rate).into()), ("frequencyHz", (bin as f64 * rate / width as f64).into()), ("powerDb", power.into())]));
        }
    }
    Data::object([("rows", Data::List(rows)), ("frames", frames.into()), ("bins", width.into()), ("windowSamples", width.into()), ("minimumDb", minimum.into()), ("maximumDb", maximum.into()), ("normalization", "Complex Hann STFT: 10 log10(|X/N|^2); not PSD, windows may overlap".into())])
}

fn single(input: &Data, visual: bool) -> Answer<Data> {
    let crc = text(input, "crc", "CRC-8", &["CRC-8", "CRC-16"])?;
    let modulation = text(input, "modulation", "BPSK", &["BPSK", "QPSK", "BFSK"])?;
    let line = text(input, "lineCode", "NRZ", &["NRZ", "Manchester"])?;
    let source = match input.get("bits") { Data::Null => "1011001010110001", Data::Text(bits) => bits, _ => return Err(Issue::new("MODEL", "Payload bits must be text.")) };
    if source.is_empty() || source.len() > 32760 || !source.bytes().all(|bit| bit == b'0' || bit == b'1') { return Err(Issue::new("LIMIT", "Payload requires 1 to 32760 binary digits.")); }
    let payload: Vec<u8> = source.bytes().map(|bit| bit - b'0').collect(); let crc_width = if crc == "CRC-16" { 16 } else { 8 };
    let checksum = if crc_width == 16 { crc16(&payload) } else { crate::old::crc8(&payload) as u16 };
    let mut frame = payload.clone(); frame.extend((0..crc_width).rev().map(|bit| ((checksum >> bit) & 1) as u8));
    let seed = integer(input, "seed", 42, 0, 4294967295)?; let sps = integer(input, "samplesPerSymbol", 8, 2, 32)?;
    if modulation == "BFSK" && sps < 4 { return Err(Issue::new("LIMIT", "Orthogonal binary FSK requires at least four samples per symbol.")); }
    let fs = number(input, "sampleRateHz", 8000.0)?; let eb = number(input, "ebN0Db", 8.0)?;
    let timing = number(input, "timingOffsetSymbols", 0.0)?; let offset = number(input, "frequencyOffsetHz", 0.0)?;
    if !(1.0..=1e9).contains(&fs) || !(-30.0..=60.0).contains(&eb) || !(-0.45..=0.45).contains(&timing) || offset.abs() > fs / sps as f64 * 0.25 {
        return Err(Issue::new("LIMIT", "Channel bounds: fs 1–1e9 Hz, Eb/N0 −30–60 dB, timing ±0.45 symbols, frequency ±0.25 symbol rate."));
    }
    let noiseless = flag(input, "noiseless", false)?; let sigma = if noiseless { 0.0 } else { (0.5 / 10f64.powf(eb / 10.0)).sqrt() };
    let code_length = if line == "Manchester" { 2 } else { 1 };
    let mut chips = Vec::with_capacity(frame.len() * code_length);
    for &bit in &frame { chips.push(bit); if code_length == 2 { chips.push(1 - bit); } }
    let chip_count = chips.len(); let symbol_bits = if modulation == "QPSK" { 2 } else { 1 };
    let padding = (symbol_bits - chips.len() % symbol_bits) % symbol_bits; chips.extend(std::iter::repeat(0).take(padding));
    let symbols = chips.len() / symbol_bits; let sample_count = symbols * sps;
    if sample_count > 32768 { return Err(Issue::new("LIMIT", "Waveform exceeds 32768 complex samples (bounded raw result and ABI response).")); }
    let scale = 1.0 / ((sps * code_length) as f64).sqrt();
    let mut transmitted = Vec::with_capacity(sample_count);
    for symbol in 0..symbols {
        let a = if chips[symbol * symbol_bits] == 0 { -1.0 } else { 1.0 };
        let b = if symbol_bits == 2 && chips[symbol * symbol_bits + 1] != 0 { 1.0 } else { -1.0 };
        for sample in 0..sps {
            transmitted.push(match modulation {
                "QPSK" => (a * scale, b * scale),
                "BFSK" => { let angle = TAU * (chips[symbol] as f64 + 1.0) * sample as f64 / sps as f64; (scale * angle.cos(), scale * angle.sin()) },
                _ => (a * scale, 0.0)
            });
        }
    }
    let mut random = Noise { state: if seed == 0 { 0x9e3779b97f4a7c15 } else { seed as u64 }, spare: None };
    let mut received = Vec::with_capacity(sample_count); let mut waves = Vec::new(); let mut eye = Vec::new(); let mut encoded_wave = Vec::new();
    for index in 0..sample_count {
        let delayed = shift(&transmitted, index as f64 - timing * sps as f64); let angle = TAU * offset * index as f64 / fs;
        let sample = (delayed.0 * angle.cos() - delayed.1 * angle.sin() + sigma * random.gaussian(), delayed.0 * angle.sin() + delayed.1 * angle.cos() + sigma * random.gaussian());
        received.push(sample);
        if visual {
            waves.push(Data::object([("t", (index as f64 / fs).into()), ("tx", transmitted[index].0.into()), ("txQ", transmitted[index].1.into()), ("rx", sample.0.into()), ("q", sample.1.into())]));
            let symbol = index / sps; if symbol < 256 { eye.push(Data::object([("phase", ((index % (2 * sps)) as f64 / sps as f64).into()), ("rx", sample.0.into()), ("q", sample.1.into()), ("index", (symbol / 2).into())])); }
            let chip = chips[(symbol * symbol_bits + (index % sps) * symbol_bits / sps).min(chip_count - 1)];
            if index < 2048 { encoded_wave.push(Data::object([("t", (index as f64 / fs).into()), ("value", (if chip == 0 { -1.0 } else { 1.0 }).into())])); }
        }
    }
    let mut metrics = Vec::with_capacity(chips.len()); let mut constellation = Vec::new();
    for symbol in 0..symbols {
        let samples = &received[symbol * sps..(symbol + 1) * sps];
        let (i, q) = if modulation == "BFSK" {
            let mut values = [0.0; 2];
            for tone in 0..2 { let mut re = 0.0; let mut im = 0.0; for (index, &(a, b)) in samples.iter().enumerate() { let phase = TAU * (tone + 1) as f64 * index as f64 / sps as f64; re += (a * phase.cos() + b * phase.sin()) / (sps as f64).sqrt(); im += (b * phase.cos() - a * phase.sin()) / (sps as f64).sqrt(); } values[tone] = re.hypot(im); }
            metrics.push(values[1] - values[0]); (values[0], values[1])
        } else {
            let i = samples.iter().map(|sample| sample.0 * scale).sum::<f64>(); let q = samples.iter().map(|sample| sample.1 * scale).sum::<f64>(); metrics.push(i); if symbol_bits == 2 { metrics.push(q); } (i, q)
        };
        if visual { constellation.push(Data::object([("i", i.into()), ("q", q.into()), ("bit", (chips[symbol * symbol_bits] as usize).into()), ("index", symbol.into())])); }
    }
    metrics.truncate(chip_count); let mut decoded = Vec::with_capacity(frame.len()); let mut code_violations = 0;
    for bit in 0..frame.len() {
        let decision = if code_length == 2 { let a = metrics[2 * bit]; let b = metrics[2 * bit + 1]; if (a >= 0.0) == (b >= 0.0) { code_violations += 1; } a - b } else { metrics[bit] };
        decoded.push(if decision >= 0.0 { 1 } else { 0 });
    }
    let recovered = &decoded[..payload.len()]; let payload_errors = payload.iter().zip(recovered).filter(|(a,b)| a != b).count(); let frame_errors = frame.iter().zip(&decoded).filter(|(a,b)| a != b).count();
    let check_received = decoded[payload.len()..].iter().fold(0u16, |value, bit| (value << 1) | *bit as u16);
    let check_expected = if crc_width == 16 { crc16(recovered) } else { crate::old::crc8(recovered) as u16 };
    let ideal_scale = 1.0 / code_length as f64;
    let ideal = if modulation == "QPSK" { vec![(-ideal_scale,-ideal_scale),(-ideal_scale,ideal_scale),(ideal_scale,-ideal_scale),(ideal_scale,ideal_scale)] } else if modulation == "BFSK" { vec![(ideal_scale.sqrt(),0.0),(0.0,ideal_scale.sqrt())] } else { vec![(-ideal_scale,0.0),(ideal_scale,0.0)] };
    let mut output = Data::object([
        ("payloadBits", binary(&payload).into()), ("decodedBits", binary(recovered).into()), ("txBits", binary(&frame).into()), ("rxBits", binary(&decoded).into()),
        ("encodedBits", binary(&chips[..chip_count]).into()), ("crcValid", (check_expected == check_received).into()), ("bitErrors", payload_errors.into()), ("frameBitErrors", frame_errors.into()),
        ("ber", (payload_errors as f64 / payload.len() as f64).into()), ("payloadLength", payload.len().into()), ("frameLength", frame.len().into()), ("interval", interval(payload_errors,payload.len())),
        ("waveform", Data::List(waves)), ("constellation", Data::List(constellation)), ("eye", Data::List(eye)), ("lineWaveform", Data::List(encoded_wave)),
        ("idealConstellation", Data::List(ideal.iter().map(|&(i,q)| Data::object([("i",i.into()),("q",q.into())])).collect())),
        ("summary", Data::object([
            ("seed", seed.into()), ("sigma",sigma.into()), ("ebN0Db",eb.into()), ("samplesPerSymbol",sps.into()), ("sampleRateHz",fs.into()), ("symbolRateHz",(fs/sps as f64).into()),
            ("durationS",(sample_count as f64/fs).into()), ("symbols",symbols.into()), ("encodedChips",chip_count.into()), ("paddingBits",padding.into()), ("lineDisplaySamples",sample_count.min(2048).into()), ("noiseless",noiseless.into()),
            ("crc",crc.into()), ("crcPolynomial",(if crc_width==16 {"0x1021"}else{"0x07"}).into()), ("crcInit",(if crc_width==16 {65535.0}else{0.0}).into()), ("crcXorOut",0.0.into()),
            ("modulation",modulation.into()), ("lineCode",line.into()), ("lineCodeViolations",code_violations.into()), ("timingOffsetSymbols",timing.into()), ("frequencyOffsetHz",offset.into()),
            ("constellationAxes",(if modulation=="BFSK" {"tone-0 magnitude / tone-1 magnitude"}else{"matched I / matched Q"}).into()),
            ("channel","Seeded complex AWGN; unit energy per frame bit; rectangular pulses; linear fractional sample delay; fixed receiver clock and carrier; no tracking, fading, RF PHY or ISI filter".into()),
            ("receiver",(if modulation=="BFSK" {"orthogonal tones 1/T, 2/T; noncoherent correlator-magnitude comparison"}else{"coherent rectangular matched filter; Gray QPSK sign decisions"}).into())
        ]))
    ]);
    if let Data::Receipt(ref mut map) = output { if visual { map.insert("waterfall".into(), waterfall(&received,fs)); } if input.map().is_some_and(|source|source.contains_key("rf")) { map.insert("linkBudget".into(),crate::old::link_budget(input.get("rf"))?); } }
    Ok(output)
}

fn axis(value: &Data, key: &str) -> Answer<(String, Vec<f64>)> {
    let name = text(value,key, "ebN0Db", &["ebN0Db","timingOffsetSymbols","frequencyOffsetHz"])?;
    let list_key = if key=="axis" {"values"}else{"secondaryValues"};
    let values = value.get(list_key).list().ok_or_else(||Issue::new("SWEEP",format!("{list_key} must be an array.")))?;
    if values.is_empty() || values.len()>7 { return Err(Issue::new("LIMIT","Each sweep axis requires 1 to 7 values.")); }
    let values = values.iter().map(|value|value.number().filter(|x|x.is_finite()).ok_or_else(||Issue::new("SWEEP","Sweep values must be finite numbers."))).collect::<Answer<Vec<_>>>()?;
    if values.windows(2).any(|pair|pair[1]<=pair[0]) { return Err(Issue::new("SWEEP","Sweep values must be strictly increasing.")); } Ok((name.into(),values))
}
pub fn run(input:&Data)->Answer<Data> {
    let mut result=single(input,true)?;
    if let Some(scan)=input.map().and_then(|map|map.get("sweep")) {
        if scan.map().is_none() { return Err(Issue::new("SWEEP","sweep must be an axis definition.")); }
        let (x,values)=axis(scan,"axis")?;
        let secondary=if scan.map().is_some_and(|map|map.contains_key("secondaryAxis")){Some(axis(scan,"secondaryAxis")?)}else{None};
        if secondary.as_ref().is_some_and(|(name,_)|name==&x) { return Err(Issue::new("SWEEP","Sweep axes must be distinct.")); }
        if result.get("waveform").list().unwrap().len()>8192 { return Err(Issue::new("LIMIT","Scans require at most 8192 samples per candidate.")); }
        let y=secondary.as_ref().map(|(_,values)|values.clone()).unwrap_or(vec![0.0]); let mut cells=Vec::new();
        for (row,&b) in y.iter().enumerate() { for (column,&a) in values.iter().enumerate() {
            let mut request=input.clone(); if let Data::Receipt(ref mut map)=request { map.remove("sweep"); map.insert(x.clone(),a.into()); if let Some((name,_))=&secondary { map.insert(name.clone(),b.into()); } }
            let output=single(&request,false)?;
            cells.push(Data::object([("row",row.into()),("column",column.into()),("x",a.into()),("y",b.into()),("bitErrors",output.get("bitErrors").clone()),("payloadLength",output.get("payloadLength").clone()),("ber",output.get("ber").clone()),("crcValid",output.get("crcValid").clone()),("interval",output.get("interval").clone()),("summary",output.get("summary").clone())]));
        } }
        if let Data::Receipt(ref mut map)=result { map.insert("sweep".into(),Data::object([("axis",x.into()),("secondaryAxis",secondary.as_ref().map(|(name,_)|name.clone().into()).unwrap_or(Data::Null)),("values",Data::List(values.iter().map(|x|(*x).into()).collect())),("secondaryValues",Data::List(y.iter().map(|x|(*x).into()).collect())),("cases",cells.len().into()),("cells",Data::List(cells)),("seedPolicy","same seed / common random numbers; correlated cells".into()),("executed",true.into())])); }
    }
    Ok(result)
}

#[cfg(test)] mod tests {
    use super::*;
    fn request(modulation:&str,line:&str,crc:&str)->Data { Data::object([("bits","1010011001011".into()),("modulation",modulation.into()),("lineCode",line.into()),("crc",crc.into()),("noiseless",true.into()),("samplesPerSymbol",8usize.into())]) }
    #[test] fn crc16_ccitt_false_check() { let bits=b"123456789".iter().flat_map(|byte|(0..8).rev().map(move|shift|(byte>>shift)&1)).collect::<Vec<_>>();assert_eq!(crc16(&bits),0x29b1); }
    #[test] fn all_modulation_code_crc_roundtrips() { for modulation in ["BPSK","QPSK","BFSK"] {for line in ["NRZ","Manchester"] {for crc in ["CRC-8","CRC-16"] {let input=request(modulation,line,crc);let output=run(&input).unwrap();assert_eq!(output.get("bitErrors").number(),Some(0.0),"{modulation}/{line}/{crc}");assert_eq!(output.get("crcValid").flag(),Some(true));assert_eq!(output.get("decodedBits").text(),input.get("bits").text());}}} }
    #[test] fn sampled_energy_matches_frame_bit_energy() { for modulation in ["BPSK","QPSK","BFSK"] {for line in ["NRZ","Manchester"] {let output=run(&request(modulation,line,"CRC-16")).unwrap();let energy=output.get("waveform").list().unwrap().iter().map(|row|row.get("tx").number().unwrap().powi(2)+row.get("txQ").number().unwrap().powi(2)).sum::<f64>();let padding=output.get("summary").get("paddingBits").number().unwrap();let expected=output.get("frameLength").number().unwrap()+padding/(if line=="NRZ"{1.0}else{2.0});assert!((energy-expected).abs()<1e-9);}} }
    #[test] fn legacy_bpsk_awgn_samples_and_decisions_are_retained() {let input=crate::common::decode(r#"{"bits":"011000101001","seed":19,"ebN0Db":-1,"samplesPerSymbol":2}"#).unwrap();let old=crate::old::run(&input).unwrap();let new=run(&input).unwrap();for key in ["txBits","rxBits","decodedBits","ber","bitErrors","frameBitErrors"]{assert_eq!(old.get(key),new.get(key));}let old_rows=old.get("waveform").list().unwrap();let new_rows=new.get("waveform").list().unwrap();assert_eq!(old_rows.len(),new_rows.len());for(a,b)in old_rows.iter().zip(new_rows){for key in ["t","tx","rx","q"]{assert_eq!(a.get(key),b.get(key));}}}
    #[test] fn seeded_noise_and_offset_scans_are_reproducible() {let input=crate::common::decode(r#"{"bits":"1010100110101100","modulation":"QPSK","lineCode":"Manchester","crc":"CRC-16","seed":17,"ebN0Db":2,"timingOffsetSymbols":0.125,"frequencyOffsetHz":20,"sweep":{"axis":"ebN0Db","values":[0,4,8],"secondaryAxis":"timingOffsetSymbols","secondaryValues":[-0.25,0,0.25]}}"#).unwrap();let a=run(&input).unwrap();assert_eq!(a,run(&input).unwrap());assert_eq!(a.get("sweep").get("cases").number(),Some(9.0));assert_eq!(a.get("waterfall").get("rows").list().unwrap().len(),a.get("waterfall").get("frames").number().unwrap() as usize*64);}
    #[test] fn rejects_unsupported_and_unbounded_scans() {for input in [r#"{"timingOffsetSymbols":0.5}"#,r#"{"frequencyOffsetHz":999}"#,r#"{"modulation":"OFDM"}"#,r#"{"sweep":{"axis":"ebN0Db","values":[1,1]}}"#] {assert!(run(&crate::common::decode(input).unwrap()).is_err());}}
}
