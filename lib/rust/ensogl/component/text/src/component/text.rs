//! The text area implementation. It serves the purpose of single and multi-line text labels and
//! text editors.

use crate::prelude::*;
use enso_text::unit;
use enso_text::unit::*;

use crate::buffer;
use crate::buffer::style;
use crate::buffer::Transform;
use crate::component::line;
use crate::component::selection;
use crate::component::Selection;
use crate::font;
use crate::font::glyph;
use crate::font::glyph::Glyph;

use crate::buffer::view::FromInContext;
use crate::buffer::view::IntoInContext;
pub use crate::buffer::view::LocationLike;
use crate::buffer::view::TryFromInContext;
pub use crate::buffer::RangeLike;
use enso_frp as frp;
use enso_frp::io::keyboard::Key;
use ensogl_core::application;
use ensogl_core::application::command::FrpNetworkProvider;
use ensogl_core::application::shortcut;
use ensogl_core::application::Application;
use ensogl_core::data::color;
use ensogl_core::display;
use ensogl_core::display::IntoGlsl;
use ensogl_core::gui::cursor;
use ensogl_core::system::web::clipboard;
use owned_ttf_parser::AsFaceRef;
use rustybuzz;
use std::ops::Not;

use enso_frp::stream::ValueProvider;



// =================
// === Constants ===
// =================

/// Record separator ASCII code. Used for separating of copied strings. It is defined as the `\RS`
/// escape code (`x1E`) (https://en.wikipedia.org/wiki/ASCII).
pub const CLIPBOARD_RECORD_SEPARATOR: &str = "\x1E";



// ====================
// === SelectionMap ===
// ====================

/// Mapping between selection id, `Selection`, and text location.
#[derive(Clone, Debug, Default)]
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
pub struct SelectionMap {
    id_map:       HashMap<selection::Id, Selection>,
    location_map: HashMap<ViewLine, HashMap<Column, selection::Id>>,
}



// =============
// === Lines ===
// =============

/// Vector of all lines stored in the text area. Please note that it is guaranteed that there is
/// always at least one line.
type LinesVec = NonEmptyVec<line::View, ViewLine>;

/// Set of all visible lines.
#[derive(Clone, CloneRef, Debug, Deref)]
struct Lines {
    rc: Rc<RefCell<LinesVec>>,
}

impl Lines {
    /// Constructor.
    pub fn new(line: line::View) -> Self {
        let rc = Rc::new(RefCell::new(LinesVec::singleton(line)));
        Self { rc }
    }

    /// The number of visible lines.
    pub fn len(&self) -> usize {
        self.rc.borrow().len()
    }

    /// The index of the last visible line.
    pub fn last_line_index(&self) -> ViewLine {
        // This is safe because we are using [`NonEmptyVec`] to store lines.
        ViewLine((self.len() - 1))
    }

    /// Resize the line container and use the provided function to construct missing elements.
    pub fn resize_with(&self, size: usize, cons: impl Fn(ViewLine) -> line::View) {
        let vec = &mut self.rc.borrow_mut();
        let mut ix = ViewLine(vec.len());
        vec.resize_with(size, || {
            let line = cons(ix);
            ix += ViewLine(1);
            line
        })
    }

    /// Get the coordinates of the provided locations. Please note that this function works properly
    /// only for single-line locations. Multi-line location computation is not implemented yet.
    pub fn coordinates(
        &self,
        start_location: ViewLocation,
        end_location: ViewLocation,
    ) -> (Vector2, Vector2) {
        if start_location.line != end_location.line {
            warn!(
                "Trying to compute coordinates for multi-line location. This is not supported yet."
            );
        }
        let get_pos_x = |location: ViewLocation| {
            let lines = self.borrow();
            if location.line > self.last_line_index() {
                *lines.last().divs.last()
            } else {
                lines[location.line].div_by_column(location.offset)
            }
        };

        let start_x = get_pos_x(start_location);
        let end_x = get_pos_x(end_location);
        let y = self.borrow()[start_location.line].baseline();
        let start_pos = Vector2(start_x, y);
        let end_pos = Vector2(end_x, y);
        (start_pos, end_pos)
    }
}

impl From<LinesVec> for Lines {
    fn from(vec: LinesVec) -> Self {
        let rc = Rc::new(RefCell::new(vec));
        Self { rc }
    }
}



// ============
// === Text ===
// ============

/// The visual text area implementation. It is meant to be a generic rich text component which you
/// should use everywhere you want to display text.
#[derive(Clone, CloneRef, Debug, Deref)]
#[allow(missing_docs)]
pub struct Text {
    #[deref]
    pub frp:  Frp,
    pub data: TextModel,
}

impl Text {
    /// Constructor.
    #[profile(Debug)]
    pub fn new(app: &Application) -> Self {
        let frp = Frp::new();
        let data = TextModel::new(app, &frp);
        Self { data, frp }.init()
    }
}



// ===========
// === FRP ===
// ===========

ensogl_core::define_endpoints_2! {
    Input {
        /// Insert character of the last pressed key at every cursor.
        insert_char_of_last_pressed_key(),
        /// Increase the indentation of all lines containing cursors.
        increase_indentation(),
        /// Decrease the indentation of all lines containing cursors.
        decrease_indentation(),
        /// Removes the character on the left of every cursor.
        delete_left(),
        /// Removes the character on the right of every cursor.
        delete_right(),
        /// Removes the word on the left of every cursor.
        delete_word_left(),
        /// Removes the word on the right of every cursor.
        delete_word_right(),
        /// Set the text cursor at the mouse cursor position.
        set_cursor_at_mouse_position(),
        /// Set the text cursor at the front of text.
        set_cursor_at_front(),
        /// Set the text cursor at the end of text.
        set_cursor_at_end(),
        /// Add a new text cursor at the front of text.
        add_cursor_at_front(),
        /// Add a new text cursor at the end of text.
        add_cursor_at_end(),
        /// Add a new cursor at the mouse cursor position.
        add_cursor_at_mouse_position(),
        /// Remove all cursors.
        remove_all_cursors(),
        /// Start changing the shape of the newest selection with the mouse position.
        start_newest_selection_end_follow_mouse(),
        /// Stop changing the shape of the newest selection with the mouse position.
        stop_newest_selection_end_follow_mouse(),
        /// Move the cursor to the left by one character.
        cursor_move_left(),
        /// Move the cursor to the right by one character.
        cursor_move_right(),
        /// Move the cursor to the left by one word.
        cursor_move_left_word(),
        /// Move the cursor to the right by one word.
        cursor_move_right_word(),
        /// Move the cursor to the beginning of the line.
        cursor_move_left_of_line(),
        /// Move the cursor to the end of the line.
        cursor_move_right_of_line(),
        /// Move the cursor down one line.
        cursor_move_down(),
        /// Move the cursor up one line.
        cursor_move_up(),
        /// Extend the cursor selection to the left by one character.
        cursor_select_left(),
        /// Extend the cursor selection to the right by one character.
        cursor_select_right(),
        /// Extend the cursor selection down one line.
        cursor_select_down(),
        /// Extend the cursor selection up one line.
        cursor_select_up(),
        /// Extend the cursor selection to the left by one word.
        cursor_select_left_word(),
        /// Extend the cursor selection to the right by one word.
        cursor_select_right_word(),
        /// Select all characters.
        select_all(),
        /// Select the word at cursor position.
        select_word_at_cursor(),
        /// Discard all but the first selection.
        keep_first_selection_only(),
        /// Discard all but the last selection.
        keep_last_selection_only(),
        /// Discard all but the first selection and convert it to cursor.
        keep_first_cursor_only(),
        /// Discard all but the last selection and convert it to cursor.
        keep_last_cursor_only(),
        /// Discard all but the newest selection.
        keep_newest_selection_only(),
        /// Discard all but the oldest selection.
        keep_oldest_selection_only(),
        /// Discard all but the newest selection and convert it to cursor.
        keep_newest_cursor_only(),
        /// Discard all but the oldest selection and convert it to cursor.
        keep_oldest_cursor_only(),
        /// Set the oldest selection end to mouse position.
        set_newest_selection_end_to_mouse_position(),
        /// Set the newest selection end to mouse position.
        set_oldest_selection_end_to_mouse_position(),
        /// Undo the last operation.
        undo(),
        /// Redo the last operation.
        redo(),
        /// Copy the selected text to the clipboard.
        copy(),
        /// Copy the selected text to the clipboard and remove it from the text area.
        cut(),
        /// Paste the selected text from the clipboard.
        paste(),

        hover(),
        unhover(),
        set_single_line_mode(bool),
        set_hover(bool),

        set_cursor (LocationLike),
        add_cursor (LocationLike),
        paste_string (String),
        insert (String),
        set_property (RangeLike, Option<style::Property>),
        set_property_default (Option<style::ResolvedProperty>),
        mod_property (RangeLike, Option<style::PropertyDiff>),

        /// Set color of selections (the cursor or characters selection).
        set_selection_color (color::Rgb),
        /// Set font in the text area. The name will be looked up in [`font::Registry`].
        ///
        /// Note, that this is a relatively heavy operation - it requires not only redrawing all
        /// lines, but also re-load internal structures for rendering (like WebGL buffers,
        /// MSDF texture, etc.).
        set_font (String),
        set_content (String),

        set_first_view_line(Line),
        mod_first_view_line(LineDiff),
        set_view_width(Option<f32>),
    }
    Output {
        pointer_style   (cursor::Style),
        width           (f32),
        height          (f32),
        changed         (Vec<buffer::ChangeWithSelection>),
        content         (buffer::Text),
        hovered         (bool),
        selection_color (color::Rgb),
        single_line_mode(bool),
        // FIXME: this was here:
        // /// Color that is used for all text that does not explicitly have a color set.
        // default_color   (color::Rgba),
        view_width(Option<f32>),

        // === Internal API ===

        /// The width value of text area will be refreshed.
        refresh_width(),
        /// The height value of text area will be refreshed.
        refresh_height(),
    }
}

