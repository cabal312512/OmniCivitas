use std::io::{self,Read};
fn main(){
    let mut input=String::new();let _=io::stdin().take(2097153).read_to_string(&mut input);
    println!("{}",desk4::run_json(&input));
}
