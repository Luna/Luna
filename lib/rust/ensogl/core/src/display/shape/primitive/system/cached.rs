use crate::prelude::*;

use crate::data::bounding_box::BoundingBox;
use crate::display::shape;
use crate::display::shape::canvas;
use crate::display::shape::canvas::Canvas;
use crate::display::shape::class::ShapeRef;
use crate::display::shape::system::cached::arrange_on_texture::arrange_shapes_on_texture;
use crate::display::shape::system::cached::arrange_on_texture::ShapeWithPosition;
use crate::display::shape::system::cached::arrange_on_texture::ShapeWithSize;
use crate::display::shape::AnyShape;
use crate::display::shape::Parameter;
use crate::display::shape::Var;
use crate::display::world::CACHED_SHAPES_DEFINITIONS;
use crate::display::IntoGlsl;
use crate::gui::component::ShapeView;

pub mod arrange_on_texture;



// =================
// === Constants ===
// =================

/// A parameter of [`arrange_shapes_on_texture`] algorithm: the initial assumed size for the texture
/// with cached shapes. If it turn out to be too small, we extend this size and try again.
const INITIAL_TEXTURE_SIZE: i32 = 512;



// ======================
// === Texture Layout ===
// ======================

// === Texture Size ===

thread_local! {
    static TEXTURE_SIZE: Cell<Vector2<i32>> = default();
}

pub fn texture_size() -> Vector2<i32> {
    TEXTURE_SIZE.get()
}


// === initialize_cached_shape_positions_in_texture ===

pub fn initialize_cached_shape_positions_in_texture() {
    CACHED_SHAPES_DEFINITIONS.with_borrow(|shape_defs| {
        let with_sizes = shape_defs.iter().map(|def| ShapeWithSize { shape: def, size: def.size });
        let arranged = arrange_shapes_on_texture(with_sizes, INITIAL_TEXTURE_SIZE);
        TEXTURE_SIZE.set(arranged.texture_size);
        for ShapeWithPosition { shape, position } in arranged.shape_positions {
            (shape.position_on_texture_setter)(position)
        }
    })
}



// ===================
// === CachedShape ===
// ===================

pub trait CachedShape: shape::system::Shape {
    const WIDTH: i32;
    const HEIGHT: i32;
    fn set_position_in_texture(position: Vector2);
    fn get_position_in_texture() -> Vector2;

    fn create_view_for_texture() -> ShapeView<Self>
    where Self::ShapeData: Default {
        let shape = ShapeView::<Self>::new();
        shape.set_size(Vector2(Self::WIDTH as f32, Self::HEIGHT as f32));
        shape.set_xy(Self::get_position_in_texture());
        shape
    }

    fn location_in_texture() -> BoundingBox {
        let position = Self::get_position_in_texture();
        let left = position.x - Self::WIDTH as f32 / 2.0;
        let right = position.x + Self::WIDTH as f32 / 2.0;
        let bottom = position.y - Self::HEIGHT as f32 / 2.0;
        let top = position.y + Self::HEIGHT as f32 / 2.0;
        BoundingBox::from_corners(Vector2(left, bottom), Vector2(right, top))
    }
}



// ======================
// === AnyCachedShape ===
// ======================

pub mod mutable {
    use super::*;

    #[derive(Debug)]
    pub struct AnyCachedShape {
        pub tex_location: Var<Vector4>,
    }
}

pub type AnyCachedShape = ShapeRef<mutable::AnyCachedShape>;

#[allow(non_snake_case)]
pub fn Instance(tex_location: Var<Vector4>) -> AnyCachedShape {
    ShapeRef::new(mutable::AnyCachedShape { tex_location })
}

impl AsOwned for AnyCachedShape {
    type Owned = AnyCachedShape;
}

impl canvas::Draw for AnyCachedShape {
    fn draw(&self, canvas: &mut Canvas) -> canvas::Shape {
        canvas.if_not_defined(self.id(), |canvas| {
            canvas.new_shape_from_expr(&format!(
                "return cached_shape(Id({}), position, {});",
                self.id(),
                self.tex_location.glsl()
            ))
        })
    }
}

impl From<AnyCachedShape> for AnyShape {
    fn from(value: AnyCachedShape) -> Self {
        Self::new(value)
    }
}

impl From<&AnyCachedShape> for AnyShape {
    fn from(value: &AnyCachedShape) -> Self {
        Self::new(value.clone())
    }
}

impl Parameter for AnyCachedShape {
    type GpuType = Vector4;
    type Variable = AnyCachedShape;

    fn create_var(name: &str) -> Self::Variable {
        let location: Var<Vector4> = name.into();
        Instance(location)
    }
}



// =============================
// === `cached_shape!` Macro ===
// =============================