impl Text {
    fn init(self) -> Self {
        self.init_hover();
        self.init_single_line_mode();
        self.init_cursors();
        self.init_selections();
        self.init_copy_cut_paste();
        self.init_edits();
        self.init_styles();
        self.init_view_management();
        self.init_undo_redo();
        self
    }

    fn init_hover(&self) {
        let network = self.frp.network();
        let input = &self.frp.input;
        let out = &self.frp.private.output;

        frp::extend! { network
            hovered <- bool(&input.unhover,&input.hover);
            hovered <- any(&input.set_hover,&hovered);
            out.hovered <+ hovered;
            out.pointer_style <+ out.hovered.map(|h| h.then_or_default(|| cursor::Style::cursor()));
        }
    }

    fn init_single_line_mode(&self) {
        let m = &self.data;
        let network = self.frp.network();
        let input = &self.frp.input;
        let out = &self.frp.private.output;

        frp::extend! { network
            out.single_line_mode <+ input.set_single_line_mode;
        }
    }

    fn init_cursors(&self) {
        let m = &self.data;
        let network = self.frp.network();
        let input = &self.frp.input;
        let scene = &m.app.display.default_scene;
        let mouse = &scene.mouse.frp;

        frp::extend! { network

            // === Setting Cursors ===

            loc_on_set <- input.set_cursor.map(f!([m](t) Location::from_in_context(&m, *t)));
            loc_on_add <- input.add_cursor.map(f!([m](t) Location::from_in_context(&m, *t)));

            mouse_on_set <- mouse.position.sample(&input.set_cursor_at_mouse_position);
            mouse_on_add <- mouse.position.sample(&input.add_cursor_at_mouse_position);
            loc_on_mouse_set <- mouse_on_set.map(f!((p) m.screen_to_text_location(*p)));
            loc_on_mouse_add <- mouse_on_add.map(f!((p) m.screen_to_text_location(*p)));

            loc_on_set_at_front <- input.set_cursor_at_front.map(f_!([] default()));
            loc_on_set_at_end <- input.set_cursor_at_end.map(f_!(m.last_line_last_location()));
            loc_on_add_at_front <- input.add_cursor_at_front.map(f_!([] default()));
            loc_on_add_at_end <- input.add_cursor_at_end.map(f_!(m.last_line_last_location()));

            loc_on_set <- any(loc_on_set,loc_on_mouse_set,loc_on_set_at_front,loc_on_set_at_end);
            loc_on_add <- any(loc_on_add,loc_on_mouse_add,loc_on_add_at_front,loc_on_add_at_end);

            eval loc_on_set ((loc) m.buffer.frp.set_cursor(loc));
            eval loc_on_add ((loc) m.buffer.frp.add_cursor(loc));


            // === Cursor Transformations ===

            eval_ input.remove_all_cursors (m.buffer.frp.remove_all_cursors());

            eval_ input.keep_first_selection_only (m.buffer.frp.keep_first_selection_only());
            eval_ input.keep_last_selection_only (m.buffer.frp.keep_last_selection_only());
            eval_ input.keep_first_cursor_only (m.buffer.frp.keep_first_cursor_only());
            eval_ input.keep_last_cursor_only (m.buffer.frp.keep_last_cursor_only());

            eval_ input.keep_newest_selection_only (m.buffer.frp.keep_newest_selection_only());
            eval_ input.keep_oldest_selection_only (m.buffer.frp.keep_oldest_selection_only());
            eval_ input.keep_newest_cursor_only (m.buffer.frp.keep_newest_cursor_only());
            eval_ input.keep_oldest_cursor_only (m.buffer.frp.keep_oldest_cursor_only());

            eval_ input.cursor_move_left (m.buffer.frp.cursors_move(Transform::Left));
            eval_ input.cursor_move_right (m.buffer.frp.cursors_move(Transform::Right));
            eval_ input.cursor_move_up (m.buffer.frp.cursors_move(Transform::Up));
            eval_ input.cursor_move_down (m.buffer.frp.cursors_move(Transform::Down));

            eval_ input.cursor_move_left_word (m.buffer.frp.cursors_move(Transform::LeftWord));
            eval_ input.cursor_move_right_word (m.buffer.frp.cursors_move(Transform::RightWord));

            eval_ input.cursor_move_left_of_line (m.buffer.frp.cursors_move(Transform::LeftOfLine));
            eval_ input.cursor_move_right_of_line (m.buffer.frp.cursors_move(Transform::RightOfLine));

            eval_ input.cursor_select_left (m.buffer.frp.cursors_select(Transform::Left));
            eval_ input.cursor_select_right (m.buffer.frp.cursors_select(Transform::Right));
            eval_ input.cursor_select_up (m.buffer.frp.cursors_select(Transform::Up));
            eval_ input.cursor_select_down (m.buffer.frp.cursors_select(Transform::Down));

            eval_ input.cursor_select_left_word (m.buffer.frp.cursors_select(Transform::LeftWord));
            eval_ input.cursor_select_right_word (m.buffer.frp.cursors_select(Transform::RightWord));

            eval_ input.select_all (m.buffer.frp.cursors_select(Transform::All));
            eval_ input.select_word_at_cursor (m.buffer.frp.cursors_select(Transform::Word));
        }
    }

    fn init_selections(&self) {
        let m = &self.data;
        let scene = &m.app.display.default_scene;
        let mouse = &scene.mouse.frp;
        let network = self.frp.network();
        let input = &self.frp.input;

        frp::extend! { network
            _eval <- m.buffer.frp.selection_edit_mode.map(f!((sels)
                m.on_modified_selection(&sels.selection_group, Some(&sels.changes))
            ));

            _eval <- m.buffer.frp.selection_non_edit_mode.map(f!((sels)
                m.on_modified_selection(sels, None)
            ));

            selecting <- bool
                ( &input.stop_newest_selection_end_follow_mouse
                , &input.start_newest_selection_end_follow_mouse
            );

            sel_end_1 <- mouse.position.gate(&selecting);
            sel_end_2 <- mouse.position.sample(&input.set_newest_selection_end_to_mouse_position);
            set_newest_selection_end <- any(&sel_end_1, &sel_end_2);
            sel_end_pos <- set_newest_selection_end.map(f!((pos) m.screen_to_text_location(*pos)));
            m.buffer.frp.set_newest_selection_end <+ sel_end_pos;
        }
    }

