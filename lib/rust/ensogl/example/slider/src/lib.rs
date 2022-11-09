//! A debug scene which shows the number and range selector.

#![recursion_limit = "1024"]
// === Features ===
#![feature(associated_type_defaults)]
#![feature(drain_filter)]
#![feature(fn_traits)]
#![feature(trait_alias)]
#![feature(type_alias_impl_trait)]
#![feature(unboxed_closures)]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]
// === Non-Standard Linter Configuration ===
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]

use ensogl_core::prelude::*;
use wasm_bindgen::prelude::*;

use ensogl_core::application::Application;
use ensogl_core::display::object::ObjectOps;
use ensogl_hardcoded_theme as theme;
use ensogl_slider as slider;
use ensogl_text_msdf::run_once_initialized;



// ===================
// === Entry Point ===
// ===================

/// An entry point.
#[entry_point]
#[allow(dead_code)]
pub fn main() {
    run_once_initialized(|| {
        let app = Application::new("root");
        init(&app);
        mem::forget(app);
    });
}

fn make_slider(app: &Application) -> Leak<slider::Slider> {
    let slider = app.new_view::<slider::Slider>();
    slider.frp.set_width(200.0);
    slider.frp.set_height(50.0);
    app.display.add_child(&slider);
    Leak::new(slider)
}



// ========================
// === Init Application ===
// ========================

fn init(app: &Application) {
    theme::builtin::dark::register(app);
    theme::builtin::light::register(app);
    theme::builtin::light::enable(app);

    let slider1 = make_slider(app);
    slider1.inner().frp.set_width(400.0);
    slider1.inner().frp.set_height(50.0);
    slider1.inner().frp.set_slider_color(color::Lcha(0.4, 0.7, 0.7, 1.0));
    slider1.inner().frp.set_value_color(color::Lcha(0.2, 0.7, 0.2, 1.0));
}
