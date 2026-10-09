#[path = "../../pinia/folder2/common.rs"]
mod common;
#[path = "../../pinia/folder2/2.rs"]
mod stock;
#[path = "../../pinia/folder2/old.rs"]
mod old;
#[path = "../../pinia/folder2/aaa.rs"]
mod aaa;
mod layout;
#[cfg(test)]
mod check;

pub use common::{Body, Challenge, Control, Joint, Motor, Request, Scan, World};
pub use layout::{run, run_bytes};

#[cfg(target_arch = "wasm32")]
mod abi {
    use std::cell::RefCell;
    use std::collections::BTreeMap;
    thread_local! {
        static INPUTS: RefCell<BTreeMap<usize, Vec<u8>>> = RefCell::new(BTreeMap::new());
        static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }
    #[no_mangle]
    pub extern "C" fn ws_alloc(len: usize) -> *mut u8 {
        if len == 0 || len > 262144 { return std::ptr::null_mut(); }
        INPUTS.with(|store| {
            let mut map = store.borrow_mut();
            if map.len() >= 2 { return std::ptr::null_mut(); }
            let mut value = vec![0u8; len];
            let ptr = value.as_mut_ptr(); map.insert(ptr as usize, value); ptr
        })
    }
    #[no_mangle]
    pub extern "C" fn ws_dealloc(ptr: *mut u8, _len: usize) {
        INPUTS.with(|store| { store.borrow_mut().remove(&(ptr as usize)); });
    }
    #[no_mangle]
    pub extern "C" fn ws_run(ptr: *mut u8, len: usize) -> *const u8 {
        let result = INPUTS.with(|store| {
            let map = store.borrow();
            match map.get(&(ptr as usize)).filter(|data| data.len() == len) {
                Some(data) => super::run_bytes(data),
                None => br#"{"schema":"ocv.workshop-result/1","ok":false,"diagnostics":[{"code":"ABI_INPUT","message":"Invalid input buffer"}]}"#.to_vec(),
            }
        });
        OUTPUT.with(|out| { *out.borrow_mut() = result; out.borrow().as_ptr() })
    }
    #[no_mangle]
    pub extern "C" fn ws_result_len() -> usize { OUTPUT.with(|out| out.borrow().len()) }
    #[no_mangle]
    pub extern "C" fn ws_free_result() { OUTPUT.with(|out| out.borrow_mut().clear()); }
}