    fn init_copy_cut_paste(&self) {
        let m = &self.data;
        let network = self.frp.network();
        let input = &self.frp.input;

        frp::extend! { network

            // === Copy ===

            sels_on_copy <- input.copy.map(f_!(m.buffer.selections_contents()));
            all_empty_sels_on_copy <- sels_on_copy.map(|s| s.iter().all(|t| t.is_empty()));
            copy_whole_lines <- sels_on_copy.gate(&all_empty_sels_on_copy);
            copy_regions_only <- sels_on_copy.gate_not(&all_empty_sels_on_copy);

            eval_ copy_whole_lines (m.buffer.frp.cursors_select(Some(Transform::Line)));
            sels_on_copy_whole_lines <- copy_whole_lines.map(f_!(m.buffer.selections_contents()));
            text_chubks_to_copy <- any(&sels_on_copy_whole_lines, &copy_regions_only);
            eval text_chubks_to_copy ((s) m.copy(s));

            // === Cut ===

            sels_on_cut <- input.cut.map(f_!(m.buffer.selections_contents()));
            all_empty_sels_on_cut <- sels_on_cut.map(|s|s.iter().all(|t|t.is_empty()));
            cut_whole_lines <- sels_on_cut.gate(&all_empty_sels_on_cut);
            cut_regions_only <- sels_on_cut.gate_not(&all_empty_sels_on_cut);

            eval_ cut_whole_lines (m.buffer.frp.cursors_select(Some(Transform::Line)));
            sels_on_cut_whole_lines <- cut_whole_lines.map(f_!(m.buffer.selections_contents()));
            sels_to_cut <- any(&sels_on_cut_whole_lines,&cut_regions_only);
            eval sels_to_cut ((s) m.copy(s));
            eval_ sels_to_cut (m.buffer.frp.delete_left());

            // === Paste ===

            let paste_string = input.paste_string.clone_ref();
            eval_ input.paste ([] clipboard::read_text(f!((t) paste_string.emit(t))));
            eval input.paste_string((s) m.paste_string(s));
        }
    }

    fn init_edits(&self) {
        let m = &self.data;
        let scene = &m.app.display.default_scene;
        let keyboard = &scene.keyboard;
        let network = self.frp.network();
        let input = &self.frp.input;
        let out = &self.frp.private.output;
        let after_animations = ensogl_core::animation::after_animations();

        frp::extend! { network

            // === User Driven Changes ===

            eval_ input.delete_left (m.buffer.frp.delete_left());
            eval_ input.delete_right (m.buffer.frp.delete_right());
            eval_ input.delete_word_left (m.buffer.frp.delete_word_left());
            eval_ input.delete_word_right (m.buffer.frp.delete_word_right());

            key_down <- keyboard.frp.down.gate_not(&keyboard.frp.is_meta_down);
            key_down <- key_down.gate_not(&keyboard.frp.is_control_down);
            key_to_insert <= key_down.map(f!((key) m.key_to_string(key)));
            str_to_insert <- any(&input.insert, &key_to_insert);
            eval str_to_insert ((s) m.buffer.frp.insert(s));
            eval input.set_content ((s) {
                input.set_cursor(&default());
                input.select_all();
                input.insert(s);
                input.remove_all_cursors();
            });


            // === Reacting To Changes ===

            // The `content` event should be fired first, as any listener for `changed` may want to
            // read the new content, so it should be up-to-date.
            out.content <+ m.buffer.frp.text_change.map(f_!(m.buffer.text()));
            out.changed <+ m.buffer.frp.text_change;


            // === Text Width And Height Updates ===

            // We are computing new width and height after all animations are run. This is because
            // text dimensions can be affected by multiple moving cursors and moving lines.
            new_width <= after_animations.map (f_!(m.compute_width_if_dirty()));
            new_height <= after_animations.map (f_!(m.compute_height_if_dirty()));
            out.width <+ new_width.on_change();
            out.height <+ new_height.on_change();
            eval_ out.refresh_width(m.width_dirty.set(true));
            eval_ out.refresh_height(m.height_dirty.set(true));
        }
    }

    fn init_styles(&self) {
        let network = self.frp.network();
        let model = &self.data;
        let input = &self.frp.input;
        let out = &self.frp.private.output;
        let m = &model;

        frp::extend! { network

            // === Font ===

            eval input.set_font ((t) m.set_font(t));


            // === Colors ===

            m.buffer.frp.set_property_default <+ input.set_property_default;
            eval input.set_property_default((t) m.set_property_default(*t));
            out.selection_color <+ self.frp.set_selection_color;


            // === Style ===

            new_prop <- input.set_property.map(f!([m]((r, p)) (m.expand_range_like(r),*p)));
            m.buffer.frp.set_property <+ new_prop;
            eval new_prop ([m](t) t.1.map(|p| m.set_property(&t.0, p)));

            mod_prop <- input.mod_property.map(f!([m]((r, p)) (m.expand_range_like(r),*p)));
            m.buffer.frp.mod_property <+ mod_prop;
            eval mod_prop ([m](t) t.1.map(|p| m.mod_property(&t.0, p)));
        }
    }

    fn init_view_management(&self) {
        let m = &self.data;
        let network = self.frp.network();
        let out = &self.frp.private.output;

        frp::extend! { network
            m.buffer.frp.set_first_view_line <+ self.frp.set_first_view_line;
            m.buffer.frp.mod_first_view_line <+ self.frp.mod_first_view_line;

            eval_ m.buffer.frp.first_view_line (m.redraw());
            out.view_width <+ self.frp.set_view_width;
            eval_ self.frp.set_view_width (m.redraw());
        }
    }

    fn init_undo_redo(&self) {
        let m = &self.data;
        let input = &self.frp.input;
        let network = self.frp.network();

        frp::extend! { network
            eval_ input.undo (m.buffer.frp.undo());
            eval_ input.redo (m.buffer.frp.redo());
        }
    }
}



// ========================
// === Layer Management ===
// ========================

impl Text {
    /// Add the text area to a specific scene layer. The mouse event positions will be mapped to
    /// this view regardless the previous views this component could be added to.
    // TODO https://github.com/enso-org/ide/issues/1576
    //     This function needs to be updated. However, it requires a few steps:
    //     1. The new `ShapeView` and `DynamicShape` are implemented and they use display objects to
    //        pass information about scene layers they are assigned to. However, the [`GlyphSystem`]
    //        is a very non-standard implementation, and thus has to handle the new display object
    //        callbacks in a special way as well.
    //     2. The `self.data.layer` currently needs to be stored for two main purposes:
    //        - so that the [`set_font`] function can add newly created Glyphs to a layer to make
    //          them visible;
    //        - to provide a way to convert the screen to object space (see the
    //          [`screen_to_object_space`] function).
    //        This is a very temporary solution, as any object can be assigned to more than one
    //        scene layer. Screen / object space location of events should thus become much more
    //        primitive information / mechanisms. Please note, that this function handles the
    //        selection management correctly, as it uses the new shape system definition, and thus,
    //        inherits the scene layer settings from this display object.
    pub fn add_to_scene_layer(&self, layer: &display::scene::Layer) {
        self.data.layer.set(layer.clone_ref());
        self.data.add_symbols_to_scene_layer();
        layer.add_exclusive(self);
    }

    /// Remove this component from view.
    // TODO see TODO in add_to_scene_layer method.
    #[allow(non_snake_case)]
    pub fn remove_from_scene_layer(&self, layer: &display::scene::Layer) {
        self.data.remove_symbols_from_scene_layer(layer);
    }
}



// =================
// === TextModel ===
// =================

