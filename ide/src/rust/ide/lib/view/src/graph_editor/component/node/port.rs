//! Definition of the Port component.

#[warn(missing_docs)]
pub mod output;

use crate::prelude::*;

//use crate::component::node::port::Registry;

use enso_frp as frp;
use enso_frp;
use ensogl::data::color;
use ensogl::display::Attribute;
use ensogl::display::Buffer;
use ensogl::display::Sprite;
use ensogl::display::scene::Scene;
use ensogl::display::shape::*;
use ensogl::display::shape::text::glyph::system::GlyphSystem;
use ensogl::display::traits::*;
use ensogl::display;
use ensogl::gui::component;
use ensogl::gui::cursor;
use span_tree::SpanTree;

use super::super::node;

use crate::graph_editor::Type;
use crate::graph_editor::component::type_coloring::MISSING_TYPE_COLOR;
use crate::graph_editor::component::type_coloring::TypeColorMap;



// ============
// === Port ===
// ============

/// Canvas node shape definition.
pub mod shape {
    use super::*;

    ensogl::define_shape_system! {
        (style:Style, hover:f32) {
            let width  : Var<Pixels> = "input_size.x".into();
            let height : Var<Pixels> = "input_size.y".into();
            let radius = 6.px();
            let shape  = Rect((&width,&height)).corners_radius(radius);
            let color  : Var<color::Rgba> = "srgba(1.0,1.0,1.0,0.00001)".into();
            let shape  = shape.fill(color);
            shape.into()
        }
    }
}

pub mod label {
    use super::*;

    #[derive(Clone,CloneRef,Debug)]
    #[allow(missing_docs)]
    pub struct Shape {
        pub label : ensogl::display::shape::text::glyph::system::Line,
        pub obj   : display::object::Instance,

    }
    impl ensogl::display::shape::system::Shape for Shape {
        type System = ShapeSystem;
        fn sprites(&self) -> Vec<&Sprite> {
            vec![]
        }
    }
    impl display::Object for Shape {
        fn display_object(&self) -> &display::object::Instance {
            &self.obj
        }
    }
    #[derive(Clone, CloneRef, Debug)]
    #[allow(missing_docs)]
    pub struct ShapeSystem {
        pub glyph_system: GlyphSystem,
        style_manager: StyleWatch,

    }
    impl ShapeSystemInstance for ShapeSystem {
        type Shape = Shape;

        fn new(scene:&Scene) -> Self {
            let style_manager = StyleWatch::new(&scene.style_sheet);
            let font          = scene.fonts.get_or_load_embedded_font("DejaVuSansMono").unwrap();
            let glyph_system  = GlyphSystem::new(scene,font);
            let symbol        = &glyph_system.sprite_system().symbol;
            scene.views.main.remove(symbol);
            scene.views.label.add(symbol);
            Self {glyph_system,style_manager} // .init_refresh_on_style_change()
        }

        fn new_instance(&self) -> Self::Shape {
            let color = color::Rgba::new(1.0, 1.0, 1.0, 0.7);
            let obj   = display::object::Instance::new(Logger::new("test"));
            let label = self.glyph_system.new_line();
            label.set_font_size(12.0);
            label.set_font_color(color);
            label.set_text("");
            obj.add_child(&label);
            Shape {label,obj}
        }
    }
}


pub fn sort_hack(scene:&Scene) {
    let logger = Logger::new("hack");
    component::ShapeView::<shape::Shape>::new(&logger,scene);
}


#[derive(Debug,Clone,CloneRef)]
pub struct Events {
    pub network         : frp::Network,
    pub cursor_style    : frp::Stream<cursor::Style>,
    pub press           : frp::Stream<span_tree::Crumbs>,
    pub hover           : frp::Stream<Option<span_tree::Crumbs>>,
    press_source        : frp::Source<span_tree::Crumbs>,
    hover_source        : frp::Source<Option<span_tree::Crumbs>>,
    cursor_style_source : frp::Any<cursor::Style>,
}



// ==================
// === Expression ===
// ==================

#[derive(Clone,Default)]
pub struct Expression {
    pub code             : String,
    pub input_span_tree  : SpanTree,
    pub output_span_tree : SpanTree,
}

impl Expression {
    pub fn debug_from_str(s:&str) -> Self {
        let code             = s.into();
        let input_span_tree  = default();
        let output_span_tree = default();
        Self {code,input_span_tree,output_span_tree}
    }
}

fn get_id_for_crumbs(span_tree:&SpanTree, crumbs:&[span_tree::Crumb]) -> Option<ast::Id> {
    if span_tree.root_ref().crumbs == crumbs {
        return span_tree.root.expression_id
    };
    let span_tree_descendant = span_tree.root_ref().get_descendant(crumbs);
    let expression_id        = span_tree_descendant.map(|node|{node.expression_id});
    expression_id.ok().flatten()
}


impl Debug for Expression {
    fn fmt(&self, f:&mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f,"Expression({})",self.code)
    }
}

impl From<&Expression> for Expression {
    fn from(t:&Expression) -> Self {
        t.clone()
    }
}



// ===============
// === Manager ===
// ===============

#[derive(Clone,CloneRef,Debug)]
pub struct Manager {
    logger         : Logger,
    display_object : display::object::Instance,
    scene          : Scene,
    expression     : Rc<RefCell<Expression>>,
    label          : component::ShapeView<label::Shape>,
    ports          : Rc<RefCell<Vec<component::ShapeView<shape::Shape>>>>,
    width          : Rc<Cell<f32>>,
    port_networks  : Rc<RefCell<Vec<frp::Network>>>,
    type_color_map : TypeColorMap,
    pub frp        : Events,
}

