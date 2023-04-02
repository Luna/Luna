//! Example scene showing the usage of built-in vector editor component.
//!
//! TODO[WD]: This is work in progress and will be changed in the upcoming PRs.

// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]
#![recursion_limit = "256"]
#![feature(let_chains)]

use ensogl_core::display::shape::compound::rectangle::*;
use ensogl_core::display::world::*;
use ensogl_core::prelude::*;

use ensogl_core::control::io::mouse;
use ensogl_core::data::color;
use ensogl_core::display;
use ensogl_core::display::navigation::navigator::Navigator;
use ensogl_core::display::object::ObjectOps;
use ensogl_core::Animation;

const DRAG_THRESHOLD: f32 = 4.0;

// FIXME: to be parametrized
const GAP: f32 = 10.0;

/// If set to true, animations will be running slow. This is useful for debugging purposes.
pub const DEBUG_ANIMATION_SLOWDOWN: bool = false;

/// Spring factor for animations. If [`DEBUG_ANIMATION_SLOWDOWN`] is set to true, this value will be
/// used for animation simulators.
pub const DEBUG_ANIMATION_SPRING_FACTOR: f32 = if DEBUG_ANIMATION_SLOWDOWN { 0.05 } else { 1.0 };

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



// ==============
// === Placeholder ===
// ==============

mod placeholder {
    use super::*;
    ensogl_core::define_endpoints_2! {
        Input {
            set_current_size(f32),
            set_target_size_no_animation (f32),
            set_target_size (f32),
        }
        Output {
        }
    }

    #[derive(Debug, Clone, CloneRef, Deref)]
    pub struct Placeholder {
        model: Rc<SpacerModel>,
    }

    #[derive(Debug, Deref)]
    pub struct SpacerModel {
        #[deref]
        pub frp:        placeholder::Frp,
        root:           display::object::Instance,
        self_ref:       Rc<RefCell<Option<Rc<SpacerModel>>>>,
        margin_left:    Cell<f32>,
        collapsing:     Rc<Cell<bool>>,
        size_animation: Animation<f32>,
        viz:            Rectangle,
    }

    impl SpacerModel {
        fn new() -> Self {
            let frp = placeholder::Frp::new();
            let root = display::object::Instance::new();
            let self_ref = default();
            let margin_left = default();
            let collapsing = default();
            let size_animation = Animation::<f32>::new(frp.network());
            let viz = RoundedRectangle(10.0).build(|t| {
                t.set_size(Vector2::new(0.0, 20.0))
                    .allow_grow_x()
                    .set_color(color::Rgba::new(1.0, 0.0, 0.0, 1.0))
                    .set_inset_border(5.0)
                    .set_border_color(color::Rgba::new(0.0, 1.0, 1.0, 1.0));
            });
            root.add_child(&viz);

            Self { frp, root, self_ref, margin_left, collapsing, size_animation, viz }
        }
    }

    impl Placeholder {
        pub fn new() -> Self {
            let model = SpacerModel::new();
            let model = Rc::new(model);
            let root = model.root.clone_ref();
            let collapsing = &model.collapsing;
            let self_ref = &model.self_ref;

            let network = &model.frp.network();
            let size_animation = &model.size_animation;
            size_animation.simulator.update_spring(|s| s * DEBUG_ANIMATION_SPRING_FACTOR);
            frp::extend! { network
                size_animation.target <+ model.frp.private.input.set_target_size_no_animation;
                size_animation.skip <+ model.frp.private.input.set_target_size_no_animation.constant(());
                size_animation.set_value <+ model.frp.private.input.set_current_size;

                size_animation.target <+ model.frp.private.input.set_target_size;
                eval size_animation.value ((t) root.set_size_x(*t););
                eval_ size_animation.on_end ([collapsing, self_ref] {
                    if collapsing.get() {
                        self_ref.borrow_mut().take();
                    }
                });
            }
            Self { model }
        }

        pub fn downgrade(&self) -> WeakPlaceholder {
            WeakPlaceholder { model: Rc::downgrade(&self.model) }
        }

        pub fn collapse(&self) {
            *self.self_ref.borrow_mut() = Some(self.model.clone());
            self.set_target_size(0.0);
            self.collapsing.set(true);
        }

        pub fn uncollapse(&self) {
            *self.self_ref.borrow_mut() = None;
            self.collapsing.set(false);
        }