/// Internal representation of `Text`.
#[derive(Clone, CloneRef, Debug, Deref)]
pub struct TextModel {
    rc: Rc<TextModelData>,
}

/// Internal representation of `Text`.
#[derive(Debug, Deref)]
pub struct TextModelData {
    #[deref]
    buffer:         buffer::View,
    app:            Application,
    frp:            WeakFrp,
    display_object: display::object::Instance,
    glyph_system:   RefCell<glyph::System>,
    lines:          Lines,
    selection_map:  RefCell<SelectionMap>,
    width_dirty:    Cell<bool>,
    height_dirty:   Cell<bool>,

    // FIXME[ao]: this is a temporary solution to handle properly areas in different views. Should
    //            be replaced with proper object management.
    layer: CloneRefCell<display::scene::Layer>,
}

impl TextModel {
    /// Constructor.
    pub fn new(
        app: &Application,
        frp: &Frp,
        // frp_out_get: &api::public::Output,
        // frp_out_set: &api::private::Output,
        // frp_network: &frp::Network,
    ) -> Self {
        let app = app.clone_ref();
        let scene = &app.display.default_scene;
        let selection_map = default();
        let display_object = display::object::Instance::new();
        let fonts = scene.extension::<font::Registry>();
        let font = fonts.load(font::DEFAULT_FONT_MONO);
        let glyph_system = {
            let glyph_system = font::glyph::System::new(&scene, font.clone());
            display_object.add_child(&glyph_system);
            RefCell::new(glyph_system)
        };
        let buffer = buffer::View::new(buffer::ViewBuffer::new(font));
        let layer = CloneRefCell::new(scene.layers.main.clone_ref());
        let lines = Lines::new(Self::new_line_helper(
            &app.display.default_scene.frp.frame_time,
            &display_object,
            buffer.formatting.borrow().size.default.value,
        ));
        let width_dirty = default();
        let height_dirty = default();

        let shape_system = scene.shapes.shape_system(PhantomData::<selection::shape::Shape>);
        let symbol = &shape_system.shape_system.sprite_system.symbol;

        // FIXME[WD]: This is temporary sorting utility, which places the cursor in front of mouse
        // pointer and nodes. Should be refactored when proper sorting mechanisms are in place.
        scene.layers.main.remove_symbol(symbol);
        scene.layers.label.add_exclusive(symbol);

        let frp = frp.downgrade();
        let data = TextModelData {
            app,
            layer,
            frp,
            buffer,
            display_object,
            glyph_system,
            lines,
            selection_map,
            width_dirty,
            height_dirty,
        };
        Self { rc: Rc::new(data) }.init()
    }

    #[profile(Debug)]
    fn init(self) -> Self {
        self.init_line(self.lines.borrow().first());
        self
    }

    fn init_line(&self, line: &line::View) {
        if let Some(network) = self.frp.network.upgrade() {
            frp::extend! { network
                self.frp.private.output.refresh_height <+_ line.descent;
            }
        }
    }

    fn new_line_helper(
        frame_time: &enso_frp::Stream<f32>,
        display_object: &display::object::Instance,
        default_size: f32,
    ) -> line::View {
        let mut line = line::View::new(frame_time);
        let ascender = default_size;
        let descender = ascender / 10.0;
        let gap = 0.0;
        let metrics = line::Metrics { ascender, descender, gap };
        line.set_metrics(metrics);
        display_object.add_child(&line);
        line
    }

    fn new_line(&self) -> line::View {
        let line = Self::new_line_helper(
            &self.app.display.default_scene.frp.frame_time,
            &self.display_object,
            self.buffer.formatting.borrow().size.default.value,
        );
        self.init_line(&line);
        line
    }

    fn take_lines(&self) -> Lines {
        let lines_vec = LinesVec::singleton(self.new_line());
        let old_lines_vec = mem::replace(&mut *self.lines.borrow_mut(), lines_vec);
        old_lines_vec.into()
    }
}



// =============================================
// === Screen - Text Coordinates Conversions ===
// =============================================

impl TextModel {
    /// Transforms screen position to the object (display object) coordinate system.
    fn screen_to_object_space(&self, screen_pos: Vector2) -> Vector2 {
        let camera = self.layer.get().camera();
        let origin_world_space = Vector4(0.0, 0.0, 0.0, 1.0);
        let origin_clip_space = camera.view_projection_matrix() * origin_world_space;
        let inv_object_matrix = self.transform_matrix().try_inverse().unwrap();

        let shape = self.app.display.default_scene.frp.shape.value();
        let clip_space_z = origin_clip_space.z;
        let clip_space_x = origin_clip_space.w * 2.0 * screen_pos.x / shape.width;
        let clip_space_y = origin_clip_space.w * 2.0 * screen_pos.y / shape.height;
        let clip_space = Vector4(clip_space_x, clip_space_y, clip_space_z, origin_clip_space.w);
        let world_space = camera.inversed_view_projection_matrix() * clip_space;
        (inv_object_matrix * world_space).xy()
    }

    /// Transform screen position to in-text location.
    fn screen_to_text_location(&self, screen_pos: Vector2) -> Location {
        let object_space = self.screen_to_object_space(screen_pos);
        let mut view_line = ViewLine(0);
        let lines = self.lines.borrow();
        for line in &*lines {
            if line.baseline() + line.metrics().descender < object_space.y {
                break;
            }
            view_line += ViewLine(1);
        }
        let view_line = std::cmp::min(view_line, self.lines.last_line_index());
        let div_index = self.lines.borrow()[view_line].div_index_close_to(object_space.x);
        let line = Line::from_in_context(self, view_line);
        let column = Column(div_index);
        let out = Location(line, column);
        out
    }
}



// =============================
// === Redrawing And Updates ===
// =============================

impl TextModel {
    /// Apply the changes to the text buffer and update the lines.
    #[profile(Debug)]
    fn on_modified_selection(
        &self,
        buffer_selections: &buffer::selection::Group,
        changes: Option<&[buffer::ChangeWithSelection]>,
    ) {
        let do_edit = changes.is_some();
        self.update_lines_after_change(changes);
        self.replace_selections(do_edit, buffer_selections);
        if do_edit {
            self.attach_glyphs_to_cursors();
        }
    }

