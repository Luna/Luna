//! Example scene showing a grid view with Component Group Entries.

#![recursion_limit = "512"]
// === Features ===
#![allow(incomplete_features)]
#![feature(negative_impls)]
#![feature(associated_type_defaults)]
#![feature(bool_to_option)]
#![feature(cell_update)]
#![feature(const_type_id)]
#![feature(drain_filter)]
#![feature(entry_insert)]
#![feature(fn_traits)]
#![feature(marker_trait_attr)]
#![feature(specialization)]
#![feature(trait_alias)]
#![feature(type_alias_impl_trait)]
#![feature(unboxed_closures)]
#![feature(trace_macros)]
#![feature(const_trait_impl)]
#![feature(slice_as_chunks)]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
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

use ensogl_core::prelude::*;
use wasm_bindgen::prelude::*;

use ensogl_core::application::Application;
use ensogl_core::data::color;
use ensogl_core::display::object::ObjectOps;
use ensogl_core::display::scene;
use ensogl_core::display::shape::StyleWatch;
use ensogl_core::frp;
use ensogl_grid_view as grid_view;
use ensogl_grid_view::Col;
use ensogl_grid_view::Row;
use ensogl_hardcoded_theme as theme;
use ensogl_text as text;
use ide_view_component_list_panel::grid;
use ide_view_component_list_panel::grid::entry::icon;


// ====================
// === Mock Entries ===
// ====================

const PREPARED_ITEMS: &[(&str, icon::Id)] = &[
    // ("long sample entry with text overflowing the width", icon::Id::Star),
    ("convert", icon::Id::Convert),
    ("table input", icon::Id::DataInput),
    ("text input", icon::Id::TextInput),
    ("number input", icon::Id::NumberInput),
    ("table output", icon::Id::TableEdit),
    ("dataframe clean", icon::Id::DataframeClean),
    ("data input", icon::Id::DataInput),
];

const fn make_group(section: grid::SectionId, index: usize, size: usize) -> grid::content::Group {
    let group_id = grid::GroupId { section, index };
    grid::content::Group {
        id:              group_id,
        height:          size,
        original_height: size,
        color:           None,
    }
}

const GROUPS: &[grid::content::Group] = &[
    make_group(grid::SectionId::Popular, 1, 3),
    make_group(grid::SectionId::Popular, 2, 2),
    make_group(grid::SectionId::Popular, 3, 1),
    make_group(grid::SectionId::Popular, 4, 3),
    make_group(grid::SectionId::Popular, 5, 2),
    make_group(grid::SectionId::Popular, 6, 6),
    make_group(grid::SectionId::Popular, 7, 6),
    make_group(grid::SectionId::Popular, 8, 6),
    make_group(grid::SectionId::Popular, 9, 5),
    make_group(grid::SectionId::Popular, 10, 4),
    make_group(grid::SectionId::Popular, 11, 8),
    make_group(grid::SectionId::Popular, 12, 45),
    make_group(grid::SectionId::Popular, 13, 60),
    make_group(grid::SectionId::Popular, 14, 51),
];

const LOCAL_SCOPE_GROUP_SIZE: usize = 12;

fn content_info() -> grid::content::Info {
    grid::content::Info {
        groups:           GROUPS.into(),
        local_scope_size: LOCAL_SCOPE_GROUP_SIZE,
    }
}

fn get_header_model(group: grid::GroupId) -> Option<(grid::GroupId, grid::HeaderModel)> {
    let model = grid::HeaderModel { caption: format!("Group {}", group.index).into() };
    Some((group, model))
}

fn get_entry_model(entry: grid::GroupEntryId) -> Option<(grid::GroupEntryId, grid::EntryModel)> {
    let (caption, icon) = PREPARED_ITEMS[entry.entry % PREPARED_ITEMS.len()];
    let highlighted = if entry.entry == 4 {
        vec![text::Range::new(text::Bytes(2), text::Bytes(4))]
    } else {
        vec![]
    };
    let model =
        grid::EntryModel { caption: caption.into(), highlighted: Rc::new(highlighted), icon };
    Some((entry, model))
}



// ===================
// === Entry Point ===
// ===================

/// The example entry point.
#[entry_point]
#[allow(dead_code)]
pub fn main() {
    ensogl_text_msdf::run_once_initialized(|| {
        tracing::warn!("START");
        let app = Application::new("root");
        tracing::warn!("Eh? ");
        theme::builtin::light::register(&app);
        tracing::warn!("Hmm...");
        theme::builtin::light::enable(&app);

        let world = &app.display;
        let scene = &world.default_scene;
        // let main_layer = &app.display.default_scene.layers.node_searcher;
        // let grid_layer = main_layer.create_sublayer();
        // let selection_layer = main_layer.create_sublayer();
        // let style = StyleWatch::new(&scene.style_sheet);
        // let group_color_paths = vec![
        //     column_grid::entry_color_0,
        //     column_grid::entry_color_1,
        //     column_grid::entry_color_2,
        //     column_grid::entry_color_3,
        //     column_grid::entry_color_4,
        //     column_grid::entry_color_5,
        // ];
        // let group_colors =
        //     group_color_paths.into_iter().map(|path| style.get_color(path)).collect();
        // let entry_size = Vector2(133.0, 30.0);
        let panel = app.new_view::<ide_view_component_list_panel::View>();
        tracing::warn!("Huh? ");
        panel.show();
        // panel.set_position_xy(Vector2(-200.0, 200.0));
        let network = frp::Network::new("new_component_list_panel_view");
        //TODO[ao] should be done by panel itself.
        let adjust_pixels = f!([panel](&shape: &scene::Shape) {
            let device_size = shape.device_pixels();
            let origin_left_top_pos = Vector2(device_size.width, device_size.height)/ 2.0;
            let adjusted_left_top_pos = Vector2(origin_left_top_pos.x.floor(), origin_left_top_pos.y.floor());
            let offset = adjusted_left_top_pos - origin_left_top_pos;
            panel.set_position_xy(offset);
        });
        let grid = &panel.model().grid;
        frp::extend! { network
            grid.model_for_header <+ grid.model_for_header_needed.filter_map(|&id| get_header_model(id));
            grid.model_for_entry <+ grid.model_for_entry_needed.filter_map(|&id| get_entry_model(id));
            _adjust <- scene.frp.shape.map(adjust_pixels);
        }

        // grid.selection_highlight_frp().setup_masked_layer(Some(selection_layer.downgrade()));
        // grid.selection_highlight_frp().set_entries_params(selection_params);
        // grid.reset_entries(provider.layout.row_count(), provider.layout.column_count());
        // grid.set_column_width((1, entry_size.x + params.style.column_gap * 2.0));
        grid.reset(content_info());
        scene.add_child(&panel);
        mem::forget(app);
        mem::forget(panel);
        mem::forget(network);
    })
}
