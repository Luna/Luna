//! Example scene showing the usage of built-in vector editor component.
//!
//! TODO[WD]: This is work in progress and will be changed in the upcoming PRs.

// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]
#![recursion_limit = "256"]

use ensogl_core::display::shape::compound::rectangle::*;
use ensogl_core::display::world::*;
use ensogl_core::prelude::*;

use ensogl_core::control::io::mouse;
use ensogl_core::data::color;
use ensogl_core::display;
use ensogl_core::display::navigation::navigator::Navigator;
use ensogl_core::display::object::ObjectOps;


const DRAG_THRESHOLD: f32 = 4.0;

// FIXME: to be parametrized
const GAP: f32 = 10.0;

// ==============
// === Events ===
// ==============

#[derive(Clone, CloneRef, Debug, Default)]
pub struct MouseOver;


// ============
// === Glob ===
// ============

pub mod glob {
    use super::*;
    ensogl_core::define_endpoints_2! {
        Input {
        }
        Output {
        }
    }
}

// ===========
// === FRP ===
// ===========

ensogl_core::define_endpoints_2! {
    Input {
    }
    Output {
    }
}


#[derive(Derivative, CloneRef, Debug, Deref)]
#[derivative(Clone(bound = ""))]
pub struct VectorEditor<T> {
    #[deref]
    pub frp:        Frp,
    root:           display::object::Instance,
    layouted_elems: display::object::Instance,
    dragged_elems:  display::object::Instance,
    model:          Rc<RefCell<Model<T>>>,
}

#[derive(Debug, Derivative)]
#[derivative(Default(bound = ""))]
pub struct Model<T> {
    dragged_item: Option<T>,
    items:        Vec<T>,
}

impl<T: display::Object + 'static> VectorEditor<T> {
    pub fn new() -> Self {
        let frp = Frp::new();
        let root = display::object::Instance::new();
        let layouted_elems = display::object::Instance::new();
        let dragged_elems = display::object::Instance::new();
        root.add_child(&layouted_elems);
        root.add_child(&dragged_elems);
        let model = default();
        layouted_elems.use_auto_layout().set_gap((GAP, GAP));
        Self { frp, root, layouted_elems, dragged_elems, model }.init()
    }

    fn init(self) -> Self {
        let scene = scene();
        let network = self.frp.network();
        let root = &self.root;
        let layouted_elems = &self.layouted_elems;
        let dragged_elems = &self.dragged_elems;
        let model = &self.model;

        let on_down = self.layouted_elems.on_event_capturing::<mouse::Down>();
        let on_up = scene.on_event::<mouse::Up>();
        let on_move = scene.on_event::<mouse::Move>();
        frp::extend! { network
            // Do not pass events to children, as we don't know whether we are about to drag
            // them yet.
            eval on_down ([] (event) event.stop_propagation());
            target <= on_down.map(|event| event.target());

            target_pos_on_down <- target.map(|t| t.xy());
            pressed <- bool(&on_up, &on_down);
            glob_pos_on_down <- on_down.map(|event| event.client_centered());
            on_move_pressed <- on_move.gate(&pressed);
            glob_pos_on_move <- on_move_pressed.map(|event| event.client_centered());
            glob_pos_offset_on_move <- map2(&glob_pos_on_move, &glob_pos_on_down, |a, b| a - b);

            // Discover whether the elements are dragged. They need to be moved vertically by at
            // least the [`DRAG_THRESHOLD`].
            threshold_gate <- glob_pos_offset_on_move.map(|t| t.y.abs() >= DRAG_THRESHOLD);
            trigger <- on_move_pressed.gate(&threshold_gate);
            status <- bool(&on_up, &trigger).on_change();
            start <- status.on_true();
            target_on_start <- target.sample(&start);

            // Re-parent the dragged element.
            eval target_on_start ((t) dragged_elems.add_child(&t));
            eval target_on_start((t) model.borrow_mut().set_as_dragged_item(t));
            // center_points <- target_on_start.map(f_!(model.borrow().elems_center_points()));
            // trace center_points;

            // Move the dragged element.
            target_new_pos <- map2(&glob_pos_offset_on_move, &target_pos_on_down, |a, b| a + b);
            _eval <- target_new_pos.map2(&target, |pos, t| t.set_xy(*pos));

            local_pos_on_drop <- on_up.map(f!([root, model] (event) model.borrow().screen_to_object_space(&root, event.client_centered()) ));
            insert_index <- local_pos_on_drop.map(f!((pos) model.borrow().insert_index(pos.x)));
            trace insert_index;

            eval insert_index ([model, layouted_elems] (index) {
                let mut model = model.borrow_mut();
                model.unset_dragged_item(*index);
                for item in &model.items {
                    item.unset_parent();
                }
                for item in &model.items {
                    layouted_elems.add_child(item);
                }
            });


        }
        self
    }
}

impl<T: display::Object> VectorEditor<T> {
    fn append(&self, item: T) {
        self.layouted_elems.add_child(&item);
        self.model.borrow_mut().items.push(item);
    }
}