    /// Implementation of lazy line redrawing. After a change, only the needed lines are redrawn.
    /// If a change produced more lines than the current number of lines, the new lines are inserted
    /// in appropriate positions. If a change produces fewer lines than the current number of lines,
    /// appropriate lines are removed. Then, a minimal line redraw range is computed and performed.
    ///
    /// # Smooth animations
    /// This function also attaches unchanged lines below a cursor to the cursor for smooth vertical
    /// animation. Please note that when cursors are moved in a non-edit mode (e.g. after pressing
    /// an arrow key), the animations are skipped. This is a performance optimization. If we would
    /// like to continue the animations, we would need to either attach animation system to every
    /// glyph, or create multiple, possibly hierarchical "virtual cursors". The animations are so
    /// fast that this is barely noticeable.
    ///
    /// # Possible future optimizations.
    /// This section describes possible future optimizations that are not implemented now because
    /// of their complexity and/or lack of use cases.
    ///
    /// ## Limiting the number of glyphs per line.
    /// Currently, nothing limits the number of glyphs in line. They are computed and displayed even
    /// if they are not visible on the screen.
    ///
    /// ## Redrawing parts of lines only.
    /// Currently, the whole line is redrawn after any change. This is not optimal, especially for
    /// lines containing a lot of visible characters. However, redrawing only parts of a changed
    /// line is way more complex than it seems. Let's consider the input `அட0`. If we insert `்`
    /// after `ட`, then we should get `ட்` instead of `ட`, but we do not need to redraw neither
    /// `அ` nor `0`. Inserting a new code point can affect any number of code points to the left
    /// and to the right of the insertion point. Unfortunately, the current Rustybuzz
    /// implementation does not support such use cases:
    /// https://github.com/RazrFalcon/rustybuzz/issues/54
    fn update_lines_after_change(&self, changes: Option<&[buffer::ChangeWithSelection]>) {
        debug_span!("update_lines_after_change").in_scope(|| {
            self.detach_glyphs_from_cursors();
            if let Some(changes) = changes {
                let view_line_range = self.buffer.view_line_range();
                let lines_to_redraw = changes
                    .iter()
                    .filter_map(|change_with_selection| {
                        let change_range = &change_with_selection.change_range;
                        let change_start = ViewLine::from_in_context(self, *change_range.start());
                        let change_end = ViewLine::from_in_context(self, *change_range.end());
                        let view_change_range = change_start..=change_end;
                        let line_diff = change_with_selection.line_diff;
                        let second_line_index = view_change_range.start().inc();

                        let mut lines = self.lines.borrow_mut();
                        if line_diff > LineDiff(0) {
                            // Add missing lines. They will be redrawn later. This is needed for
                            // proper partial redraw (redrawing only the lines that changed).
                            let line_diff = line_diff.value as usize;
                            for i in 0..line_diff {
                                let index_to_insert = second_line_index + ViewLine(i);
                                if index_to_insert < ViewLine(lines.len()) {
                                    lines.insert(index_to_insert, self.new_line());
                                }
                            }
                        } else if line_diff < LineDiff(0) {
                            // Remove lines that are no longer needed. This is needed for proper
                            // partial redraw (redrawing only the lines that changed).
                            let line_diff = -line_diff.value as usize;
                            let line_diff = ViewLine(line_diff);
                            lines.drain(second_line_index..second_line_index + line_diff);
                        }

                        let range_end = view_change_range.end() + line_diff;
                        let range = (*view_change_range.start())..=range_end;

                        range.intersect(&view_line_range)
                    })
                    .collect_vec();

                let lines_to_redraw = std_ext::range::merge_overlapping_ranges(&lines_to_redraw);
                self.redraw_sorted_line_ranges(lines_to_redraw);
            }
        })
    }

    /// Update selection positions. This is needed e.g. if the selected glyph size changed.
    fn update_selections(&self) {
        let buffer_selections = self.buffer.selections();
        self.replace_selections(false, &buffer_selections);
    }

    /// Replace selections with new ones.
    fn replace_selections(&self, do_edit: bool, buffer_selections: &buffer::selection::Group) {
        let mut new_selection_map = SelectionMap::default();
        for buffer_selection in buffer_selections {
            let buffer_selection = self.limit_selection_to_known_values(*buffer_selection);
            let id = buffer_selection.id;
            let selection_start_line = ViewLine::from_in_context(self, buffer_selection.start.line);
            let selection_end_line = ViewLine::from_in_context(self, buffer_selection.end.line);
            let start_location = Location(selection_start_line, buffer_selection.start.offset);
            let end_location = Location(selection_end_line, buffer_selection.end.offset);
            let (start_pos, end_pos) = self.lines.coordinates(start_location, end_location);
            let width = end_pos.x - start_pos.x;
            let metrics = self.lines.borrow()[selection_start_line].metrics();
            let prev_selection = self.selection_map.borrow_mut().id_map.remove(&id);
            let reused_selection = prev_selection.is_some();
            let selection = if let Some(selection) = prev_selection {
                selection.set_width_and_flip_sides_if_needed(width, start_pos.x);
                selection
            } else {
                let frame_time = &self.app.display.default_scene.frp.frame_time;
                let selection = Selection::new(frame_time, do_edit);
                if let Some(network) = self.frp.network.upgrade() {
                    let out = &self.frp.private.output;
                    frp::extend! { network
                        out.refresh_height <+_ selection.position;
                        out.refresh_width <+_ selection.right_side_of_last_attached_glyph;
                    }
                }
                self.add_child(&selection);
                selection.set_color(self.frp.output.selection_color.value());
                selection.set_width(width);
                selection
            };
            selection.set_position_target(start_pos);
            selection.set_ascender(metrics.ascender);
            selection.set_descender(metrics.descender);
            selection.edit_mode().set(do_edit);
            if !reused_selection {
                selection.skip_position_animation();
            }
            new_selection_map.id_map.insert(id, selection);
            let loc_map = new_selection_map.location_map.entry(selection_start_line).or_default();
            loc_map.insert(buffer_selection.start.offset, id);
        }
        *self.selection_map.borrow_mut() = new_selection_map;
    }

    /// Constrain the selection to values fitting inside the current text buffer. This can be needed
    /// when using the API and providing invalid values.
    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    fn limit_selection_to_known_values(
        &self,
        selection: buffer::selection::Selection,
    ) -> buffer::selection::Selection {
        let start_location = Location::from_in_context(&self.buffer, selection.start);
        let end_location = Location::from_in_context(&self.buffer, selection.end);
        let start = self.buffer.snap_location(start_location);
        let end = self.buffer.snap_location(end_location);
        let start = Location::from_in_context(&self.buffer, start);
        let end = Location::from_in_context(&self.buffer, end);
        selection.with_start(start).with_end(end)
    }

    /// Resize lines vector to contain the required lines count.
    fn resize_lines(&self) {
        let line_count = self.buffer.view_line_count();
        self.lines.resize_with(line_count, |ix| self.new_line());
    }

    /// Redraw all the text. This function should be used only when necessary as it is very costly.
    #[profile(Debug)]
    pub fn redraw(&self) {
        let end = ViewLine::try_from_in_context(&self.buffer, self.buffer.last_view_line());
        // FIXME: Unwrap used here. To be fixed when view area will be implemented properly.
        let end = end.unwrap();
        self.redraw_sorted_line_ranges(std::iter::once(ViewLine(0)..=end));
        self.update_selections();
    }

    /// Redraw the given line ranges.
    fn redraw_sorted_line_ranges(
        &self,
        sorted_line_ranges: impl Iterator<Item = RangeInclusive<ViewLine>>,
    ) {
        self.resize_lines();
        self.width_dirty.set(true);
        let sorted_line_ranges = sorted_line_ranges.map(|range| {
            for line in range.clone() {
                self.redraw_line(line);
            }
            range
        });
        self.position_sorted_line_ranges(sorted_line_ranges);
    }

