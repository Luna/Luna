//! Grid View EnsoGL Component.
//!
//! The main structure is [`GridView`] - see its docs for details.

#![recursion_limit = "1024"]
// === Features ===
#![feature(option_result_contains)]
#![feature(trait_alias)]
#![feature(hash_drain_filter)]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
// === Non-Standard Linter Configuration ===
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]


// ==============
// === Export ===
// ==============

pub mod entry;
pub mod scrollable;
pub mod simple;
pub mod visible_area;

pub use ensogl_scroll_area::Viewport;



/// Commonly used types and functions.
pub mod prelude {
    pub use ensogl_core::prelude::*;
}

use crate::prelude::*;

use enso_frp as frp;
use ensogl_core::application::command::FrpNetworkProvider;
use ensogl_core::application::Application;
use ensogl_core::display;
use ensogl_core::display::scene::layer::WeakLayer;
use ensogl_core::display::scene::Layer;
use ensogl_core::gui::Widget;

use crate::entry::EntryFrp;
use crate::visible_area::all_visible_locations;
use crate::visible_area::visible_columns;
use crate::visible_area::visible_rows;
pub use entry::Entry;



// ===========
// === FRP ===
// ===========

/// A row index in [`GridView`].
pub type Row = usize;
/// A column index  in [`GridView`].
pub type Col = usize;

ensogl_core::define_endpoints_2! {
    <EntryModel: (frp::node::Data), EntryParams: (frp::node::Data)>
    Input {
        /// Declare what area of the GridView is visible. The area position is relative to left-top
        /// corner of the Grid View.
        set_viewport(Viewport),
        /// Reset entries, providing number of rows and columns. All currently displayed entries
        /// will be detached and their models re-requested.
        reset_entries(Row, Col),
        /// Provide model for specific entry. Should be called only after `model_for_entry_needed`
        /// event for given row and column. After that the entry will be visible.
        model_for_entry(Row, Col, EntryModel),
        /// Set the entries size. All entries have the same size.
        set_entries_size(Vector2),
        /// Set the entries parameters.
        set_entries_params(EntryParams),
        /// Set the layer for any texts rendered by entries. The layer will be passed to entries'
        /// constructors. **Performance note**: This will re-instantiate all entries.
        set_text_layer(Option<WeakLayer>),
    }

    Output {
        row_count(Row),
        column_count(Col),
        viewport(Viewport),
        entries_size(Vector2),
        entries_params(EntryParams),
        content_size(Vector2),
        /// Event emitted when the Grid View needs model for an uncovered entry.
        model_for_entry_needed(Row, Col),
    }
}



// =============
// === Model ===
// =============

// === EntryCreationCtx ===

/// A structure gathering all data required for creating new entry instance.
#[derive(CloneRef, Debug, Derivative)]
#[derivative(Clone(bound = ""))]
struct EntryCreationCtx<EntryParams> {
    app:              Application,
    network:          frp::WeakNetwork,
    set_entry_size:   frp::Stream<Vector2>,
    set_entry_params: frp::Stream<EntryParams>,
}

impl<EntryParams: frp::node::Data> EntryCreationCtx<EntryParams> {
    fn create_entry<E: Entry<Params = EntryParams>>(&self, text_layer: &Option<Layer>) -> E {
        let entry = E::new(&self.app, text_layer);
        if let Some(network) = self.network.upgrade_or_warn() {
            let entry_frp = entry.frp();
            let entry_network = entry_frp.network();
            frp::new_bridge_network! { [network, entry_network] grid_view_entry_bridge
                init <- source_();
                entry_frp.set_size <+ all(init, self.set_entry_size)._1();
                entry_frp.set_params <+ all(init, self.set_entry_params)._1();
            }
            init.emit(());
        }
        entry
    }
}

fn set_entry_position<E: display::Object>(entry: &E, row: Row, col: Col, entry_size: Vector2) {
    let x = (col as f32 + 0.5) * entry_size.x;
    let y = (row as f32 + 0.5) * -entry_size.y;
    entry.set_position_xy(Vector2(x, y));
}


// === Properties ===

#[derive(Copy, Clone, Debug, Default)]
struct Properties {
    row_count:    usize,
    col_count:    usize,
    viewport:     Viewport,
    entries_size: Vector2,
}


// === Model ===

/// The Model of [`GridView`].
#[derive(Clone, Debug)]
pub struct Model<Entry, EntryParams> {
    display_object:     display::object::Instance,
    visible_entries:    RefCell<HashMap<(Row, Col), Entry>>,
    free_entries:       RefCell<Vec<Entry>>,
    entry_creation_ctx: EntryCreationCtx<EntryParams>,
}

