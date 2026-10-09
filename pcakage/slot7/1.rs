use std::io::{Read, Write};
fn main() {
    let mut invoice = Vec::new();
    let read = std::io::stdin().take(262145).read_to_end(&mut invoice);
    let result = if read.is_err() || invoice.len() > 262144 {
        br#"{"schema":"ocv.workshop-result/1","ok":false,"diagnostics":[{"code":"INPUT_LIMIT","message":"JSON input is limited to 256 KiB"}]}"#.to_vec()
    } else { slot7::run_bytes(&invoice) };
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(&result); let _ = out.write_all(b"\n");
}