    /// Redraw the line. This will re-position all line glyphs.
    fn redraw_line(&self, view_line: ViewLine) {
        let line = &mut self.lines.borrow_mut()[view_line];
        let default_divs = || NonEmptyVec::singleton(0.0);
        let mut divs = default_divs();
        let mut column = Column(0);
        let mut to_be_truncated = 0;
        let mut truncated = false;
        let default_size = self.buffer.formatting.borrow().size.default;
        let line_index = Line::from_in_context(self, view_line);
        self.buffer.with_shaped_line(line_index, |shaped_line| {
            match shaped_line {
                buffer::view::ShapedLine::NonEmpty { glyph_sets } => {
                    let glyph_system = self.glyph_system.borrow();
                    let view_width = self.frp.output.view_width.value();
                    let line_range = self.buffer.byte_range_of_view_line_index_snapped(view_line);
                    let line_style = self.buffer.sub_style(line_range.start..line_range.end);
                    let mut line_style_iter = line_style.iter();
                    let mut glyph_offset_x = 0.0;
                    let mut prev_cluster_byte_off = UBytes(0);
                    let truncation_size = line::TruncationSize::from(default_size);
                    let ellipsis_width = truncation_size.width_with_text_offset();
                    let mut line_metrics = None;
                    for shaped_glyph_set in glyph_sets {
                        if truncated {
                            break;
                        }
                        for shaped_glyph in &shaped_glyph_set.glyphs {
                            let glyph_byte_start = shaped_glyph.cluster();
                            // Drop styles assigned to skipped bytes. One byte will be skipped
                            // during the call to `line_style_iter.next()`.
                            let cluster_diff = glyph_byte_start - prev_cluster_byte_off - Bytes(1);
                            let cluster_diff = UBytes::try_from(cluster_diff).unwrap_or_default();
                            line_style_iter.drop(cluster_diff);
                            let style = line_style_iter.next().unwrap_or_default();
                            prev_cluster_byte_off = glyph_byte_start;

                            let scale = shaped_glyph_set.units_per_em as f32 / style.size.value;
                            let ascender = shaped_glyph_set.ascender as f32 / scale;
                            let descender = shaped_glyph_set.descender as f32 / scale;
                            let gap = shaped_glyph_set.line_gap as f32 / scale;
                            let x_advance = shaped_glyph.position.x_advance as f32 / scale;
                            let glyph_rhs = glyph_offset_x + x_advance;

                            if let Some(view_width) = view_width {
                                if glyph_rhs > view_width {
                                    truncated = true;
                                    break;
                                } else if glyph_rhs > view_width - ellipsis_width {
                                    to_be_truncated += 1;
                                }
                            };

                            let glyph = &line.get_or_create(column, || glyph_system.new_glyph());
                            glyph.start_byte_offset.set(glyph_byte_start);

                            let glyph_line_metrics = line::Metrics { ascender, descender, gap };
                            line_metrics = line_metrics.concat(Some(glyph_line_metrics));

                            let render_info = &shaped_glyph.render_info;
                            let glyph_render_offset = render_info.offset.scale(style.size.value);
                            glyph.set_color(style.color);
                            glyph.skip_color_animation();
                            glyph.set_sdf_weight(style.sdf_weight.value);
                            glyph.set_size(style.size);
                            glyph.set_properties(shaped_glyph_set.non_variable_variations);
                            glyph.set_glyph_id(shaped_glyph.id());
                            glyph.x_advance.set(x_advance);
                            glyph.sprite.set_position_xy(glyph_render_offset);
                            glyph.set_position_xy(Vector2(glyph_offset_x, 0.0));

                            glyph_offset_x += x_advance;
                            divs.push(glyph_offset_x);
                            column += Column(1);
                        }
                    }
                    if let Some(line_metrics) = line_metrics {
                        line.set_metrics(line_metrics);
                    } else {
                        warn!("Internal error. Line metrics was not computed.")
                    }
                }
                buffer::view::ShapedLine::Empty { prev_glyph_info } => {
                    if let Some((offset, shaped_glyph_set)) = prev_glyph_info {
                        let line_style = self.buffer.sub_style(*offset..);
                        let mut line_style_iter = line_style.iter();
                        let style = line_style_iter.next().unwrap_or_default();
                        let scale = shaped_glyph_set.units_per_em as f32 / style.size.value;
                        let ascender = shaped_glyph_set.ascender as f32 / scale;
                        let descender = shaped_glyph_set.descender as f32 / scale;
                        let gap = shaped_glyph_set.line_gap as f32 / scale;
                        let metrics = line::Metrics { ascender, descender, gap };
                        line.set_metrics(metrics);
                    }
                }
            }
        });

        if truncated {
            let divs = (&divs[0..divs.len() - to_be_truncated]).to_vec();
            let divs = NonEmptyVec::try_from(divs).unwrap_or_else(|_| default_divs());
            line.set_divs(divs);
            line.glyphs.truncate(column.value - to_be_truncated);
            line.set_truncated(Some(default_size));
        } else {
            line.set_divs(divs);
            line.glyphs.truncate(column.value);
            line.set_truncated(None);
        }
    }

    /// Clear shaped lines cache and redraw lines in the provided range. Clearing the cache is
    /// required when the line needs to be re-shaped, for example, after setting a glyph to a bold
    /// style or changing glyph size.
    pub fn clear_cache_and_redraw_sorted_line_ranges(
        &self,
        ranges: impl IntoIterator<Item = buffer::Range<UBytes>>,
    ) {
        let view_line_ranges = ranges.into_iter().map(|range| {
            let range = buffer::Range::<Location>::from_in_context(self, range);
            let line_range = range.start.line..=range.end.line;
            for line_index in line_range {
                self.buffer.shaped_lines.borrow_mut().remove(&line_index);
            }
            let view_line_start = ViewLine::from_in_context(self, range.start.line);
            let view_line_end = ViewLine::from_in_context(self, range.end.line);
            view_line_start..=view_line_end
        });
        self.redraw_sorted_line_ranges(view_line_ranges);
        self.update_selections();
    }

    /// Attach glyphs to cursors if cursors are in edit mode.
    pub fn attach_glyphs_to_cursors(&self) {
        for line in ViewLine(0)..=self.buffer.last_view_line_index() {
            self.attach_glyphs_to_cursors_for_line(line)
        }
    }

    /// Attach glyphs to cursors if cursors are in edit mode.
    fn attach_glyphs_to_cursors_for_line(&self, view_line: ViewLine) {
        let cursor_map = self.selection_map.borrow().location_map.get(&view_line).cloned();
        let cursor_map = cursor_map.unwrap_or_default();
        let line = &self.lines.borrow()[view_line];

        let mut attached_glyphs = vec![];
        let mut last_cursor: Option<Selection> = None;
        let mut last_cursor_target_x = default();

        let mut column = Column(0);
        for glyph in line {
            cursor_map.get(&column).for_each(|id| {
                if let Some(cursor) = self.selection_map.borrow().id_map.get(id) {
                    if cursor.edit_mode().get() {
                        if let Some(last_cursor) = &last_cursor {
                            let attached_glyphs = Rc::new(mem::take(&mut attached_glyphs));
                            last_cursor.set_attached_glyphs(attached_glyphs);
                        }
                        last_cursor = Some(cursor.clone_ref());
                        last_cursor_target_x = glyph.x();
                    }
                }
            });

            if let Some(cursor) = &last_cursor {
                cursor.right_side().add_child(glyph);
                glyph.attached_to_cursor.set(true);
                glyph.mod_position_x(|p| p - last_cursor_target_x);
                attached_glyphs.push(glyph.downgrade());
            }
            column += Column(1);
        }
        if let Some(last_cursor) = &last_cursor {
            last_cursor.set_attached_glyphs(Rc::new(mem::take(&mut attached_glyphs)));
        } else if !attached_glyphs.is_empty() {
            error!("Internal error. Cannot attach glyphs to cursors.");
        }
    }

    /// Detach all glyphs from cursors and place them back in lines.
    pub fn detach_glyphs_from_cursors(&self) {
        let selection_map = self.selection_map.borrow();
        for (&line, cursor_map) in &selection_map.location_map {
            for (_, cursor_id) in cursor_map {
                let selection = selection_map.id_map.get(cursor_id).unwrap();
                for glyph in &*selection.set_attached_glyphs.value() {
                    if let Some(glyph) = glyph.upgrade() {
                        self.lines.borrow_mut()[line].add_child(&glyph);
                        let pos_x = selection.position_target.value().x;
                        glyph.mod_position_xy(|pos| Vector2(pos.x + pos_x, 0.0));
                        glyph.attached_to_cursor.set(false);
                    }
                }
                selection.set_attached_glyphs(Rc::new(vec![]));
            }
        }
    }
}



// ===========================
// === Property Management ===
// ===========================

impl TextModel {
    /// Check whether the property change will invalidate the cache, and thus, will require line
    /// re-shaping and re-drawing.
    fn property_change_invalidates_cache(property: impl Into<style::PropertyTag>) -> bool {
        let tag = property.into();
        match tag {
            style::PropertyTag::Size => true,
            style::PropertyTag::Color => false,
            style::PropertyTag::Weight => true,
            style::PropertyTag::Width => true,
            style::PropertyTag::Style => true,
            style::PropertyTag::SdfWeight => false,
        }
    }

    /// Set the property to selected glyphs. Redraw lines if needed.
    fn set_property(&self, ranges: &Vec<buffer::Range<UBytes>>, property: style::Property) {
        if Self::property_change_invalidates_cache(property) {
            self.clear_cache_and_redraw_sorted_line_ranges(ranges.iter().copied())
        } else {
            self.set_glyphs_property_without_line_redraw(ranges, property)
        }
    }

