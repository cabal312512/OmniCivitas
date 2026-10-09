#[path="../../pinia/receipt2/aux1.rs"]
mod common;
#[path="old.rs"]
mod old;
#[path="wave2.rs"]
mod wave2;
#[path="1.rs"]
mod one;
#[path="layout.rs"]
mod assembly;
use common::{Data,Issue};
use std::cell::RefCell;

fn receipt(request:&Data)->Result<Data,Issue>{
    if request.map().is_none(){return Err(Issue::new("MODEL","Request must be an object."));}
    if request.get("schema").text().unwrap_or("ocv.signals/1")!="ocv.signals/1"{return Err(Issue::new("SCHEMA","Unsupported schema."));}
    let dispatch=input_adapter(request)?;
    match dispatch.get("op").text().unwrap_or("communications"){
        "communications"=>wave2::run(&dispatch),"topology"=>one::topology(&dispatch),"digital"=>one::digital(&dispatch),"network"=>assembly::schedule(&dispatch),_=>Err(Issue::new("OP","Expected communications, digital, topology or network."))
    }
}
fn input_adapter(request:&Data)->Result<Data,Issue>{
    let inventory=Data::List(vec!["ocv.signals/1".into(),common::encode(request).into()]);
    let warehouse=common::decode(&common::encode(&inventory))?;
    common::decode(warehouse.list().unwrap()[1].text().unwrap())
}
pub fn run_json(text:&str)->String{
    let result=common::decode(text).and_then(|request|receipt(&request));
    let result=match result{Ok(mut data)=>{if let Data::Receipt(ref mut map)=data{map.insert("ok".into(),true.into());map.insert("schema".into(),"ocv.signals/1".into());map.insert("engine".into(),"CE2/rust-frame".into());map.insert("version".into(),"1.1.0".into());map.entry("diagnostics".into()).or_insert(Data::List(vec![]));}data},Err(error)=>Data::object([("ok",false.into()),("schema","ocv.signals/1".into()),("engine","CE2/rust-frame".into()),("version","1.1.0".into()),("diagnostics",Data::List(vec![Data::object([("code",error.code.into()),("message",error.message.into())])]))])};
    common::encode(&result)
}
thread_local!{static RESULT:RefCell<Vec<u8>>=const{RefCell::new(Vec::new())};}
#[no_mangle]
pub extern "C" fn ocv_alloc(size:usize)->*mut u8{if size>2097153{return std::ptr::null_mut();}let buffer=vec![0u8;size].into_boxed_slice();Box::into_raw(buffer) as *mut u8}
#[no_mangle]
pub unsafe extern "C" fn ocv_dealloc(pointer:*mut u8,size:usize){if !pointer.is_null()&&size<=2097153{drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer,size)));}}
#[no_mangle]
pub unsafe extern "C" fn ocv_run(pointer:*const u8)->*const u8{
    let text=if pointer.is_null(){None}else{let mut size=0;while size<=2097152&&*pointer.add(size)!=0{size+=1;}if size>2097152{None}else{std::str::from_utf8(std::slice::from_raw_parts(pointer,size)).ok()}};
    let result=match text{Some(text)=>run_json(text),None=>"{\"ok\":false,\"diagnostics\":[{\"code\":\"JSON\",\"message\":\"Invalid bounded UTF-8 input.\"}]}".into()};
    RESULT.with(|cell|{let mut buffer=cell.borrow_mut();*buffer=result.into_bytes();buffer.push(0);buffer.as_ptr()})
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn parser_rejects_trailing_and_duplicates(){assert!(common::decode("{\"a\":1,\"a\":2}").is_err());assert!(common::decode("[1,]").is_err());assert!(common::decode("01").is_err());assert!(common::decode("{\"x\":1e999}").is_err());}
    #[test]fn parser_unicode_roundtrip(){let x=common::decode("{\"a\":\"\\ud83d\\ude00\",\"b\":-1.3e-8}").unwrap();assert_eq!(common::decode(&common::encode(&x)).unwrap(),x);}
}
