use std::collections::BTreeMap;

#[derive(Clone,Debug,PartialEq)]
pub enum Data { Null, Flag(bool), Price(f64), Text(String), List(Vec<Data>), Receipt(BTreeMap<String,Data>) }
impl Data {
    pub fn get(&self,key:&str)->&Data {static EMPTY:Data=Data::Null;match self{Self::Receipt(map)=>map.get(key).unwrap_or(&EMPTY),_=>&EMPTY}}
    pub fn text(&self)->Option<&str>{if let Self::Text(s)=self{Some(s)}else{None}}
    pub fn number(&self)->Option<f64>{if let Self::Price(x)=self{Some(*x)}else{None}}
    pub fn flag(&self)->Option<bool>{if let Self::Flag(x)=self{Some(*x)}else{None}}
    pub fn list(&self)->Option<&[Data]>{if let Self::List(a)=self{Some(a)}else{None}}
    pub fn map(&self)->Option<&BTreeMap<String,Data>>{if let Self::Receipt(a)=self{Some(a)}else{None}}
    pub fn object(items:impl IntoIterator<Item=(&'static str,Data)>)->Data{Data::Receipt(items.into_iter().map(|(k,v)|(k.to_string(),v)).collect())}
}
impl From<&str> for Data{fn from(s:&str)->Self{Self::Text(s.to_string())}}
impl From<String> for Data{fn from(s:String)->Self{Self::Text(s)}}
impl From<f64> for Data{fn from(x:f64)->Self{Self::Price(x)}}
impl From<usize> for Data{fn from(x:usize)->Self{Self::Price(x as f64)}}
impl From<bool> for Data{fn from(x:bool)->Self{Self::Flag(x)}}
#[derive(Debug)]
pub struct Issue {pub code:&'static str,pub message:String}
impl Issue {pub fn new(code:&'static str,message:impl Into<String>)->Self{Self{code,message:message.into()}}}
pub type Answer<T>=Result<T,Issue>;

struct Config<'a>{bytes:&'a[u8],at:usize,tokens:usize}
impl<'a> Config<'a>{
    fn next(&mut self)->Answer<u8>{let b=self.bytes.get(self.at).copied().ok_or_else(||Issue::new("JSON","Unexpected end of JSON."))?;self.at+=1;Ok(b)}
    fn ws(&mut self){while self.bytes.get(self.at).is_some_and(|c|matches!(c,b' '|b'\n'|b'\r'|b'\t')){self.at+=1;}}
    fn hex4(&mut self)->Answer<u32>{let mut x=0;for _ in 0..4{let c=self.next()?;x=(x<<4)+match c{b'0'..=b'9'=>(c-b'0')as u32,b'a'..=b'f'=>(c-b'a'+10)as u32,b'A'..=b'F'=>(c-b'A'+10)as u32,_=>return Err(Issue::new("JSON","Invalid Unicode escape."))};}Ok(x)}
    fn string(&mut self)->Answer<String>{
        if self.next()?!=b'"'{return Err(Issue::new("JSON","Expected a string."));}let mut bytes=Vec::new();
        loop{let c=self.next()?;if c==b'"'{break;}if c<32{return Err(Issue::new("JSON","Control character in string."));}
            if c!=b'\\'{bytes.push(c);}else{match self.next()?{b'"'=>bytes.push(b'"'),b'\\'=>bytes.push(b'\\'),b'/'=>bytes.push(b'/'),b'n'=>bytes.push(10),b'r'=>bytes.push(13),b't'=>bytes.push(9),b'b'=>bytes.push(8),b'f'=>bytes.push(12),b'u'=>{
                let mut x=self.hex4()?;if(0xd800..=0xdbff).contains(&x){if self.next()?!=b'\\'||self.next()?!=b'u'{return Err(Issue::new("JSON","Unpaired Unicode surrogate."));}let y=self.hex4()?;if !(0xdc00..=0xdfff).contains(&y){return Err(Issue::new("JSON","Unpaired Unicode surrogate."));}x=0x10000+((x-0xd800)<<10)+(y-0xdc00);}
                let ch=char::from_u32(x).ok_or_else(||Issue::new("JSON","Invalid Unicode scalar."))?;let mut buf=[0u8;4];bytes.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
            },_=>return Err(Issue::new("JSON","Invalid escape."))}}
            if bytes.len()>65536{return Err(Issue::new("LIMIT","JSON string exceeds 65536 bytes."));}
        }String::from_utf8(bytes).map_err(|_|Issue::new("JSON","Invalid UTF-8."))
    }
    fn value(&mut self,depth:usize)->Answer<Data>{
        self.ws();self.tokens+=1;if depth>48||self.tokens>100000{return Err(Issue::new("LIMIT","JSON structure exceeds limits."));}
        let c=*self.bytes.get(self.at).ok_or_else(||Issue::new("JSON","Missing JSON value."))?;
        if c==b'"'{return self.string().map(Data::Text);}
        if c==b'{'||c==b'['{self.at+=1;let end=if c==b'{'{b'}'}else{b']'};let mut array=Vec::new();let mut object=BTreeMap::new();self.ws();if self.bytes.get(self.at)==Some(&end){self.at+=1;}else{loop{
            if c==b'{'{self.ws();let key=self.string()?;self.ws();if self.next()?!=b':'{return Err(Issue::new("JSON","Missing colon."));}let value=self.value(depth+1)?;if object.insert(key,value).is_some(){return Err(Issue::new("JSON","Duplicate JSON key."));}}
            else{array.push(self.value(depth+1)?);}self.ws();let next=self.next()?;if next==end{break;}if next!=b','{return Err(Issue::new("JSON","Missing comma."));}
        }}
        return Ok(if c==b'{'{Data::Receipt(object)}else{Data::List(array)});}
        for(word,value)in[("true",Data::Flag(true)),("false",Data::Flag(false)),("null",Data::Null)]{if self.bytes[self.at..].starts_with(word.as_bytes()){self.at+=word.len();return Ok(value);}}
        let start=self.at;if c==b'-'{self.at+=1;}match self.bytes.get(self.at){Some(b'0')=>self.at+=1,Some(b'1'..=b'9')=>while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit){self.at+=1;},_=>return Err(Issue::new("JSON","Expected finite number."))}
        if self.bytes.get(self.at)==Some(&b'.'){self.at+=1;let fraction=self.at;while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit){self.at+=1;}if fraction==self.at{return Err(Issue::new("JSON","Invalid fraction."));}}
        if self.bytes.get(self.at).is_some_and(|c|*c==b'e'||*c==b'E'){self.at+=1;if self.bytes.get(self.at).is_some_and(|c|*c==b'+'||*c==b'-'){self.at+=1;}let exp=self.at;while self.bytes.get(self.at).is_some_and(u8::is_ascii_digit){self.at+=1;}if exp==self.at{return Err(Issue::new("JSON","Invalid exponent."));}}
        let number=std::str::from_utf8(&self.bytes[start..self.at]).unwrap().parse::<f64>().map_err(|_|Issue::new("JSON","Invalid number."))?;if !number.is_finite(){return Err(Issue::new("JSON","Non-finite number."));}Ok(Data::Price(number))
    }
}
pub fn decode(text:&str)->Answer<Data>{if text.len()>2097152{return Err(Issue::new("LIMIT","Input exceeds 2 MiB."));}let mut c=Config{bytes:text.as_bytes(),at:0,tokens:0};let data=c.value(0)?;c.ws();if c.at!=text.len(){return Err(Issue::new("JSON","Trailing JSON input."));}Ok(data)}
fn quote(text:&str,out:&mut String){out.push('"');for c in text.chars(){match c{'"'=>out.push_str("\\\""),'\\'=>out.push_str("\\\\"),'\n'=>out.push_str("\\n"),'\r'=>out.push_str("\\r"),'\t'=>out.push_str("\\t"),c if c<' '=>out.push_str(&format!("\\u{:04x}",c as u32)),c=>out.push(c)}}out.push('"');}
fn write(data:&Data,out:&mut String){match data{
    Data::Null=>out.push_str("null"),Data::Flag(x)=>out.push_str(if *x{"true"}else{"false"}),Data::Price(x)=>if x.is_finite(){out.push_str(&x.to_string())}else{out.push_str("null")},Data::Text(s)=>quote(s,out),
    Data::List(a)=>{out.push('[');for(i,v)in a.iter().enumerate(){if i>0{out.push(',');}write(v,out);}out.push(']');},
    Data::Receipt(a)=>{out.push('{');for(i,(k,v))in a.iter().enumerate(){if i>0{out.push(',');}quote(k,out);out.push(':');write(v,out);}out.push('}');}
}}
pub fn encode(data:&Data)->String{let mut out=String::new();write(data,&mut out);out}
pub fn number(input:&Data,key:&str,fallback:f64)->Answer<f64>{match input.get(key){Data::Null=>Ok(fallback),Data::Price(x)=>Ok(*x),_=>Err(Issue::new("MODEL",format!("{key} must be numeric.")))}}
pub fn integer(input:&Data,key:&str,fallback:usize,minimum:usize,maximum:usize)->Answer<usize>{let n=number(input,key,fallback as f64)?;if n.fract()!=0.0||n<minimum as f64||n>maximum as f64{return Err(Issue::new("LIMIT",format!("{key} must be an integer in [{minimum}, {maximum}].")));}Ok(n as usize)}