    /// Modify the property of selected glyphs. Redraw lines if needed.
    fn mod_property(&self, ranges: &Vec<buffer::Range<UBytes>>, property: style::PropertyDiff) {
        if Self::property_change_invalidates_cache(property) {
            self.clear_cache_and_redraw_sorted_line_ranges(ranges.iter().copied())
        } else {
            self.mod_glyphs_property_without_line_redraw(ranges, property)
        }
    }

    /// Set the property to selected glyphs. No redraw will be performed.
    fn set_glyphs_property_without_line_redraw(
        &self,
        ranges: &Vec<buffer::Range<UBytes>>,
        property: style::Property,
    ) {
        let property = self.buffer.resolve_property(property);
        self.modify_glyphs_in_ranges_without_line_redraw(ranges, |g| g.set_property(property));
    }

    /// Modify the property of selected glyphs. No redraw will be performed.
    fn mod_glyphs_property_without_line_redraw(
        &self,
        ranges: &Vec<buffer::Range<UBytes>>,
        property: style::PropertyDiff,
    ) {
        self.modify_glyphs_in_ranges_without_line_redraw(ranges, |g| g.mod_property(property));
    }

    /// Modify the selected glyphs. No redraw will be performed.
    fn modify_glyphs_in_ranges_without_line_redraw(
        &self,
        ranges: &Vec<buffer::Range<UBytes>>,
        f: impl Fn(&Glyph),
    ) {
        for &range in ranges {
            self.modify_glyphs_in_range_without_line_redraw(range, &f);
        }
    }

    /// Modify the selected glyphs. No redraw will be performed.
    fn modify_glyphs_in_range_without_line_redraw(
        &self,
        range: buffer::Range<UBytes>,
        f: impl Fn(&Glyph),
    ) {
        let range = self.buffer.offset_range_to_location(range);
        let range = self.buffer.location_range_to_view_location_range(range);
        let lines = self.lines.borrow();
        if range.start.line == range.end.line {
            for glyph in &lines[range.start.line] {
                if glyph.start_byte_offset.get() >= range.end.offset {
                    break;
                }
                if glyph.start_byte_offset.get() >= range.start.offset {
                    f(&glyph)
                }
            }
        } else {
            let first_line = range.start.line;
            let second_line = first_line + ViewLine(1);
            let last_line = range.end.line;
            for glyph in &lines[first_line] {
                if glyph.start_byte_offset.get() >= range.start.offset {
                    f(&glyph)
                }
            }
            for line in &lines[second_line..last_line] {
                for glyph in line {
                    f(&glyph)
                }
            }
            for glyph in &lines[last_line] {
                if glyph.start_byte_offset.get() < range.end.offset {
                    f(&glyph)
                }
            }
        }
    }
}



// ===================================
// === Default Property Management ===
// ===================================

impl TextModel {
    /// Change a default value of a property.
    fn set_property_default(&self, property: Option<style::ResolvedProperty>) {
        if let Some(property) = property {
            if Self::property_change_invalidates_cache(property) {
                self.set_property_default_with_line_redraw(property)
            } else {
                self.set_property_default_without_line_redraw(property)
            }
        }
    }

    /// Change a default value of a property that requires line redraw, like changing the default
    /// glyph weight or size.
    fn set_property_default_with_line_redraw(&self, property: style::ResolvedProperty) {
        let range = self.buffer.full_range();
        let formatting = self.buffer.sub_style(range);
        let span_ranges = formatting.span_ranges_of_default_values(property.tag());
        self.clear_cache_and_redraw_sorted_line_ranges(span_ranges);
    }

    /// Change a default value of a property  that does not require line redraw, like changing the
    /// default glyph color.
    fn set_property_default_without_line_redraw(&self, property: style::ResolvedProperty) {
        let range = self.buffer.full_range();
        let formatting = self.buffer.sub_style(range);
        let span_ranges = formatting.span_ranges_of_default_values(property.tag());
        for span_range in span_ranges {
            let range = buffer::Range::<Location>::from_in_context(self, span_range);
            let mut lines = self.lines.borrow_mut();
            if range.single_line() {
                let view_line = ViewLine::from_in_context(self, range.start.line);
                let line = &mut lines[view_line];
                for glyph in &mut line.glyphs[range.start.offset..range.end.offset] {
                    glyph.set_property(property);
                }
            } else {
                let view_line = ViewLine::from_in_context(self, range.start.line);
                let first_line = &mut lines[view_line];
                for glyph in &mut first_line.glyphs[range.start.offset..] {
                    glyph.set_property(property);
                }
                let view_line = ViewLine::from_in_context(self, range.end.line);
                let last_line = &mut lines[view_line];
                for glyph in &mut last_line.glyphs[..range.end.offset] {
                    glyph.set_property(property);
                }
                for line_index in range.start.line.value + 1..range.end.line.value {
                    let view_line = ViewLine::from_in_context(self, Line(line_index));
                    let line = &mut lines[view_line];
                    for glyph in &mut line.glyphs[..] {
                        glyph.set_property(property);
                    }
                }
            }
        }
    }

    #[profile(Debug)]
    fn set_font(&self, font_name: &str) {
        let app = &self.app;
        let scene = &app.display.default_scene;
        let fonts = scene.extension::<font::Registry>();
        let font = fonts.load(font_name);
        let glyph_system = font::glyph::System::new(&scene, font);
        self.display_object.add_child(&glyph_system);
        let old_glyph_system = self.glyph_system.replace(glyph_system);
        self.display_object.remove_child(&old_glyph_system);
        // Remove old Glyph structures, as they still refer to the old Glyph System.
        self.take_lines();
        self.add_symbols_to_scene_layer();
        self.redraw();
    }
}



// ========================
// === Line Positioning ===
// ========================

impl TextModel {
    // Update the lines y-axis position starting with the provided line index. Results the first
    // well positioned line or the next line after the last visible line.
    fn position_lines_starting_with(&self, mut line_index: ViewLine) -> ViewLine {
        let last_line_index = self.lines.last_line_index();
        let lines = self.lines.borrow();
        while line_index <= last_line_index {
            let line = &lines[line_index];
            let current_pos_y = line.baseline();
            let ascender = -line.metrics().ascender;
            let new_baseline = if line_index == ViewLine(0) {
                ascender
            } else {
                let prev_line_index = ViewLine(line_index.value - 1);
                let prev_line = &lines[prev_line_index];
                let offset = prev_line.metrics().descender + ascender - line.metrics().gap;
                prev_line.baseline() + offset
            };
            let new_baseline = new_baseline.round();
            if current_pos_y == new_baseline {
                break;
            }
            line.set_baseline(new_baseline);
            line_index += ViewLine(1);
        }
        line_index
    }

    /// Position all lines in the provided line range. The range has to be sorted.
    fn position_sorted_line_ranges(
        &self,
        sorted_line_ranges: impl Iterator<Item = RangeInclusive<ViewLine>>,
    ) {
        let mut first_ok_line_index = None;
        let mut line_index_to_position = ViewLine(0);
        for range in sorted_line_ranges {
            line_index_to_position = match first_ok_line_index {
                None => *range.start(),
                Some(p) => std::cmp::max((p + ViewLine(1)), *range.start()),
            };
            // We are positioning one more line, because if a line is removed, the last redraw line
            // index can be placed in the previous line, that was already well positioned. The next
            // line has to be updated.
            let range_end = *range.end() + ViewLine(1);
            if line_index_to_position <= range_end {
                loop {
                    let ok_line_index = self.position_lines_starting_with(line_index_to_position);
                    first_ok_line_index = Some(ok_line_index);
                    if ok_line_index >= range_end {
                        break;
                    }
                    line_index_to_position = ok_line_index + ViewLine(1);
                }
            }
        }
    }
}



// =======================
// === Size Management ===
// =======================

