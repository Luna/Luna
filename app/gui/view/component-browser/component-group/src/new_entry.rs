use crate::prelude::*;

use crate::icon;

use crate::set::GroupId;
use crate::set::SectionId;
use enso_frp as frp;
use ensogl_core::application::command::FrpNetworkProvider;
use ensogl_core::application::frp::API;
use ensogl_core::application::Application;
use ensogl_core::data::color;
use ensogl_core::display;
use ensogl_core::display::scene::Layer;
use ensogl_core::display::Scene;
use ensogl_core::Animation;
use ensogl_grid_view as grid_view;
use ensogl_grid_view::entry::Contour;
use ensogl_grid_view::entry::MovedHeaderPosition;
use ensogl_grid_view::entry::ShapeWithEntryContour;
use ensogl_hardcoded_theme::application::component_browser::component_group as theme;
use ensogl_shadow as shadow;
use ensogl_text as text;

// === Header Background ===

// The background of the header. It consists of a rectangle that matches the [`background`] in
// color and a shadow underneath it.
pub mod background {
    use super::*;

    ensogl::define_shape_system! {
        below = [grid_view::entry::overlay, grid_view::selectable::highlight::shape];
        pointer_events = false;
        (style:Style, color:Vector4, height: f32, shadow_height_multiplier: f32) {
            let color = Var::<color::Rgba>::from(color);
            let width: Var<Pixels> = "input_size.x".into();
            let height: Var<Pixels> = height.into();
            let bg = Rect((width.clone(), height.clone())).fill(color);
            // We use wider and shorter rect for the shadow because of the visual artifacts that
            // will appear otherwise:
            // 1. Rounded corners of the shadow are visible if the rect is too narrow. By widening
            //    it we keep the shadow sharp and flat for the whole width of the header.
            // 2. Visual glitching similar to z-fighting occurs on the border of the elements
            //    when the shadow rect has the exact same size as the background. We shrink the
            //    height by 1 pixel to avoid it.
            let shadow_rect = Rect((width * 2.0, height - 1.0.px()));
            let mut shadow_parameters = shadow::parameters_from_style_path(style, theme::header::shadow);
            shadow_parameters.size = shadow_parameters.size * shadow_height_multiplier;
            let shadow = shadow::from_shape_with_parameters(shadow_rect.into(), shadow_parameters);
            (shadow + bg).into()
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Kind {
    #[default]
    Entry,
    Header,
    LocalScopeEntry,
}

#[derive(Clone, Debug, Default)]
pub struct Model {
    pub kind:        Kind,
    pub color:       color::Rgba,
    pub caption:     ImString,
    pub highlighted: Rc<Vec<text::Range<text::Bytes>>>,
    pub icon:        Option<icon::Id>,
    pub group_id:    GroupId,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ColorIntensities {
    pub text:            f32,
    pub background:      f32,
    pub hover_highlight: f32,
    pub dimmed:          f32,
    pub icon_strong:     f32,
    pub icon_weak:       f32,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Style {
    pub color_intensities:        ColorIntensities,
    pub group_width:              f32,
    pub gap_between_groups:       f32,
    pub padding:                  f32,
    pub icon_size:                f32,
    pub text_size:                text::Size,
    pub icon_text_padding:        f32,
    pub font:                     ImString,
    pub selection_corners_radius: f32,
    pub highlight_bold:           f32,
    pub header_shadow_size:       f32,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum DimmedGroups {
    #[default]
    None,
    AllExcept(GroupId),
    AllExceptSection(SectionId),
}

impl DimmedGroups {
    fn is_group_dimmed(self, id: GroupId) -> bool {
        match self {
            Self::None => false,
            Self::AllExcept(undimmed_group) => id != undimmed_group,
            Self::AllExceptSection(undimmed_section) => id.section != undimmed_section,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct Params {
    pub style:         Style,
    pub dimmed_groups: DimmedGroups,
}


/// The structure keeping a currently displayed icon in Component Group Entry [`View`]. Remembering
/// id allows us to skip icon generation when not changed.
#[derive(Debug)]
struct CurrentIcon {
    display_object: display::object::Instance,
    strong_color:   color::Rgba,
    weak_color:     color::Rgba,
    shape:          Option<icon::Any>,
    id:             Option<icon::Id>,
}

impl Default for CurrentIcon {
    fn default() -> Self {
        Self {
            display_object: display::object::Instance::new(Logger::new(
                "component_browser_entry_icon",
            )),
            strong_color:   default(),
            weak_color:     default(),
            shape:          default(),
            id:             default(),
        }
    }
}

impl CurrentIcon {
    fn new() -> Self {
        default()
    }

    fn update(&mut self, new_icon: Option<icon::Id>) {
        if self.id != new_icon {
            self.id = new_icon;
            if let Some(icon_id) = new_icon {
                let shape = icon_id.create_shape(
                    Logger::new("ComponentBrowserEntry"),
                    Vector2(icon::SIZE, icon::SIZE),
                );
                tracing::debug!("Creating new icon {icon_id:?}.");
                shape.strong_color.set(self.strong_color.into());
                shape.weak_color.set(self.weak_color.into());
                self.display_object.add_child(&shape);
                self.shape = Some(shape);
            } else {
                self.shape = None;
            }
        }
    }

    fn set_strong_color(&mut self, color: color::Rgba) {
        self.strong_color = color;
        if let Some(shape) = &self.shape {
            shape.strong_color.set(color.into());
        }
    }

    fn set_weak_color(&mut self, color: color::Rgba) {
        self.weak_color = color;
        if let Some(shape) = &self.shape {
            shape.weak_color.set(color.into());
        }
    }
}

impl display::Object for CurrentIcon {
    fn display_object(&self) -> &display::object::Instance<Scene> {
        &self.display_object
    }
}



/// Colors used in the Component Group View.
///
/// This structure, used in both can be created from single "main color" input. Each of
/// these colors will be computed by mixing "main color" with application background - for details,
/// see [`Colors::from_main_color`].
///
/// `icon_strong` and `icon_weak` parameters represent the more/less contrasting parts of the
/// [icon](crate::icon::Any), they do not represent highlighted state of the icon.
#[allow(missing_docs)]
#[derive(Clone, CloneRef, Debug)]
pub struct Colors {
    pub background:      frp::Sampler<color::Rgba>,
    pub hover_highlight: frp::Sampler<color::Rgba>,
    pub text:            frp::Sampler<color::Rgba>,
    pub icon_strong:     frp::Sampler<color::Rgba>,
    pub icon_weak:       frp::Sampler<color::Rgba>,
}

impl Colors {
    pub fn from_main_color(
        network: &frp::Network,
        style_watch: &StyleWatchFrp,
        color: &frp::Stream<color::Rgba>,
        style: &frp::Stream<Style>,
        is_dimmed: &frp::Stream<bool>,
    ) -> Self {
        fn mix((c1, c2): &(color::Rgba, color::Rgba), coefficient: &f32) -> color::Rgba {
            color::mix(*c1, *c2, *coefficient)
        }
        let app_bg = style_watch.get_color(ensogl_hardcoded_theme::application::background);
        let style = style.clone_ref();

        let intensity = Animation::new(network);
        frp::extend! { network
            init <- source_();

            text_intensity <- style.map(|p| p.color_intensities.text);
            bg_intensity <- style.map(|p| p.color_intensities.background);
            hover_hg_intensity <- style.map(|p| p.color_intensities.hover_highlight);
            dimmed_intensity <- style.map(|p| p.color_intensities.dimmed);
            icon_strong_intensity <- style.map(|p| p.color_intensities.icon_strong);
            icon_weak_intensity <- style.map(|p| p.color_intensities.icon_weak);

            one <- init.constant(1.0);
            let is_dimmed = is_dimmed.clone_ref();
            intensity.target <+ is_dimmed.switch(&one, &dimmed_intensity);
            app_bg <- all(&app_bg, &init)._0();
            app_bg_and_input <- all(&app_bg, color);
            main <- app_bg_and_input.all_with(&intensity.value, mix);
            app_bg_and_main <- all(&app_bg, &main);
            background <- app_bg_and_main.all_with(&bg_intensity, mix).sampler();
            hover_highlight <- app_bg_and_main.all_with(&hover_hg_intensity, mix).sampler();
            text <- app_bg_and_main.all_with(&text_intensity, mix).sampler();
            icon_weak <- app_bg_and_main.all_with(&icon_weak_intensity, mix).sampler();
            icon_strong <- app_bg_and_main.all_with(&icon_strong_intensity, mix).sampler();
        }
        init.emit(());
        Self { icon_weak, icon_strong, text, background, hover_highlight }
    }
}

#[derive(Clone, CloneRef, Debug)]
pub struct Data {
    display_object: display::object::Instance,
    label:          text::Area,
    background:     background::View,
    icon:           Rc<RefCell<CurrentIcon>>,
    style:          StyleWatchFrp,
}

impl Data {
    fn new(app: &Application, text_layer: Option<&Layer>) -> Self {
        let display_object = display::object::Instance::new(Logger::new("ComponentGroupEntry"));
        let label = app.new_view::<text::Area>();
        let background = background::View::new(Logger::new("ComponentGroupEntry"));
        let icon = CurrentIcon::default();
        let style = StyleWatchFrp::new(&app.display.default_scene.style_sheet);
        display_object.add_child(&background);
        display_object.add_child(&icon);
        display_object.add_child(&label);
        if let Some(layer) = text_layer {
            label.add_to_scene_layer(layer);
        }
        Self { display_object, label, background, icon: Rc::new(RefCell::new(icon)), style }
    }

    fn update_layout(&self, kind: Kind, style: &Style, entry_size: Vector2) {
        let bg_width = if kind == Kind::LocalScopeEntry { entry_size.x } else { style.group_width };
        let bg_height =
            entry_size.y + if kind == Kind::Header { -style.gap_between_groups } else { 1.0 };
        // See comment in [`Self::update_shadow`] method.
        let shadow_addition = self.background.size.get().y - self.background.height.get();
        let bg_sprite_height = bg_height + shadow_addition;
        let bg_y = if kind == Kind::Header { -style.gap_between_groups / 2.0 } else { 0.5 };
        self.background.set_position_y(bg_y);
        self.background.size.set(Vector2(bg_width, bg_sprite_height));
        self.background.height.set(bg_height);
        let left = -entry_size.x / 2.0 + style.padding;
        self.icon.borrow().set_position_xy(Vector2(left + style.icon_size / 2.0, 0.0));
        let text_x = Self::text_x_position(kind, style);
        self.label.set_position_xy(Vector2(text_x, style.text_size.raw / 2.0));
    }

    fn contour(kind: Kind, style: &Style, entry_size: Vector2) -> Contour {
        let height =
            entry_size.y - if kind == Kind::Header { style.gap_between_groups } else { 0.0 };
        Contour::sharp_rectangle(Vector2(style.group_width, height))
    }

    fn highlight_contour(contour: Contour, style: &Style) -> Contour {
        Contour { corners_radius: style.selection_corners_radius, ..contour }
    }

    fn contour_offset(kind: Kind, style: &Style) -> Vector2 {
        let y = if kind == Kind::Header { -style.gap_between_groups / 2.0 } else { 0.0 };
        Vector2(0.0, y)
    }

    fn max_text_width(kind: Kind, style: &Style) -> f32 {
        let right = style.group_width / 2.0 - style.padding;
        let text_x = Self::text_x_position(kind, style);
        right - text_x
    }

    fn text_x_position(kind: Kind, style: &Style) -> f32 {
        let left = -style.group_width / 2.0 + style.padding;
        if kind == Kind::Header {
            left
        } else {
            left + style.icon_size + style.icon_text_padding
        }
    }

    fn update_shadow(
        &self,
        header_position: &MovedHeaderPosition,
        style: &Style,
        entry_size: Vector2,
    ) {
        if header_position.position != Vector2::default() {
            let bg_width = self.background.size.get().x;
            let bg_height = self.background.height.get();
            let distance_to_section_top =
                header_position.y_range.end() - header_position.position.y;
            let distance_to_section_bottom =
                header_position.position.y - header_position.y_range.start();
            // We need to render both the header background and the shadow below it, so we add
            // `shadow_size` and base `height` to calculate the final sprite size of the
            // `background` shape. We use `shadow_size * 2.0`, because the shadow extends by
            // `shadow_size` in each direction around the base shape, not only down. We cap the
            // `shadow_size` by the distance to the bottom of the component group so that the shadow
            // is not visible outside the component group background.
            let shadow_size = style.header_shadow_size.min(distance_to_section_bottom);
            let bg_sprite_height = bg_height + shadow_size * 2.0;
            self.background.size.set(Vector2(bg_width, bg_sprite_height));
            let header_shadow_peak = entry_size.y / 2.0;
            let height_multiplier = (distance_to_section_top / header_shadow_peak).min(1.0);
            self.background.shadow_height_multiplier.set(height_multiplier);
        }
    }
}

#[derive(Clone, CloneRef, Debug)]
pub struct View {
    frp:  grid_view::entry::EntryFrp<Self>,
    data: Data,
}

impl grid_view::Entry for View {
    type Model = Model;
    type Params = Params;

    fn new(app: &Application, text_layer: Option<&Layer>) -> Self {
        let frp = grid_view::entry::EntryFrp::<Self>::new();
        let data = Data::new(app, text_layer);
        let network = frp.network();
        let input = &frp.private().input;
        let out = &frp.private().output;

        frp::extend! { network

            // === Layout ===

            kind <- input.set_model.map(|m| m.kind).on_change();
            style <- input.set_params.map(|p| p.style.clone()).on_change();
            kind_and_style <- all(kind, style);
            layout_data <- all(kind_and_style, input.set_size);
            eval layout_data ((((kind, style), entry_sz)) data.update_layout(*kind, style, *entry_sz));
            out.contour <+ layout_data.map(|((kind, style), entry_sz)| Data::contour(*kind, style, *entry_sz));
            out.contour_offset <+ kind_and_style.map(|(kind, style)| Data::contour_offset(*kind, style));
            out.highlight_contour <+ out.contour.map2(&style, |contour, style| Data::highlight_contour(*contour, style));
            out.highlight_contour_offset <+ out.contour_offset;


            // === Colors ===

            color <- input.set_model.map(|m| m.color);
            color_intensities <- style.map(|s| s.color_intensities);
            is_dimmed <- all_with(&input.set_model, &input.set_params, |m,p| p.dimmed_groups.is_group_dimmed(m.group_id));
            let colors = Colors::from_main_color(network, &data.style, &color, &style, &is_dimmed);
            eval colors.background ((c) data.background.color.set(c.into()));
            data.label.set_default_color <+ colors.text;
            eval colors.icon_strong ((c) data.icon.borrow_mut().set_strong_color(*c));
            eval colors.icon_weak ((c) data.icon.borrow_mut().set_weak_color(*c));
            out.hover_highlight_color <+ colors.hover_highlight;


            // === Header Shadow ===

            shadow_data <- all(input.moved_as_header, style, input.set_size);
            eval shadow_data (((p, s, e)) data.update_shadow(p, s, *e));


            // === Icon and Text ===

            max_text_width <- kind_and_style.map(|(kind, style)| Data::max_text_width(*kind, style));
            caption <- input.set_model.map(|m| m.caption.to_string());
            icon <- input.set_model.map(|m| m.icon);
            data.label.set_content_truncated <+ all(caption, max_text_width);
            content_changed <- data.label.content.constant(());
            style_changed <- style.constant(());
            highlight_range <= all_with3(&input.set_model, &content_changed, &style_changed, |m, (), ()| m.highlighted.deref().clone());
            data.label.set_sdf_bold <+ highlight_range.map2(&style, |range, s| (*range, text::style::SdfBold::new(s.highlight_bold)));
            data.label.set_default_text_size <+ style.map(|s| s.text_size);
            eval icon ((&icon) data.icon.borrow_mut().update(icon));
            data.label.set_font <+ style.map(|s| s.font.to_string()).on_change();
        }
        Self { frp, data }
    }

    fn frp(&self) -> &grid_view::entry::EntryFrp<Self> {
        &self.frp
    }
}

impl display::Object for View {
    fn display_object(&self) -> &display::object::Instance<Scene> {
        &self.data.display_object
    }
}