impl Manager {
    pub fn new(logger:impl AnyLogger, scene:&Scene) -> Self {
        frp::new_network! { network
            cursor_style_source <- any_mut::<cursor::Style>();
            press_source        <- source::<span_tree::Crumbs>();
            hover_source        <- source::<Option<span_tree::Crumbs>>();
        }

        let logger         = Logger::sub(logger,"port_manager");
        let display_object = display::object::Instance::new(&logger);
        let scene          = scene.clone_ref();
        let expression     = default();
        let port_networks  = default();
        let type_color_map = default();
        let label          = component::ShapeView::<label::Shape>::new(&logger,&scene);
        let ports          = default();
        let width          = default();
        let cursor_style   = (&cursor_style_source).into();
        let press          = (&press_source).into();
        let hover          = (&hover_source).into();
        let frp            = Events
            {network,cursor_style,press,hover,cursor_style_source,press_source,hover_source};

        label.mod_position(|t| t.y -= 4.0);

        display_object.add_child(&label);

        Self {logger,display_object,frp,label,ports,width,scene,expression,port_networks,type_color_map}
    }

    pub fn set_expression(&self, expression:impl Into<Expression>) {
        let     expression    = expression.into();


        self.label.shape.label.set_text(&expression.code);

        let glyph_width = 7.224_609_4; // FIXME hardcoded literal
        let width       = expression.code.len() as f32 * glyph_width;
        self.width.set(width);


        let mut to_visit      = vec![expression.input_span_tree.root_ref()];
        let mut ports         = vec![];
        let mut port_networks = vec![];

        loop {
            match to_visit.pop() {
                None => break,
                Some(node) => {
                    let span          = node.span();
                    let contains_root = span.index.value == 0;
                    let skip          = node.kind.is_empty() || contains_root;
                    if !skip {
                        let logger      = Logger::sub(&self.logger,"port");
                        let port        = component::ShapeView::<shape::Shape>::new(&logger,&self.scene);
                        let type_map    = &self.type_color_map;

                        let unit        = 7.224_609_4;
                        let width       = unit * span.size.value as f32;
                        let width2      = width + 8.0;
                        let node_height = 28.0;
                        let height      = 18.0;
                        port.shape.sprite.size.set(Vector2::new(width2,node_height));
                        let x = width/2.0 + unit * span.index.value as f32;
                        port.mod_position(|t| t.x = x);
                        self.add_child(&port);

                        let hover   = &port.shape.hover;
                        let crumbs  = node.crumbs.clone();
                        let ast_id   = get_id_for_crumbs(&expression.input_span_tree,&crumbs);
                        frp::new_network! { port_network
                            def _foo = port.events.mouse_over . map(f_!(hover.set(1.0);));
                            def _foo = port.events.mouse_out  . map(f_!(hover.set(0.0);));

                            def out  = port.events.mouse_out.constant(cursor::Style::default());
                            def over = port.events.mouse_over.map(f_!([type_map,port]{
                                if let Some(ast_id) = ast_id {
                                    if let Some(port_color) = type_map.type_color(ast_id) {
                                        return cursor::Style::new_highlight(&port,Vector2::new(width2,height),Some(port_color))
                                    }
                                }
                                cursor::Style::new_highlight(&port,Vector2::new(width2,height),Some(MISSING_TYPE_COLOR))
                            }));
                            // FIXME: the following lines leak memory in the current FRP
                            // implementation because self.frp does not belong to this network and
                            // we are attaching node there. Nothing bad should happen though.
                            self.frp.cursor_style_source.attach(&over);
                            self.frp.cursor_style_source.attach(&out);

                            let crumbs_down  = crumbs.clone();
                            let crumbs_over  = crumbs.clone();
                            let press_source = &self.frp.press_source;
                            let hover_source = &self.frp.hover_source;
                            eval_ port.events.mouse_down (press_source.emit(&crumbs_down));
                            eval_ port.events.mouse_over (hover_source.emit(&Some(crumbs_over.clone())));
                            eval_ port.events.mouse_out  (hover_source.emit(&None));
                        }
                        ports.push(port);
                        port_networks.push(port_network);
                    }

                    to_visit.extend(node.children_iter());
                }
            }
        }

        *self.expression.borrow_mut()    = expression;
        *self.ports.borrow_mut()         = ports;
        *self.port_networks.borrow_mut() = port_networks;
    }

    pub fn get_port_offset(&self, crumbs:&[span_tree::Crumb]) -> Option<Vector2<f32>> {
        let span_tree = &self.expression.borrow().input_span_tree;
        span_tree.root_ref().get_descendant(crumbs).map(|node|{
            let span  = node.span();
            let unit  = 7.224_609_4;
            let width = unit * span.size.value as f32;
            let x     = width/2.0 + unit * span.index.value as f32;
            Vector2::new(x + node::TEXT_OFF,node::NODE_HEIGHT/2.0) // FIXME
        }).ok()
    }

    pub fn get_port_color(&self, crumbs:&[span_tree::Crumb]) -> Option<color::Lcha> {
        let ast_id = get_id_for_crumbs(&self.expression.borrow().input_span_tree,&crumbs)?;
        self.type_color_map.type_color(ast_id)
    }

    pub fn width(&self) -> f32 {
        self.width.get()
    }

    pub fn set_expression_type(&self, id:ast::Id, maybe_type:Option<Type>) {
        self.type_color_map.update_entry(id,maybe_type);
    }
}

impl display::Object for Manager {
    fn display_object(&self) -> &display::object::Instance {
        &self.display_object
    }
}