/// Defines a new cached shape system.
///
/// The outcome is the same as for [`shape!`] macro, but the shape will be near application start
/// to the special "cached shapes" texture. The texture is available in GLSL as "pass_cached_shapes"
/// uniform. In the future there will be also a possibility of parametrization of normal shapes by
/// cached shapes (see [#184212663](https://www.pivotaltracker.com/story/show/184212663)).
///
/// Because shape, once cached, is not redrawn, we don't allow for any parameterization except
/// styles.
#[macro_export]
macro_rules! cached_shape {
    (
        $width:literal x $height:literal;
        $(type SystemData = $system_data:ident;)?
        $(type ShapeData = $shape_data:ident;)?
        $(flavor = $flavor:path;)?
        $(above = [$($always_above_1:tt $(::$always_above_2:tt)*),*];)?
        $(below = [$($always_below_1:tt $(::$always_below_2:tt)*),*];)?
        $(pointer_events = $pointer_events:tt;)?
        ($style:ident : Style) {$($body:tt)*}
    ) => {
        $crate::_shape! {
            $(SystemData($system_data))?
            $(ShapeData($shape_data))?
            $(flavor = [$flavor];)?
            $(above = [$($always_above_1 $(::$always_above_2)*),*];)?
            $(below = [$($always_below_1 $(::$always_below_2)*),*];)?
            $(pointer_events = $pointer_events;)?
            [$style] (){$($body)*}
        }

        pub mod cached_shape_system_definition {
            use $crate::prelude::*;
            use wasm_bindgen::prelude::*;
            use super::shape_system_definition::*;
            use super::shape_system_definition::Shape;
            use $crate::display::shape::primitive::system::cached::CachedShape;

            thread_local! {
                static POSITION_IN_TEXTURE: Cell<Vector2> = default();
            }

            impl CachedShape for Shape {
                const WIDTH: i32 = $width;
                const HEIGHT: i32 = $height;
                fn set_position_in_texture(position: Vector2) {
                    POSITION_IN_TEXTURE.with(|pos| pos.set(position))
                }
                fn get_position_in_texture() -> Vector2 {
                    POSITION_IN_TEXTURE.with(|pos| pos.get())
                }
            }

            pub fn as_param() -> Vector4 {
                let bbox = <Shape as CachedShape>::location_in_texture();
                Vector4(bbox.left(), bbox.bottom(), bbox.right(), bbox.top())
            }

            //TODO[ao] fix before_main perhaps?

            #[before_main]
            pub fn register_cached_shape_entry_point() {
                register_cached_shape()
            }

            pub fn register_cached_shape() {
                $crate::display::world::CACHED_SHAPES_DEFINITIONS.with(|shapes| {
                    let mut shapes = shapes.borrow_mut();
                    shapes.push($crate::display::world::CachedShapeDefinition {
                        for_texture_constructor: Box::new(|| Box::new(Shape::create_view_for_texture())),
                        position_on_texture_setter: Box::new(Shape::set_position_in_texture),
                        size: Vector2(Shape::WIDTH, Shape::HEIGHT),
                    });
                });
            }
        }
        pub use cached_shape_system_definition::as_param;
    };
}



// ============
// === Test ===
// ============

#[cfg(test)]
mod tests {
    use super::*;
    use crate::display;
    use crate::display::object::layout;
    use crate::display::world::World;

    mod shape1 {
        use super::*;
        cached_shape! { 256 x 256;
            (_style: Style) {
                Plane().into()
            }
        }
    }

    mod shape2 {
        use super::*;
        cached_shape! { 256 x 128;
            (_style: Style) {
                Plane().into()
            }
        }
    }

    mod shape3 {
        use super::*;
        cached_shape! { 128 x 130;
            (_style: Style) {
                Plane().into()
            }
        }
    }

    #[test]
    fn cached_shapes_initialization_and_texture_location() {
        shape1::cached_shape_system_definition::register_cached_shape();
        shape2::cached_shape_system_definition::register_cached_shape();
        shape3::cached_shape_system_definition::register_cached_shape();
        let _world = World::new();

        let tex_width = 512.0;
        let tex_height = 258.0;
        assert_eq!(texture_size(), Vector2(tex_width as i32, tex_height as i32));

        assert_eq!(shape1::Shape::get_position_in_texture(), Vector2(-128.0, -1.0));
        assert_eq!(shape2::Shape::get_position_in_texture(), Vector2(128.0, -65.0));
        assert_eq!(shape3::Shape::get_position_in_texture(), Vector2(64.0, 64.0));

        assert_eq!(
            shape1::Shape::location_in_texture(),
            ((0.0, 0.0), (0.5, 256.0 / tex_height)).into()
        );
        assert_eq!(
            shape2::Shape::location_in_texture(),
            ((0.5, 0.0), (1.0, 128.0 / tex_height)).into()
        );
        assert_eq!(
            shape3::Shape::location_in_texture(),
            ((0.5, 128.0 / tex_height), (0.75, 1.0)).into()
        );

        let view = shape1::Shape::create_view_for_texture();
        assert_eq!(view.xy(), Vector2(-128.0, -1.0));
        assert_eq!(
            view.size(),
            Vector2(
                layout::Size::Fixed(layout::Unit::Pixels(256.0)),
                layout::Size::Fixed(layout::Unit::Pixels(256.0))
            )
        );
    }
}