impl<T: display::Object> Model<T> {
    // FIXME: refactor and generalize
    fn screen_to_object_space(
        &self,
        display_object: &display::object::Instance,
        screen_pos: Vector2,
    ) -> Vector2 {
        let scene = scene();
        let camera = scene.camera();
        let origin_world_space = Vector4(0.0, 0.0, 0.0, 1.0);
        let origin_clip_space = camera.view_projection_matrix() * origin_world_space;
        let inv_object_matrix = display_object.transformation_matrix().try_inverse().unwrap();

        let shape = scene.frp.shape.value();
        let clip_space_z = origin_clip_space.z;
        let clip_space_x = origin_clip_space.w * 2.0 * screen_pos.x / shape.width;
        let clip_space_y = origin_clip_space.w * 2.0 * screen_pos.y / shape.height;
        let clip_space = Vector4(clip_space_x, clip_space_y, clip_space_z, origin_clip_space.w);
        let world_space = camera.inversed_view_projection_matrix() * clip_space;
        (inv_object_matrix * world_space).xy()
    }

    fn set_as_dragged_item(&mut self, display_object: &display::object::Instance) {
        let index = self
            .items
            .iter()
            .position(|item| item.display_object() == display_object)
            .expect("Item not found");
        let elem = self.items.remove(index);
        self.dragged_item = Some(elem);
    }

    fn unset_dragged_item(&mut self, index: usize) {
        let item = self.dragged_item.take().expect("No dragged item");
        self.items.insert(index, item);
    }

    fn insert_dragged_item(&mut self, index: usize) {
        let elem = self.dragged_item.take().expect("No dragged item");
        self.items.insert(index, elem);
    }

    fn elems_division_points(&self) -> NonEmptyVec<f32> {
        let mut divisions = NonEmptyVec::default();
        let mut current = 0.0;
        for item in self.items.iter() {
            let size = item.computed_size();
            current += size.x;
            divisions.push(current + GAP / 2.0);
            current += GAP;
        }
        *divisions.last_mut() -= GAP / 2.0;
        divisions
    }

    fn elems_center_points(&self) -> Vec<f32> {
        let mut centers = Vec::new();
        let mut current = 0.0;
        for item in self.items.iter() {
            let size = item.computed_size();
            current += size.x / 2.0;
            centers.push(current);
            current += size.x / 2.0 + GAP;
        }
        centers
    }

    fn insert_index(&self, x: f32) -> usize {
        let center_points = self.elems_center_points();
        let mut index = 0;
        for center in center_points {
            if x < center {
                break;
            }
            index += 1;
        }
        index
    }
}

impl<T> display::Object for VectorEditor<T> {
    fn display_object(&self) -> &display::object::Instance {
        &self.root
    }
}

impl<T: display::Object + 'static> Default for VectorEditor<T> {
    fn default() -> Self {
        Self::new()
    }
}


// ===================
// === Entry Point ===
// ===================

/// The example entry point.
#[entry_point]
#[allow(dead_code)]
pub fn main() {
    let world = World::new().displayed_in("root");
    let scene = &world.default_scene;
    let camera = scene.camera().clone_ref();
    let navigator = Navigator::new(scene, &camera);

    let vector_editor = VectorEditor::<Rectangle>::new();


    let shape1 = Circle().build(|t| {
        t.set_size(Vector2::new(100.0, 100.0))
            .set_color(color::Rgba::new(0.5, 0.0, 0.0, 0.3))
            .set_inset_border(5.0)
            .set_border_color(color::Rgba::new(0.0, 0.0, 1.0, 1.0))
            .keep_bottom_left_quarter();
    });
    let shape2 = RoundedRectangle(10.0).build(|t| {
        t.set_size(Vector2::new(100.0, 100.0))
            .set_color(color::Rgba::new(0.5, 0.0, 0.0, 0.3))
            .set_inset_border(5.0)
            .set_border_color(color::Rgba::new(0.0, 0.0, 1.0, 1.0));
    });
    let shape3 = RoundedRectangle(10.0).build(|t| {
        t.set_size(Vector2::new(100.0, 100.0))
            .set_color(color::Rgba::new(0.5, 0.0, 0.0, 0.3))
            .set_inset_border(5.0)
            .set_border_color(color::Rgba::new(0.0, 1.0, 1.0, 1.0));
    });


    let glob_frp = glob::Frp::new();
    let glob_frp_network = glob_frp.network();

    let shape1_down = shape1.on_event::<mouse::Down>();
    frp::extend! { glob_frp_network
        eval_ shape1_down ([] {
            warn!("Shape 1 down");
        });
    }

    vector_editor.append(shape1);
    vector_editor.append(shape2);
    vector_editor.append(shape3);

    let root = display::object::Instance::new();
    root.set_size(Vector2::new(300.0, 100.0));
    root.add_child(&vector_editor);
    world.add_child(&root);

    world.keep_alive_forever();
    mem::forget(glob_frp);
    mem::forget(navigator);
    mem::forget(root);
    mem::forget(vector_editor);
}
