//! Wrapper around multiple `component_group::View` that provides a layout where the
//! `component_group::View` are stacked in three columns. Designed for use in the sections of a
//! Component Browser Panel.

use ensogl_core::display::shape::*;
use ensogl_core::prelude::*;

use enso_frp as frp;
use ensogl_core::application::frp::API;
use ensogl_core::application::Application;
use ensogl_core::data::color;
use ensogl_core::define_endpoints_2;
use ensogl_core::display;
use ensogl_core::display::object::ObjectOps;
use ensogl_core::display::style;
use ensogl_gui_component::component;
use ensogl_list_view as list_view;
use ide_view_component_group as component_group;
use ide_view_component_group::Layers;
use ordered_float::OrderedFloat;


// =============
// === Model ===
// =============

/// Contains a `AnyModelProvider` with a label. Can be used to populate a `component_group::View`.
#[derive(Clone, Debug, Default)]
pub struct LabeledAnyModelProvider {
    /// Label of the data provided to be used as a header of the list.
    pub label:   String,
    /// Content to be used to populate a list.
    pub content: list_view::entry::AnyModelProvider<component_group::Entry>,
}



// =============
// === Model ===
// =============

/// The Model of the [`ColumnGrid`] component.
#[derive(Clone, Debug, CloneRef)]
pub struct Model {
    app:            Application,
    display_object: display::object::Instance,
    content:        Rc<RefCell<Vec<component_group::View>>>,
    size:           Rc<Cell<Vector2>>,
}

impl Model {
    fn new(app: &Application) -> Self {
        let logger = Logger::new("ColumnGrid");
        let app = app.clone_ref();
        let display_object = display::object::Instance::new(&logger);

        Self { app, display_object, content: default(), size: default() }
    }

    fn update_content_layout(
        &self,
        content: &[LabeledAnyModelProvider],
        layout: &Layout,
    ) -> Vector2 {
        const COLUMN_NUMBER: usize = 3;
        let overall_width = crate::WIDTH_INNER - 2.0 * crate::PADDING_INNER;
        let column_width = (overall_width - 2.0 * layout.column_gap) / COLUMN_NUMBER as f32;
        let content = content
            .iter()
            .map(|LabeledAnyModelProvider { content, label }| {
                let view = self.app.new_view::<component_group::View>();
                view.set_width(column_width);
                view.set_entries(content);
                view.set_header(label.as_str());
                self.display_object.add_child(&view);
                view
            })
            .collect_vec();

        let mut columns = vec![vec![]; COLUMN_NUMBER];
        // We need to subtract one `column_gap` as we only need (n-1) gaps, but through iteration
        // below we add one gap per item. So we initialise the heights with `-column_gap`.
        let mut heights = [-layout.column_gap; COLUMN_NUMBER];

        for (ix, entry) in content.iter().enumerate() {
            let column_index = ix % COLUMN_NUMBER;
            columns[column_index].push(entry);
            heights[column_index] += entry.size.value().y + layout.column_gap;
        }
        let height: f32 = heights.into_iter().map(OrderedFloat).max().unwrap().into();


        let mut entry_ix = 0;
        for (ix, column) in columns.iter().enumerate() {
            let pos_x = (column_width + layout.column_gap) * (ix as f32 + 0.5);
            let mut pos_y = -height;
            for entry in column {
                let entry_height = entry.size.value().y;
                entry.set_position_y(pos_y + entry_height / 2.0);
                entry.set_position_x(pos_x);

                entry.set_color(layout.get_entry_color_for_index(entry_ix));
                entry_ix += 1;

                pos_y += entry_height;
                pos_y += layout.column_gap;
            }
        }

        *self.content.borrow_mut() = content;
        let height: f32 = heights.into_iter().map(OrderedFloat).max().unwrap().into();
        let width = self.size.get().x;
        self.size.set(Vector2::new(width, height));
        self.size.get()
    }

    /// Assign a set of layers to render the component group in. Must be called after constructing
    /// the [`View`].
    pub fn set_layers(&self, layers: &Layers, scroll_layer: &display::scene::Layer) {
        self.content.borrow().iter().for_each(|entry| entry.model().set_layers(layers));
        scroll_layer.add_exclusive(&self.display_object);
    }
}

impl display::Object for Model {
    fn display_object(&self) -> &display::object::Instance {
        &self.display_object
    }
}

impl component::Model for Model {
    fn label() -> &'static str {
        "ColumnGrid"
    }

    fn new(app: &Application, _logger: &DefaultWarningLogger) -> Self {
        Self::new(app)
    }
}



// ===========
// === FRP ===
// ===========

#[derive(Clone, Debug, Default)]
struct Layout {
    column_gap:   f32,
    entry_colors: [color::Rgba; 4],
}

impl Layout {
    /// Choose a color from the `entry_colors` based on the index of the entry within the
    /// `ColumnGrid`.
    fn get_entry_color_for_index(&self, ix: usize) -> color::Rgba {
        self.entry_colors[ix % self.entry_colors.len()]
    }
}


define_endpoints_2! {
    Input{
        set_content(Vec<LabeledAnyModelProvider>),
    }
    Output{
        size(Vector2)
    }
}


fn get_layout(
    network: &enso_frp::Network,
    style: &StyleWatchFrp,
) -> (enso_frp::Stream<Layout>, enso_frp::stream::WeakNode<enso_frp::SourceData>) {
    let theme_path : style::Path = ensogl_hardcoded_theme::application::component_browser::searcher::list_panel::section::column_grid::HERE.into();
    let column_gap = style.get_number(theme_path.sub("column_gap"));
    let entry_color_0 = style.get_color(theme_path.sub("entry_color_0"));
    let entry_color_1 = style.get_color(theme_path.sub("entry_color_1"));
    let entry_color_2 = style.get_color(theme_path.sub("entry_color_2"));
    let entry_color_3 = style.get_color(theme_path.sub("entry_color_3"));

    frp::extend! { TRACE_ALL network
        init <- source_();

        entry_colors <- all5(&init, &entry_color_0,&entry_color_1,&entry_color_2,&entry_color_3);
        entry_colors <- entry_colors.map(|(_,c1,c2,c3,c4)| [*c1,*c2,*c3,*c4]);

        layout_update <- all3(&init, &column_gap, &entry_colors);
        layout_update <- layout_update.map(|(_, column_gap,entry_colors)|{
                Layout{column_gap:*column_gap,entry_colors:*entry_colors}
        });

    }
    (layout_update, init)
}

impl component::Frp<Model> for Frp {
    fn init(
        frp_api: &<Self as API>::Private,
        _app: &Application,
        model: &Model,
        style: &StyleWatchFrp,
    ) {
        let network = &frp_api.network;

        let (layout_update, init) = get_layout(network, style);

        frp::extend! { network
            content_update <- all(&frp_api.input.set_content,&layout_update);
            size_update <- content_update.map(f!(((content,layout))
                model.update_content_layout(content,layout))
            );
            frp_api.output.size <+ size_update;
        }
        init.emit(());
    }
}

/// Wrapper around multiple `component_group::View` that provides a layout where the
/// `component_group::View` are stacked in three columns. Designed for use in the sections of a
/// Component Browser Panel.
pub type ColumnGrid = component::ComponentView<Model, Frp>;
