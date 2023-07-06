//! FIXME[everyone] Modules should be documented.

use crate::prelude::*;
use enso_text::unit::*;

use crate::application::tooltip;
use crate::application::tooltip::Placement;
use crate::component::node;
use crate::component::type_coloring;
use crate::view;
use crate::Type;

use enso_frp as frp;
use ensogl::animation::delayed::DelayedAnimation;
use ensogl::application::Application;
use ensogl::control::io::mouse;
use ensogl::data::color;
use ensogl::display;
use ensogl::display::shape::Rectangle;
use ensogl::display::shape::StyleWatch;
use ensogl::display::shape::StyleWatchFrp;
use ensogl::display::shape::INVISIBLE_HOVER_COLOR;
use ensogl::gui::text;
use ensogl::Animation;


// =================
// === Constants ===
// =================

const PORT_LINE_WIDTH: f32 = 4.0;
const PORT_OPACITY_HOVERED: f32 = 1.0;
const PORT_OPACITY_NOT_HOVERED: f32 = 0.25;
const SEGMENT_GAP_WIDTH: f32 = 2.0;
const HOVER_AREA_PADDING: f32 = 20.0;
const FULL_TYPE_ONSET_DELAY_MS: f32 = 2000.0;
const LABEL_OFFSET: f32 = 10.0;

const TOOLTIP_LOCATION: Placement = Placement::Bottom;

// We have currently implemented two possible ways to display the output types of ports on hover:
// as a tooltip next to the mouse coursor or as a label that is fixed right next to the port itself.
// Right now, there is no final decision, which one we will keep. Therefore, we have the following
// two constants which can be used to turn those methods on or off.
const SHOW_TYPE_AS_TOOLTIP: bool = false;
const SHOW_TYPE_AS_LABEL: bool = true;



// ==================
// === Shape View ===
// ==================

/// Generic port shape implementation. The shape is of the width of the whole node and is used as a
/// base shape for all port drawing. In case of a multi-port output, the shape is cropped from both
/// sides for each port separately. The shape looks roughly like this:

/// ```text
///  ╭╮                            ╭╮
///  │╰────────────────────────────╯│ ▲ height
///  ╰──────────────────────────────╯ ▼ (base node size / 2) + PORT_LINE_WIDTH
///  ◄──────────────────────────────►
///   total width = node width + PORT_LINE_WIDTH * 2
/// ```
///
/// The corners are rounded to follow the node corner radius. The shape also contains an underlying
/// hover area with a padding defined as `HOVER_AREA_PADDING`.
#[derive(Debug)]
#[allow(missing_docs)]
pub struct ShapeView {
    pub root:            display::object::Instance,
    pub main:            Rectangle,
    /// Interactive shape above the port. Note: It is NOT a child of the `root`. Instead, it is
    /// placed within the `hover_root` of the output area.
    pub hover:           Rectangle,
    pub type_label:      text::Text,
    pub end_cap_left:    Option<Rectangle>,
    pub end_cap_right:   Option<Rectangle>,
    pub number_of_ports: usize,
    pub port_index:      usize,
    pub size_multiplier: Cell<f32>,
}

impl ShapeView {
    #[profile(Debug)]
    fn new(app: &Application, number_of_ports: usize, port_index: usize) -> Self {
        let root = display::object::Instance::new();
        let main = Rectangle();

        let type_label = app.new_view::<text::Text>();
        type_label.set_y(-LABEL_OFFSET);


        // depending on the position of port, keep either the bottom left, bottom right, both or
        // neither corners of the main shape.
        let is_first = port_index == 0;
        let is_last = port_index == number_of_ports - 1;
        let main_radius = node::CORNER_RADIUS + PORT_LINE_WIDTH;
        match (is_first, is_last) {
            (true, true) => main.keep_bottom_half().set_corner_radius(main_radius),
            (true, false) => main.keep_bottom_left_quarter().set_corner_radius(main_radius),
            (false, true) => main.keep_bottom_right_quarter().set_corner_radius(main_radius),
            (false, false) => main.keep_bottom_half(),
        };
        main.set_pointer_events(false);

        let make_end_cap = || {
            let end_cap = Rectangle();
            end_cap
                .set_size((PORT_LINE_WIDTH, PORT_LINE_WIDTH / 2.0))
                .set_corner_radius(PORT_LINE_WIDTH)
                .keep_top_half();
            end_cap.set_pointer_events(false);
            // End caps are positioned right above the main port line shape.
            let port_total_height = node::HEIGHT * 0.5 + PORT_LINE_WIDTH;
            end_cap.set_y(port_total_height);
            root.add_child(&end_cap);
            end_cap
        };

        let end_cap_left = is_first.then(make_end_cap);
        let end_cap_right = is_last.then(make_end_cap);

        let hover = Rectangle();
        let hover_radius = node::CORNER_RADIUS + HOVER_AREA_PADDING;
        match (is_first, is_last) {
            (true, true) => hover.keep_bottom_half().set_corner_radius(hover_radius),
            (true, false) => hover.keep_bottom_left_quarter().set_corner_radius(hover_radius),
            (false, true) => hover.keep_bottom_right_quarter().set_corner_radius(hover_radius),
            (false, false) => hover.keep_bottom_half(),
        };
        hover.set_color(INVISIBLE_HOVER_COLOR);
        hover.set_pointer_events(true);

        root.set_y(-PORT_LINE_WIDTH);
        hover.set_y(-HOVER_AREA_PADDING);
        hover.set_color(color::Rgba(0.3, 0.0, 0.0, 1.0));
        root.add_child(&main);
        Self {
            root,
            main,
            hover,
            end_cap_left,
            end_cap_right,
            number_of_ports,
            port_index,
            type_label,
            size_multiplier: default(),
        }
    }