        pub fn mod_size(&self, delta: f32) {
            self.size_animation.simulator.update_value(|v| v + delta);
        }

        // pub fn set_margin_left(&self, margin: f32) {
        //     let current_margin = self.margin_left.get();
        //     let margin_diff = margin - current_margin;
        //     self.margin_left.set(margin);
        //     self.size_animation.simulator.update_value(|v| v + margin_diff);
        //     if !self.collapsing.get() {
        //         self.size_animation.simulator.update_target_value(|v| v + margin_diff);
        //     }
        // }
    }

    impl display::Object for Placeholder {
        fn display_object(&self) -> &display::object::Instance {
            &self.root
        }
    }

    #[derive(Debug, Clone, CloneRef, Deref)]
    pub struct WeakPlaceholder {
        model: Weak<SpacerModel>,
    }

    impl WeakPlaceholder {
        pub fn upgrade(&self) -> Option<Placeholder> {
            self.model.upgrade().map(|model| Placeholder { model })
        }
    }
}

use placeholder::Placeholder;
use placeholder::WeakPlaceholder;


// ===========
// === FRP ===
// ===========

#[derive(Debug)]
pub struct DropSpot<T> {
    pub placeholder: Placeholder,
    pub elem:        T,
}

impl<T: display::Object> DropSpot<T> {
    pub fn new(placeholder: Placeholder, elem: T) -> Self {
        placeholder.add_child(&elem);
        let network = placeholder.frp.network();
        let elem_display_object = elem.display_object();
        let position_animation = Animation::<Vector2>::new(&network);
        position_animation.simulator.update_spring(|s| s * DEBUG_ANIMATION_SPRING_FACTOR);

        frp::extend! { network
            eval position_animation.value ((p) {elem_display_object.set_xy(*p);});
        }
        position_animation.target.emit(elem_display_object.position().xy());
        position_animation.skip.emit(());
        position_animation.target.emit(Vector2(0.0, 0.0));
        Self { placeholder, elem }
    }
}

#[derive(Debug)]
pub enum Item<T> {
    Regular(T),
    Placeholder(Placeholder),
    WeakPlaceholder(WeakPlaceholder),
    DropSpot(DropSpot<T>),
}

impl<T: display::Object> Item<T> {
    pub fn is_regular(&self) -> bool {
        matches!(self, Self::Regular(_))
    }
    pub fn is_placeholder(&self) -> bool {
        matches!(self, Self::Placeholder(_))
    }

    pub fn is_weak_placeholder(&self) -> bool {
        matches!(self, Self::WeakPlaceholder(_))
    }

    pub fn display_object(&self) -> Option<display::object::Instance> {
        match self {
            Item::Regular(t) => Some(t.display_object().clone_ref()),
            Item::Placeholder(t) => Some(t.display_object().clone_ref()),
            Item::WeakPlaceholder(t) => t.upgrade().map(|t| t.display_object().clone_ref()),
            Item::DropSpot(t) => Some(t.placeholder.display_object().clone_ref()),
        }
    }

    pub fn computed_size(&self) -> Vector2 {
        self.display_object().map(|t| t.computed_size()).unwrap_or_default()
    }

    pub fn exists(&self) -> bool {
        match self {
            Item::Regular(_) => true,
            Item::Placeholder(_) => true,
            Item::DropSpot(_) => true,
            Item::WeakPlaceholder(t) => t.upgrade().is_some(),
        }
    }