impl TextModel {
    fn compute_width_if_dirty(&self) -> Option<f32> {
        self.width_dirty.get().then(|| {
            self.width_dirty.set(false);
            let mut max_width = 0.0;
            for line in &*self.lines.borrow() {
                if let Some(truncation) = &*line.truncation.borrow() {
                    let width = truncation.max_x();
                    if width > max_width {
                        max_width = width;
                    }
                } else {
                    let last_glyph = line.glyphs.iter().rev().find(|g| !g.attached_to_cursor.get());
                    let width = last_glyph.map(|g| g.x() + g.x_advance.get()).unwrap_or_default();
                    if width > max_width {
                        max_width = width;
                    }
                }
            }
            let selection_map = self.selection_map.borrow();
            for selection in selection_map.id_map.values() {
                let width = selection.right_side_of_last_attached_glyph.value();
                if width > max_width {
                    max_width = width;
                }
            }
            max_width
        })
    }

    fn compute_height_if_dirty(&self) -> Option<f32> {
        self.height_dirty.get().then(|| {
            self.height_dirty.set(false);
            let mut max_height = -self.lines.borrow().last().descent.value();
            let selection_map = self.selection_map.borrow();

            for (view_line, map) in &selection_map.location_map {
                for selection_id in map.values() {
                    let selection = selection_map.id_map.get(selection_id).unwrap();
                    let baseline = selection.position.value().y;
                    let descender = self.lines.borrow()[*view_line].metrics.value().descender;
                    let height = -baseline - descender;
                    if height > max_height {
                        max_height = height;
                    }
                }
            }
            max_height
        })
    }
}



// ==================
// === Operations ===
// ==================

impl TextModel {
    fn copy(&self, text_chunks: &[String]) {
        let encoded = match text_chunks {
            [] => "".to_string(),
            [s] => s.clone(),
            lst => lst.join(CLIPBOARD_RECORD_SEPARATOR),
        };
        clipboard::write_text(encoded);
    }

    /// Paste new text in the place of current selections / cursors. In case of pasting multiple
    /// chunks (e.g. after copying multiple selections), the chunks will be pasted into subsequent
    /// selections. In case there are more chunks than selections, end chunks will be dropped. In
    /// case there is more selections than chunks, end selections will be replaced with empty
    /// strings. I `self.single_line` is set to true then each chunk will be truncated to its first
    /// line.
    fn paste_string(&self, s: &str) {
        let mut chunks = self.decode_paste(s);
        if self.frp.output.single_line_mode.value() {
            for f in &mut chunks {
                Self::drop_all_but_first_line(f);
            }
        }
        self.buffer.frp.paste(chunks);
    }

    fn decode_paste(&self, encoded: &str) -> Vec<String> {
        encoded.split(CLIPBOARD_RECORD_SEPARATOR).map(|s| s.into()).collect()
    }

    fn drop_all_but_first_line(s: &mut String) {
        *s = s.lines().next().unwrap_or("").to_string();
    }

    fn key_to_string(&self, key: &Key) -> Option<String> {
        match key {
            Key::Character(s) => Some(s.clone()),
            Key::Enter => self.frp.output.single_line_mode.value().not().as_some("\n".into()),
            Key::Space => Some(" ".into()),
            _ => None,
        }
    }
}



// ========================
// === Layer Management ===
// ========================

impl TextModel {
    fn add_symbols_to_scene_layer(&self) {
        let layer = &self.layer.get();
        for symbol in self.symbols() {
            layer.add_exclusive(&symbol);
        }
    }

    fn remove_symbols_from_scene_layer(&self, layer: &display::scene::Layer) {
        for symbol in self.symbols() {
            layer.remove_symbol(&symbol);
        }
    }

    fn symbols(&self) -> SmallVec<[display::Symbol; 1]> {
        let text_symbol = self.glyph_system.borrow().sprite_system().symbol.clone_ref();
        let shapes = &self.app.display.default_scene.shapes;
        let selection_system = shapes.shape_system(PhantomData::<selection::shape::Shape>);
        let _selection_symbol = selection_system.shape_system.symbol.clone_ref();
        //TODO[ao] we cannot move selection symbol, as it is global for all the text areas.
        SmallVec::from_buf([text_symbol /* selection_symbol */])
    }
}



// ==============
// === Traits ===
// ==============

impl<S, T> FromInContext<&TextModel, S> for T
where T: for<'t> FromInContext<&'t buffer::View, S>
{
    fn from_in_context(context: &TextModel, arg: S) -> Self {
        T::from_in_context(&context.buffer, arg)
    }
}

impl display::Object for TextModel {
    fn display_object(&self) -> &display::object::Instance {
        &self.display_object
    }
}

impl display::Object for Text {
    fn display_object(&self) -> &display::object::Instance {
        self.data.display_object()
    }
}

impl FrpNetworkProvider for Text {
    fn network(&self) -> &frp::Network {
        self.frp.network()
    }
}



// ================
// === App View ===
// ================

impl application::View for Text {
    fn label() -> &'static str {
        "TextArea"
    }

    fn new(app: &Application) -> Self {
        Text::new(app)
    }

    fn app(&self) -> &Application {
        &self.data.app
    }

    fn default_shortcuts() -> Vec<shortcut::Shortcut> {
        use shortcut::ActionType::*;
        (&[
            (PressAndRepeat, "left", "cursor_move_left"),
            (PressAndRepeat, "right", "cursor_move_right"),
            (PressAndRepeat, "up", "cursor_move_up"),
            (PressAndRepeat, "down", "cursor_move_down"),
            (PressAndRepeat, "cmd left", "cursor_move_left_word"),
            (PressAndRepeat, "cmd right", "cursor_move_right_word"),
            (Press, "alt left", "cursor_move_left_of_line"),
            (Press, "alt right", "cursor_move_right_of_line"),
            (Press, "home", "cursor_move_left_of_line"),
            (Press, "end", "cursor_move_right_of_line"),
            (PressAndRepeat, "shift left", "cursor_select_left"),
            (PressAndRepeat, "shift right", "cursor_select_right"),
            (PressAndRepeat, "cmd shift left", "cursor_select_left_word"),
            (PressAndRepeat, "cmd shift right", "cursor_select_right_word"),
            (PressAndRepeat, "shift up", "cursor_select_up"),
            (PressAndRepeat, "shift down", "cursor_select_down"),
            (PressAndRepeat, "backspace", "delete_left"),
            (PressAndRepeat, "delete", "delete_right"),
            (PressAndRepeat, "cmd backspace", "delete_word_left"),
            (PressAndRepeat, "cmd delete", "delete_word_right"),
            (Press, "shift left-mouse-button", "set_newest_selection_end_to_mouse_position"),
            (DoublePress, "left-mouse-button", "select_word_at_cursor"),
            (Press, "left-mouse-button", "set_cursor_at_mouse_position"),
            (Press, "left-mouse-button", "start_newest_selection_end_follow_mouse"),
            (Release, "left-mouse-button", "stop_newest_selection_end_follow_mouse"),
            (Press, "cmd left-mouse-button", "add_cursor_at_mouse_position"),
            (Press, "cmd left-mouse-button", "start_newest_selection_end_follow_mouse"),
            (Release, "cmd left-mouse-button", "stop_newest_selection_end_follow_mouse"),
            (Press, "cmd a", "select_all"),
            (Press, "cmd c", "copy"),
            (Press, "cmd x", "cut"),
            (Press, "cmd v", "paste"),
            (Press, "escape", "keep_oldest_cursor_only"),
        ])
            .iter()
            .map(|(action, rule, command)| {
                let only_hovered = *action != Release && rule.contains("left-mouse-button");
                let condition = if only_hovered { "focused & hovered" } else { "focused" };
                Self::self_shortcut_when(*action, *rule, *command, condition)
            })
            .collect()
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;

    /// Assert that there is no inherent memory leak in the [text::Text].
    #[test]
    fn assert_no_leak() {
        let app = Application::new("root");
        let text = app.new_view::<Text>();
        let text_frp = Rc::downgrade(&text.frp);
        let text_data = Rc::downgrade(&text.data);
        drop(text);
        assert_eq!(text_frp.strong_count(), 0, "There are FRP references left.");
        assert_eq!(text_data.strong_count(), 0, "There are  data references left.");
    }
}
