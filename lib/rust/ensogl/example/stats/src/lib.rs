//! A debug scene which shows the number and range selector.

#![feature(associated_type_defaults)]
#![feature(drain_filter)]
#![feature(entry_insert)]
#![feature(fn_traits)]
#![feature(trait_alias)]
#![feature(type_alias_impl_trait)]
#![feature(unboxed_closures)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unsafe_code)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]
#![recursion_limit = "1024"]

use ensogl_core::prelude::*;
use wasm_bindgen::prelude::*;

use ensogl_core::application::Application;
use ensogl_core::display::object::ObjectOps;
use ensogl_core::debug::stats;
use ensogl_core::system::web;
use ensogl_hardcoded_theme as theme;
use ensogl_label::Label;
use ensogl_text_msdf_sys::run_once_initialized;



// ===================
// === Entry Point ===
// ===================

/// An entry point.
#[wasm_bindgen]
#[allow(dead_code)]
pub fn entry_point_stats() {
    web::forward_panic_hook_to_console();
    web::set_stack_trace_limit();
    run_once_initialized(|| {
        let app = Application::new(&web::get_html_element_by_id("root").unwrap());
        init(&app);
        Leak::new(app);
    });
}



// ========================
// === Init Application ===
// ========================

fn init(app: &Application) {
    theme::builtin::dark::register(&app);
    theme::builtin::light::register(&app);
    theme::builtin::light::enable(&app);

    let label = Label::new(app);
    app.display.add_child(&label);

    let stats = app.display.scene().stats.clone();
    let mut stats_accumulator: stats::Accumulator = default();

    app.display
        .on_frame(move |_| {
            let text = iformat!(
                "Press CTRL-OPTION-TILDE (TILDE is key below ESC) to show Monitor panel"
                "\n fps = " stats.fps()
            );
            label.frp.set_content(text);
        })
        .forget();
}

