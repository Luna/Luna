//! This module contains the implementation of `DomSymbol`, a struct used to represent DOM
//! elements on the scene.

use crate::prelude::*;

use crate::display;
use crate::display::object::traits::*;
use crate::system::gpu::data::JsBufferView;
use crate::system::web;
use crate::system::web::NodeInserter;
use crate::system::web::StyleSetter;
use crate::system::web::HtmlDivElement;

use enso_web::NodeRemover;
use wasm_bindgen::prelude::wasm_bindgen;



// ===================
// === Js Bindings ===
// ===================

mod js {
    use super::*;
    #[wasm_bindgen(inline_js = "
        function arr_to_css_matrix3d(a) {
            return `matrix3d(${a.join(',')})`
        }

        export function set_object_transform(dom, matrix_array) {
            let css = arr_to_css_matrix3d(matrix_array);
            dom.style.transform = css + 'translate(-50%,-50%)';
        }
    ")]
    extern "C" {
        /// Sets object's CSS 3D transform.
        #[allow(unsafe_code)]
        pub fn set_object_transform(dom: &web::JsValue, matrix_array: &web::Object);
    }
}


/// Sets the object transform as the CSS style property.
#[allow(unsafe_code)]
// TODO: RIIR?
#[cfg(target_arch = "wasm32")]
pub fn set_object_transform(dom: &web::JsValue, matrix: &Matrix4<f32>) {
    // Views to WASM memory are only valid as long the backing buffer isn't
    // resized. Check documentation of IntoFloat32ArrayView trait for more
    // details.
    unsafe {
        let matrix_array = matrix.js_buffer_view();
        js::set_object_transform(dom, &matrix_array);
    }
}
#[cfg(not(target_arch = "wasm32"))]
pub fn set_object_transform(dom: &web::JsValue, matrix: &Matrix4<f32>) {}



// =============
// === Guard ===
// =============

/// Drop guard for `DomSymbol`.
#[derive(Debug)]
pub struct Guard {
    display_object: display::object::Instance,
    dom:            HtmlDivElement,
}

impl Guard {
    /// Constructor.
    pub fn new(display_object: &display::object::Instance, dom: &HtmlDivElement) -> Self {
        let display_object = display_object.clone_ref();
        let dom = dom.clone();
        Self { display_object, dom }
    }
}

impl Drop for Guard {
    fn drop(&mut self) {
        self.dom.remove_from_parent_or_panic();
        self.display_object.unset_parent();
    }
}



// =================
// === DomSymbol ===
// =================

/// A DOM element which is managed by the rendering engine.
#[derive(Clone, CloneRef, Debug, Shrinkwrap)]
pub struct DomSymbol {
    #[shrinkwrap(main_field)]
    dom:            HtmlDivElement,
    display_object: display::object::Instance,
    size:           Rc<Cell<Vector2<f32>>>,
    guard:          Rc<Guard>,
}

impl DomSymbol {
    /// Constructor.
    pub fn new(content: &web::Node) -> Self {
        let logger = Logger::new("DomSymbol");
        let size = Rc::new(Cell::new(Vector2::new(0.0, 0.0)));
        let dom = web::create_div();
        dom.set_style_or_warn("position", "absolute", &logger);
        dom.set_style_or_warn("width", "0px", &logger);
        dom.set_style_or_warn("height", "0px", &logger);
        dom.append_or_panic(content);
        let display_object = display::object::Instance::new(logger);
        let guard = Rc::new(Guard::new(&display_object, &dom));
        display_object.set_on_updated(enclose!((dom) move |t| {
            let mut transform = inverse_y_translation(t.matrix());
            transform.iter_mut().for_each(|a| *a = eps(*a));
            set_object_transform(&dom,&transform);
        }));

        Self { dom, display_object, size, guard }
    }

    /// Size getter.
    pub fn size(&self) -> Vector2<f32> {
        self.size.get()
    }

    /// DOM element getter.
    pub fn dom(&self) -> &HtmlDivElement {
        &self.dom
    }

    /// Size setter.
    pub fn set_size(&self, size: Vector2<f32>) {
        self.size.set(size);
        self.dom.set_style_or_panic("width", format!("{}px", size.x));
        self.dom.set_style_or_panic("height", format!("{}px", size.y));
    }
}

impl display::Object for DomSymbol {
    fn display_object(&self) -> &display::object::Instance {
        &self.display_object
    }
}



// =============
// === Utils ===
// =============

/// eps is used to round very small values to 0.0 for numerical stability
pub fn eps(value: f32) -> f32 {
    if value.abs() < 1e-10 {
        0.0
    } else {
        value
    }
}

/// Inverses y translation of `transform`, i.e., `translation(x,y,z)` becomes `translation(x,-y,z)`.
pub fn inverse_y_translation(mut transform: Matrix4<f32>) -> Matrix4<f32> {
    let y_translation_index = (1, 3);
    let y_translation = transform.index_mut(y_translation_index);
    *y_translation = -*y_translation;
    transform
}