impl<Entry, EntryParams> Model<Entry, EntryParams> {
    fn new(entry_creation_ctx: EntryCreationCtx<EntryParams>) -> Self {
        let logger = Logger::new("GridView");
        let display_object = display::object::Instance::new(&logger);
        let visible_entries = default();
        let free_entries = default();
        Model { display_object, visible_entries, free_entries, entry_creation_ctx }
    }
}

impl<Entry: display::Object, EntryParams> Model<Entry, EntryParams> {
    fn update_entries_visibility(&self, properties: Properties) -> Vec<(Row, Col)> {
        let Properties { viewport, entries_size, row_count, col_count } = properties;
        let mut visible_entries = self.visible_entries.borrow_mut();
        let mut free_entries = self.free_entries.borrow_mut();
        let visible_rows = visible_rows(&viewport, entries_size, row_count);
        let visible_cols = visible_columns(&viewport, entries_size, col_count);
        let no_longer_visible = visible_entries.drain_filter(|(row, col), _| {
            !visible_rows.contains(row) || !visible_cols.contains(col)
        });
        let detached = no_longer_visible.map(|(_, entry)| {
            entry.unset_parent();
            entry
        });
        free_entries.extend(detached);
        let uncovered = all_visible_locations(&viewport, entries_size, row_count, col_count)
            .filter(|loc| !visible_entries.contains_key(loc));
        uncovered.collect_vec()
    }

    fn update_after_entries_size_change(&self, properties: Properties) -> Vec<(Row, Col)> {
        let to_model_request = self.update_entries_visibility(properties);
        for ((row, col), visible_entry) in &*self.visible_entries.borrow() {
            set_entry_position(visible_entry, *row, *col, properties.entries_size);
        }
        to_model_request
    }

    fn reset_entries(&self, properties: Properties) -> Vec<(Row, Col)> {
        let Properties { viewport, entries_size, row_count, col_count } = properties;
        let mut visible_entries = self.visible_entries.borrow_mut();
        let mut free_entries = self.free_entries.borrow_mut();
        let detached = visible_entries.drain().map(|(_, entry)| {
            entry.unset_parent();
            entry
        });
        free_entries.extend(detached);
        all_visible_locations(&viewport, entries_size, row_count, col_count).collect_vec()
    }

    fn drop_all_entries(&self, properties: Properties) -> Vec<(Row, Col)> {
        let to_model_request = self.reset_entries(properties);
        self.free_entries.borrow_mut().clear();
        to_model_request
    }
}

impl<E: Entry> Model<E, E::Params> {
    fn update_entry(
        &self,
        row: Row,
        col: Col,
        model: E::Model,
        entry_size: Vector2,
        text_layer: &Option<WeakLayer>,
    ) {
        use std::collections::hash_map::Entry::*;
        let mut visible_entries = self.visible_entries.borrow_mut();
        let mut free_entries = self.free_entries.borrow_mut();
        let create_new_entry = || {
            let text_layer = text_layer.as_ref().and_then(|l| l.upgrade());
            self.entry_creation_ctx.create_entry(&text_layer)
        };
        let entry = match visible_entries.entry((row, col)) {
            Occupied(entry) => entry.into_mut(),
            Vacant(lack_of_entry) => {
                let new_entry = free_entries.pop().unwrap_or_else(create_new_entry);
                set_entry_position(&new_entry, row, col, entry_size);
                self.display_object.add_child(&new_entry);
                lack_of_entry.insert(new_entry)
            }
        };
        entry.frp().set_model(model);
    }
}



// ================
// === GridView ===
// ================

/// A template for [`GridView`] structure, where entry parameters and model are separate generic
/// arguments.
///
/// It may be useful when using GridView in parametrized structs, where we want to avoid rewriting
/// `Entry` bound in each place. Otherwise, it's better to use [`GridView`].
///
/// Note that some bounds are still required, as we use [`Widget`] and [`Frp`] nodes.
#[derive(CloneRef, Debug, Deref, Derivative)]
#[derivative(Clone(bound = ""))]
pub struct GridViewTemplate<
    Entry: 'static,
    EntryModel: frp::node::Data,
    EntryParams: frp::node::Data,
> {
    widget: Widget<Model<Entry, EntryParams>, Frp<EntryModel, EntryParams>>,
}