    pub fn upgraded_weak_placeholder(&self) -> Option<Placeholder> {
        match self {
            Item::WeakPlaceholder(t) => t.upgrade(),
            _ => None,
        }
    }
}


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
    items:        Vec<Item<T>>,
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
        layouted_elems.use_auto_layout(); //.set_gap((GAP, GAP));
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
            pos_on_down <- glob_pos_on_down.map(f!([root, model] (p) model.borrow().screen_to_object_space(&root, *p)));
            on_move_pressed <- on_move.gate(&pressed);
            glob_pos_on_move <- on_move_pressed.map(|event| event.client_centered());
            pos_on_move <- glob_pos_on_move.map(f!([root, model] (p) model.borrow().screen_to_object_space(&root, *p)));
            glob_pos_offset_on_move <- map2(&pos_on_move, &pos_on_down, |a, b| a - b);

            // Discover whether the elements are dragged. They need to be moved vertically by at
            // least the [`DRAG_THRESHOLD`].
            threshold_gate <- glob_pos_offset_on_move.map(|t| t.y.abs() >= DRAG_THRESHOLD);
            trigger <- on_move_pressed.gate(&threshold_gate);
            status <- bool(&on_up, &trigger).on_change();
            start <- status.on_true();
            target_on_start <- target.sample(&start);

            // Re-parent the dragged element.
            eval target_on_start ((t) dragged_elems.add_child(&t));
            eval target_on_start([model, layouted_elems] (t) model.borrow_mut().set_as_dragged_item(&layouted_elems, t));
            // center_points <- target_on_start.map(f_!(model.borrow().elems_center_points()));
            // trace center_points;

            // Move the dragged element.
            target_new_pos <- map2(&glob_pos_offset_on_move, &target_pos_on_down, |a, b| a + b);
            _eval <- target_new_pos.map2(&target, |pos, t| t.set_xy(*pos));

            insert_index <- pos_on_move.map(f!((pos) model.borrow().insert_index(pos.x))).on_change();
            trace insert_index;
            insert_index_on_drop <- insert_index.sample(&on_up);

            eval insert_index ([model, layouted_elems] (index) {
                let mut model = model.borrow_mut();
                model.potential_insertion_point(*index);
                model.redraw_items(&layouted_elems);
            });

            eval insert_index_on_drop ([model, layouted_elems] (index) {
                let mut model = model.borrow_mut();
                model.unset_dragged_item(*index);
                model.redraw_items(&layouted_elems);
            });


        }
        self
    }
}

impl<T: display::Object> VectorEditor<T> {
    fn append(&self, item: T) {
        self.layouted_elems.add_child(&item);
        let mut model = self.model.borrow_mut();
        model.items.push(Item::Regular(item));
        model.reset_margins();
    }
}

impl<T: display::Object> Model<T> {
    fn redraw_items(&mut self, layouted_elems: &display::object::Instance) {
        self.retain_non_collapsed_items();
        for item in &self.items {
            if let Some(display_object) = item.display_object() {
                layouted_elems.add_child(&display_object);
            }
        }
    }

    fn reset_margins(&self) {
        let mut first_elem = true;
        for item in &self.items {
            match item {
                Item::Regular(item) => {
                    let gap = if first_elem { 0.0 } else { GAP };
                    item.set_margin_left(gap);
                    first_elem = false;
                }
                _ => {}
            }
        }
    }

    fn retain_non_collapsed_items(&mut self) {
        self.items.retain(|item| item.exists());
    }

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


    fn remove_item_by_display_object(
        &mut self,
        target: &display::object::Instance,
    ) -> Option<(usize, T)> {
        let mut result: Option<(usize, T)> = None;
        let items = mem::take(&mut self.items);
        self.items = items
            .into_iter()
            .enumerate()
            .filter_map(|(i, item)| match item {
                Item::Regular(item) =>
                    if item.display_object() == target {
                        result = Some((i, item));
                        None
                    } else {
                        Some(Item::Regular(item))
                    },
                Item::DropSpot(t) =>
                    if t.elem.display_object() == target {
                        result = Some((i, t.elem));
                        None
                    } else {
                        Some(Item::DropSpot(t))
                    },
                _ => Some(item),
            })
            .collect();
        result
    }

    fn get_upgraded_weak_placeholder(&self, index: usize) -> Option<(usize, Placeholder)> {
        self.items.get(index).and_then(|t| t.upgraded_weak_placeholder().map(|t| (index, t)))
    }