    /// Set the whole node size at which this port shape is rendered. This set size does not equal
    /// the size of the port shape itself.
    fn set_size(&self, size: Vector2) {
        // The center of coordinate space is at the center of the node. Let's calculate everything
        // relative to bottom left corner of the node, and then translate it at the end.
        let node_bottom_left = -size / 2.0;
        self.root.set_xy(node_bottom_left);

        // The straight line part of the shape is divided equally between all ports, taking gaps
        // into account.
        let straight_line_width = size.x - node::CORNER_RADIUS * 2.0;
        let number_of_gaps = self.number_of_ports - 1;
        let total_gap_space =
            (number_of_gaps as f32 * SEGMENT_GAP_WIDTH).min(straight_line_width * 0.5);
        let single_gap_width = total_gap_space / number_of_gaps as f32;
        let space_to_divide = straight_line_width - total_gap_space;
        let single_port_width = space_to_divide / self.number_of_ports as f32;

        let line_space_before_port =
            (single_port_width + single_gap_width) * self.port_index as f32;

        // Ports at either end receive additional space to fill the rounded corners. This space
        // also includes the width of the port line.
        let corner_space = PORT_LINE_WIDTH + node::CORNER_RADIUS;
        let is_first = self.port_index == 0;
        let is_last = self.port_index == self.number_of_ports - 1;
        let left_corner = if is_first { corner_space } else { 0.0 };
        let right_corner = if is_last { corner_space } else { 0.0 };
        let corner_before_port = if is_first { 0.0 } else { corner_space };

        let port_left_position = line_space_before_port + corner_before_port - PORT_LINE_WIDTH;
        let port_total_width = single_port_width + left_corner + right_corner;

        let hover_corner_pad = HOVER_AREA_PADDING - PORT_LINE_WIDTH;
        let hover_pad_left = if is_first { hover_corner_pad } else { SEGMENT_GAP_WIDTH * 0.5 };
        let hover_pad_right = if is_last { hover_corner_pad } else { SEGMENT_GAP_WIDTH * 0.5 };
        let hover_left_position = port_left_position - hover_pad_left;
        let hover_total_width = port_total_width + hover_pad_left + hover_pad_right;

        // The height of the base port shape is enough to cover half of the single-line node
        // height, plus the width of the port line.
        let port_total_height = node::HEIGHT * 0.5 + PORT_LINE_WIDTH;
        let hover_total_height = node::HEIGHT * 0.5 + HOVER_AREA_PADDING;

        self.main.set_x(port_left_position);
        // Note that `hover` is not parented to `root`, so we need to translate it manually.
        self.hover.set_xy(node_bottom_left + Vector2(hover_left_position, 0.0));
        self.main.set_size((port_total_width, port_total_height));
        self.hover.set_size((hover_total_width, hover_total_height));

        let label_width = self.type_label.width.value();
        let label_x = port_left_position + port_total_width * 0.5 - label_width * 0.5;
        self.type_label.set_x(label_x);
        self.end_cap_right.as_ref().map(|cap| cap.set_x(size.x));
    }

    fn set_size_multiplier(&self, multiplier: f32) {
        self.size_multiplier.set(multiplier);
        let current_width = PORT_LINE_WIDTH * multiplier;
        let current_inset = PORT_LINE_WIDTH - current_width;
        self.main.set_inset(current_inset);
        let cap_size = (current_width, current_width * 2.0);
        self.end_cap_left.as_ref().map(|cap| cap.set_size(cap_size).set_x(-current_width));
        self.end_cap_right.as_ref().map(|cap| cap.set_size(cap_size));
    }

    fn set_color(&self, color: color::Rgba) {
        self.main.set_color(color);
        self.end_cap_left.as_ref().map(|cap| cap.set_color(color));
        self.end_cap_right.as_ref().map(|cap| cap.set_color(color));
    }
}

impl display::Object for ShapeView {
    fn display_object(&self) -> &display::object::Instance {
        &self.root
    }
}



// =================
// === Port Frp  ===
// =================

ensogl::define_endpoints! {
    Input {
        set_size_multiplier       (f32),
        set_definition_type       (Option<Type>),
        set_usage_type            (Option<Type>),
        set_type_label_visibility (bool),
        set_size                  (Vector2),
        set_view_mode             (view::Mode),
    }

    Output {
        tp       (Option<Type>),
        on_hover (bool),
        on_press (),
        tooltip  (tooltip::Style),
        size     (Vector2),
    }
}