/// Grid View Component.
///
/// This Component displays any kind of entry `E` in a grid. To have it working, you need to
/// * Set entries size ([`Frp::set_entries_size`]),
/// * Declare (and keep up-to-date) the visible area ([`Frp::set_viewport`]),
/// * Set up logic for providing models (see _Requesting for Models_ section).
/// * Optionally: entries parameters, if given entry does not have sensible default.
/// * Finally, reset the content, providing number of rows and columns ([`Frp::reset_entries`]).
///
/// # Positioning
///
/// Please mark, that this structure has its left-top corner docked to (0, 0) point of parent
/// display object, as this is a more intuitive way with handling grids.
///
/// # Entries Instantiation
///
/// The entry should implement [`Entry`] trait. Entries are instantiated lazily, only those visible
/// in provided [`Frp::view_area`]. Once entries are no longer visible, are detached, but not
/// dropped and may be re-used to display new entries when needed. This way we can achieve very
/// efficient scrolling.
///
/// ## Requesting for Models
///
/// Once an entry is uncovered, the Grid View emits [`Frp::model_for_entry_needed`]. Then the proper
/// model should be provided using [`Frp::model_for_entry`] endpoint - only then the entry will be
/// displayed.
///
/// **Important**. The [`Frp::model_for_entry_needed`] are emitted once when needed and not repeated
/// anymore, after adding connections to this FRP node in particular. Therefore, be sure, that you
/// connect providing models logic before emitting any of [`Frp::set_entries_size`] or
/// [`Frp::set_viewport`].  
pub type GridView<E> = GridViewTemplate<E, <E as Entry>::Model, <E as Entry>::Params>;

impl<E: Entry> GridView<E> {
    /// Create new Grid View.
    pub fn new(app: &Application) -> Self {
        let frp = Frp::new();
        let network = frp.network();
        let input = &frp.private.input;
        let out = &frp.private.output;
        frp::extend! { network
            set_entry_size <- input.set_entries_size.sampler();
            set_entry_params <- input.set_entries_params.sampler();
        }
        let entry_creation_ctx = EntryCreationCtx {
            app:              app.clone_ref(),
            network:          network.downgrade(),
            set_entry_size:   set_entry_size.into(),
            set_entry_params: set_entry_params.into(),
        };
        let model = Rc::new(Model::new(entry_creation_ctx));
        frp::extend! { network
            out.row_count <+ input.reset_entries._0();
            out.column_count <+ input.reset_entries._1();
            out.viewport <+ input.set_viewport;
            out.entries_size <+ input.set_entries_size;
            out.entries_params <+ input.set_entries_params;
            prop <- all_with4(
                &out.row_count, &out.column_count, &out.viewport, &out.entries_size,
                |&row_count, &col_count, &viewport, &entries_size| {
                    Properties { row_count, col_count, viewport, entries_size }
                }
            );

            content_size_params <- all(input.reset_entries, input.set_entries_size);
            out.content_size <+ content_size_params.map(|&((rows, cols), esz)| Self::content_size(rows, cols, esz));

            request_models_after_vis_area_change <=
                input.set_viewport.map2(&prop, f!((_, p) model.update_entries_visibility(*p)));
            request_models_after_entry_size_change <= input.set_entries_size.map2(
                &prop,
                f!((_, p) model.update_after_entries_size_change(*p))
            );
            request_models_after_reset <=
                input.reset_entries.map2(&prop, f!((_, p) model.reset_entries(*p)));
            request_models_after_text_layer_change <=
                input.set_text_layer.map2(&prop, f!((_, p) model.drop_all_entries(*p)));
            out.model_for_entry_needed <+ request_models_after_vis_area_change;
            out.model_for_entry_needed <+ request_models_after_entry_size_change;
            out.model_for_entry_needed <+ request_models_after_reset;
            out.model_for_entry_needed <+ request_models_after_text_layer_change;

            model_prop_and_layer <-
                input.model_for_entry.map3(&prop, &input.set_text_layer, |model, prop, layer| (model.clone(), *prop, layer.clone()));
            eval model_prop_and_layer
                ((((row, col, entry_model), prop, layer): &((Row, Col, E::Model), Properties, Option<WeakLayer>))
                    model.update_entry(*row, *col, entry_model.clone(), prop.entries_size, layer)
                );
        }
        let display_object = model.display_object.clone_ref();
        let widget = Widget::new(app, frp, model, display_object);
        Self { widget }
    }

    fn content_size(row_count: Row, col_count: Col, entries_size: Vector2) -> Vector2 {
        let x = col_count as f32 * entries_size.x;
        let y = row_count as f32 * entries_size.y;
        Vector2(x, y)
    }
}