    fn set_as_dragged_item(
        &mut self,
        layouted_elems: &display::object::Instance,
        target: &display::object::Instance,
    ) {
        if let Some((index, elem)) = self.remove_item_by_display_object(target) {
            self.collapse_all_placeholders();
            let prev_index = index.saturating_sub(1);
            let prev_placeholder = self.get_upgraded_weak_placeholder(prev_index);
            let next_placeholder = self.get_upgraded_weak_placeholder(index);
            let (placeholder, placeholder_to_merge) = match (prev_placeholder, next_placeholder) {
                (Some(p1), Some(p2)) => (Some(p1), Some(p2)),
                (p1, p2) => (p1.or(p2), None),
            };
            if let Some((placeholder_index, placeholder)) = placeholder {
                let size = elem.computed_size().x + GAP;
                placeholder.uncollapse();
                placeholder.mod_size(size);
                placeholder.set_target_size(size);
                if let Some((placeholder_to_merge_index, placeholder_to_merge)) =
                    placeholder_to_merge
                {
                    self.items.remove(placeholder_to_merge_index);
                    placeholder.mod_size(placeholder_to_merge.computed_size().x);
                    placeholder_to_merge.uncollapse();
                }
                self.items[placeholder_index] = Item::Placeholder(placeholder);
                self.dragged_item = Some(elem);
                self.reset_margins();
                self.redraw_items(layouted_elems);
            } else {
                let placeholder = Placeholder::new();
                placeholder.set_target_size_no_animation(elem.computed_size().x + GAP);
                self.items.insert(index, Item::Placeholder(placeholder));
                self.dragged_item = Some(elem);
                self.reset_margins();
                self.redraw_items(layouted_elems);
            }
        }
    }

    fn potential_insertion_point(&mut self, index: usize) {
        warn!("potential_insertion_point: {}", index);
        // FIXME: this check should not be needed
        if self.dragged_item.is_some() {
            warn!(">>>");
            let prev_index = index.saturating_sub(1);
            self.collapse_all_placeholders();
            let item = self.dragged_item.as_ref().expect("No dragged item");
            let mut old_placeholder: Option<(usize, Placeholder)> = None;
            if let Some(Item::WeakPlaceholder(weak)) = self.items.get(index) && let Some(placeholder) = weak.upgrade() {
                old_placeholder = Some((index, placeholder));
            } else if let Some(Item::WeakPlaceholder(weak)) = self.items.get(prev_index) && let Some(placeholder) = weak.upgrade() {
                old_placeholder = Some((prev_index, placeholder));
            }
            if let Some((index, placeholder)) = old_placeholder {
                warn!("reusing placeholder");
                placeholder.set_target_size(item.computed_size().x + GAP);
                placeholder.uncollapse();
                self.items[index] = Item::Placeholder(placeholder);
                self.reset_margins();
            } else {
                warn!("adding placeholder");
                let placeholder = Placeholder::new();
                placeholder.set_target_size(item.computed_size().x + GAP);
                self.items.insert(index, Item::Placeholder(placeholder.clone_ref()));
                self.reset_margins();
                placeholder.set_current_size(0.0);
            }
        }
    }

    fn unset_dragged_item(&mut self, index: usize) {
        warn!("unset_dragged_item");
        let item = self.dragged_item.take().expect("No dragged item");
        let prev_index = index.saturating_sub(1);
        if let Some(old_item) = self.items.get_mut(index) && let Item::Placeholder(placeholder) = old_item {
            warn!("replacing old");
            let placeholder_position = placeholder.global_position().xy();
            let item_position = item.global_position().xy();
            item.set_xy(item_position - placeholder_position);
            *old_item = Item::DropSpot(DropSpot::new(placeholder.clone_ref(), item));
        } else if let Some(old_item) = self.items.get_mut(prev_index) && let Item::Placeholder(placeholder) = old_item {
            warn!("replacing old");
            let placeholder_position = placeholder.global_position().xy();
            let item_position = item.global_position().xy();
            item.set_xy(item_position - placeholder_position);
            *old_item = Item::DropSpot(DropSpot::new(placeholder.clone_ref(), item));
        } else {
            panic!()
            // warn!("inserting new");
            // self.items.insert(index, item);
        }
        self.collapse_all_placeholders();
        self.reset_margins();
    }

    fn collapse_all_placeholders(&mut self) {
        for item in &mut self.items {
            if let Item::Placeholder(placeholder) = item {
                placeholder.collapse();
                *item = Item::WeakPlaceholder(placeholder.downgrade());
            }
        }
    }

    // fn insert_dragged_item(&mut self, index: usize) {
    //     let elem = self.dragged_item.take().expect("No dragged item");
    //     self.items.insert(index, elem);
    // }

    // FIXME: does not work correctly with placeholders
    fn elems_center_points(&self) -> Vec<f32> {
        let mut centers = Vec::new();
        let mut current = 0.0;
        for item in &self.items {
            let size = item.computed_size();
            current += size.x / 2.0;
            centers.push(current);
            current += size.x / 2.0;
            if item.is_regular() {
                current += GAP;
            }
        }
        // warn!("centers: {:#?}", centers);
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