#[derive(Debug)]
#[allow(missing_docs)] // FIXME[everyone] Public-facing API should be documented.
pub struct Model {
    pub frp:    Frp,
    pub shape:  Rc<ShapeView>,
    pub index:  ByteDiff,
    pub length: ByteDiff,
}

impl Model {
    #[allow(missing_docs)] // FIXME[everyone] All pub functions should have docs.
    pub fn new(
        app: &Application,
        styles: &StyleWatch,
        styles_frp: &StyleWatchFrp,
        port_index: usize,
        port_count: usize,
        index: ByteDiff,
        length: ByteDiff,
    ) -> Self {
        let port_count = max(port_count, 1);
        let shape = ShapeView::new(app, port_count, port_index);

        let frp = Frp::new();
        let mut this = Self { frp, shape: Rc::new(shape), index, length };
        this.init_frp(styles, styles_frp);
        this
    }

    fn init_frp(&mut self, styles: &StyleWatch, styles_frp: &StyleWatchFrp) {
        let frp = &self.frp;
        let shape = &self.shape;
        let network = &frp.network;
        let color = color::Animation::new(network);
        let type_label_opacity = Animation::<f32>::new(network);
        let full_type_timer = DelayedAnimation::new(network);
        full_type_timer.set_delay(FULL_TYPE_ONSET_DELAY_MS);
        full_type_timer.set_duration(0.0);

        frp::extend! { network
            init <- source_();

            // === Mouse Event Handling ===

            let mouse_down = shape.hover.on_event::<mouse::Down>();
            let mouse_out = shape.hover.on_event::<mouse::Out>();
            let mouse_over = shape.hover.on_event::<mouse::Over>();
            mouse_down_primary <- mouse_down.filter(mouse::is_primary);

            is_hovered <- bool(&mouse_out,&mouse_over);
            frp.source.on_hover <+ is_hovered;
            frp.source.on_press <+ mouse_down_primary.constant(());


            // === Size ===

            frp.source.size <+ frp.set_size;
            _eval <- all_with(&frp.size,&shape.type_label.width, f!((s, _) shape.set_size(*s)));
            eval frp.set_size_multiplier ((t) shape.set_size_multiplier(*t));

            // === Type ===

            frp.source.tp <+ all_with(&frp.set_usage_type,&frp.set_definition_type,
                |usage_tp,def_tp| usage_tp.clone().or_else(|| def_tp.clone())
            );

            normal_color <- frp.tp.map(f!([styles](t)
                type_coloring::compute_for_selection(t.as_ref(),&styles)));
            let profiling_color = styles_frp.get_color_lcha(ensogl_hardcoded_theme::code::types::any::selection);
            in_profiling_mode <- frp.set_view_mode.map(|mode| mode.is_profiling());
            color_base <- in_profiling_mode.switch(&normal_color,&profiling_color);
            is_hovered <- all(is_hovered, init)._0();
            color_opacity <- is_hovered.switch_constant(PORT_OPACITY_NOT_HOVERED, PORT_OPACITY_HOVERED);
            color.target <+ color_base.all_with(&color_opacity, |c, a| c.multiply_alpha(*a));
            eval color.value ((t) shape.set_color(t.into()));

            full_type_timer.start <+ frp.on_hover.on_true();
            full_type_timer.reset <+ type_label_opacity.value.filter(|&o| o == 0.0).constant(());
            showing_full_type     <- bool(&full_type_timer.on_reset,&full_type_timer.on_end);
            type_description      <- all_with(&frp.tp,&showing_full_type,|tp,&show_full_tp| {
                tp.map_ref(|tp| {
                    if show_full_tp { tp.to_im_string() } else { tp.abbreviate().to_im_string() }
                })
            });
        }
        init.emit(());

        if SHOW_TYPE_AS_LABEL {
            frp::extend! { network

                // === Type Label ===

                type_label_visibility <- frp.on_hover.and(&frp.set_type_label_visibility);
                on_type_label_visible <- type_label_visibility.on_true();
                type_label_opacity.target <+ on_type_label_visible.constant(PORT_OPACITY_HOVERED);
                type_label_opacity.target <+ type_label_visibility.on_false().constant(0.0);

                type_label_color <- all_with(&color.value,&type_label_opacity.value,
                    |color,&opacity| color.opaque.with_alpha(opacity));
                shape.type_label.set_property_default <+ type_label_color.ref_into_some();
                shape.type_label.set_content <+ type_description.map(|s| s.clone().unwrap_or_default());
            }
        }

        if SHOW_TYPE_AS_TOOLTIP {
            frp::extend! { network

                // === Tooltip ===

                frp.source.tooltip <+ all_with(&type_description,&frp.on_hover,|text,&hovering| {
                    if hovering {
                        if let Some(text) = text.clone() {
                            tooltip::Style::set_label(text.into()).with_placement(TOOLTIP_LOCATION)
                        } else {
                            tooltip::Style::unset_label()
                        }
                    } else {
                            tooltip::Style::unset_label()
                    }
                });
            }
        }

        color.target.emit(type_coloring::compute_for_code(None, styles));
    }
}