impl<Entry, EntryModel: frp::node::Data, EntryParams: frp::node::Data> display::Object
    for GridViewTemplate<Entry, EntryModel, EntryParams>
{
    fn display_object(&self) -> &display::object::Instance {
        self.widget.display_object()
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Copy, Clone, CloneRef, Debug, Default)]
    struct TestEntryParams {
        param: Immutable<usize>,
    }

    #[derive(Clone, CloneRef, Debug)]
    struct TestEntry {
        frp:            EntryFrp<Self>,
        param_set:      Rc<Cell<usize>>,
        model_set:      Rc<Cell<usize>>,
        display_object: display::object::Instance,
    }

    impl Entry for TestEntry {
        type Model = Immutable<usize>;
        type Params = TestEntryParams;

        fn new(_app: &Application, _: &Option<Layer>) -> Self {
            let frp = entry::EntryFrp::<Self>::new();
            let network = frp.network();
            let param_set = Rc::new(Cell::new(0));
            let model_set = Rc::new(Cell::new(0));
            let display_object = display::object::Instance::new(Logger::new("TestEntry"));
            frp::extend! { network
                eval frp.input.set_model ((model) model_set.set(**model));
                eval frp.input.set_params ((param) param_set.set(*param.param));
            }
            Self { frp, param_set, model_set, display_object }
        }

        fn frp(&self) -> &EntryFrp<Self> {
            &self.frp
        }
    }

    impl display::Object for TestEntry {
        fn display_object(&self) -> &display::object::Instance {
            &self.display_object
        }
    }

    #[test]
    fn initializing_grid_view() {
        let app = Application::new("root");
        let grid_view = GridView::<TestEntry>::new(&app);
        let network = grid_view.network();
        frp::extend! { network
            updates_requested <- grid_view.model_for_entry_needed.count().sampler();
        }

        let vis_area = Viewport { left: 0.0, top: 0.0, right: 100.0, bottom: -100.0 };
        grid_view.set_entries_size(Vector2(20.0, 20.0));
        grid_view.reset_entries(100, 100);
        grid_view.set_viewport(vis_area);
        grid_view.set_entries_params(TestEntryParams { param: Immutable(13) });

        assert_eq!(grid_view.model().visible_entries.borrow().len(), 0);
        assert_eq!(updates_requested.value(), 25);

        for i in 0..5 {
            for j in 0..5 {
                grid_view.model_for_entry(i, j, Immutable(i * 200 + j));
            }
        }

        {
            let created_entries = grid_view.model().visible_entries.borrow();
            assert_eq!(created_entries.len(), 25);
            for ((row, col), entry) in created_entries.iter() {
                assert_eq!(entry.model_set.get(), row * 200 + col);
                assert_eq!(entry.param_set.get(), 13);
            }
        }
    }

    #[test]
    fn updating_entries_after_viewport_change() {
        let app = Application::new("root");
        let grid_view = GridView::<TestEntry>::new(&app);
        let network = grid_view.network();
        let initial_vis_area = Viewport { left: 0.0, top: 0.0, right: 100.0, bottom: -100.0 };
        grid_view.set_entries_size(Vector2(20.0, 20.0));
        grid_view.reset_entries(100, 100);
        grid_view.set_viewport(initial_vis_area);
        grid_view.set_entries_params(TestEntryParams { param: Immutable(13) });

        for i in 0..5 {
            for j in 0..5 {
                grid_view.model_for_entry(i, j, Immutable(i * 200 + j));
            }
        }

        frp::extend! { network
            updates_requested <- grid_view.model_for_entry_needed.count().sampler();
        }

        let uncovering_new_entries =
            Viewport { left: 5.0, top: -5.0, right: 105.0, bottom: -105.0 };
        grid_view.set_viewport(uncovering_new_entries);
        assert_eq!(updates_requested.value(), 11);
        assert_eq!(grid_view.model().visible_entries.borrow().len(), 25);

        for i in 0..6 {
            grid_view.model_for_entry(5, i, Immutable(200 * 5 + i));
        }
        for i in 0..5 {
            grid_view.model_for_entry(i, 5, Immutable(200 * i + 5));
        }
        assert_eq!(grid_view.model().visible_entries.borrow().len(), 36);

        let hiding_old_entries =
            Viewport { left: 20.0, top: -20.0, right: 120.0, bottom: -120.0 };
        grid_view.set_viewport(hiding_old_entries);
        assert_eq!(updates_requested.value(), 11); // Count should not change.
        assert_eq!(grid_view.model().visible_entries.borrow().len(), 25);
        assert_eq!(grid_view.model().free_entries.borrow().len(), 11);
    }
}
