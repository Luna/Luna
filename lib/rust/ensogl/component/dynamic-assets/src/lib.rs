#![feature(local_key_cell_methods)]
#![cfg(target_arch = "wasm32")]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]
// === Non-Standard Linter Configuration ===
#![allow(clippy::option_map_unit_fn)]
#![allow(clippy::precedence)]
#![allow(dead_code)]
#![deny(unconditional_recursion)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]



use enso_prelude::*;
use enso_shapely::before_main;
use ensogl_core::system::js;
use ensogl_core::system::web::Closure;
use ensogl_core::system::web::JsCast;
use ensogl_core::system::web::JsValue;
use ensogl_core::system::web::Map;

mod fonts;



// ======================
// === Dynamic Assets ===
// ======================

#[before_main]
pub fn register_dynamic_assets_fns() {
    let js_app = js::app_or_panic();
    let closure = Closure::new(get_dynamic_assets_sources);
    js_app.register_get_dynamic_assets_sources_rust_fn(&closure);
    mem::forget(closure);
    let closure = Closure::new(set_dynamic_asset);
    js_app.register_set_dynamic_asset_rust_fn(&closure);
    mem::forget(closure);
}

fn get_dynamic_assets_sources() -> JsValue {
    let builders = Map::new();
    builders.set(&"font".to_string().into(), &fonts::build_atlases());
    builders.into()
}

fn set_dynamic_asset(builder: JsValue, key: JsValue, asset: JsValue) {
    let builder = builder.as_string().unwrap();
    let key = key.as_string().unwrap();
    let asset: Map = asset.dyn_into().unwrap();
    warn!("set_dynamic_asset: {builder} / {key}");
    let mut asset_ = HashMap::new();
    asset.for_each(&mut |value: JsValue, key: JsValue| {
        asset_.insert(key.as_string().unwrap(), js_sys::Uint8Array::new(&value).to_vec());
    });
    match builder.as_ref() {
        "font" => fonts::set_atlas(key, asset_),
        _ => panic!(),
    }
}
