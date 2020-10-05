//! An example showing usage of Text Area.

use ensogl_core::prelude::*;

use ensogl_core::system::web;
use ensogl_text_msdf_sys::run_once_initialized;
use wasm_bindgen::prelude::*;
use ensogl_core::application::Application;
use ensogl_text::Area;


/// Main example runner.
#[wasm_bindgen]
#[allow(dead_code)]
pub fn entry_point_text_area() {
    web::forward_panic_hook_to_console();
    web::set_stdout();
    web::set_stack_trace_limit();
    run_once_initialized(|| {
        let app = Application::new(&web::get_html_element_by_id("root").unwrap());
        init(&app);
        mem::forget(app);
    });
}

fn init(app:&Application) {
    let area = app.new_view::<Area>();
    area.set_position_x(-100.0);
    area.set_content("Et Eärello Endorenna utúlien. Sinome maruvan ar Hildinyar tenn' Ambar-metta");
    area.set_active_on();
    area.set_cursor_at_end();

    app.display.scene().add_child(&area);
    let mut keep = Some(area);
    app.display.on_frame(move |frame| {
        if frame.local > 3000.0 {
            keep = None;
        }
    }).forget();
}
