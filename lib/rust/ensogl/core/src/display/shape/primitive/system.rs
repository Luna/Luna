//! This module defines a shape system abstraction and a [`shape!`] macro allowing the definition of
//! custom shape systems.
//!
//! # High-level description
//! In the simplest form, a shape system just a [`SpriteSystem`] that has a special material applied
//! and that keeps references to its attributes and exposes a nice API to the user. For example,
//! the following code defines a shape system that renders a circle:
//!
//! ```text
//! mod shape {
//!     use super::*;
//!     ensogl::shape! {
//!         (style: Style, radius: f32) {
//!             let shape = Circle(radius.px());
//!             let shape = shape.fill(color::Rgb::new(1.0,0.0,0.0));
//!             shape.into()
//!         }
//!     }
//! }
//! ```
//!
//! The [`style: Style`] parameter is always required. It is a reference to a style sheet that if
//! updated, will cause the shape system's shader to be recompiled (if the change affects the shape
//! system). All other parameters are optional and can be used to define attributes. In the above
//! example, the [`radius: f32`] parameter defines an attribute that will be passed to the material
//! of the underlying [`SpriteSystem`].
//!
//! The [`shape!`] macro generates a struct [`View`] that is the main entity that can be placed on
//! the stage. For example, to create the above circle, you can do as follows:
//!
//! ```text
//! fn main(world: &World) {
//!     let view = shape::View::new();
//!     // Setting the sprite canvas size.
//!     view.size.set(Vector2::new(300.0, 300.0));
//!     view.mod_position(|t| *t = Vector3::new(50.0, 50.0, 0.0));
//!     world.add_child(&view);
//!     // Forgetting the reference. In real world code you should not do this.
//!     mem::forget(view);
//! }
//! ```
//!
//! # Shape system life cycle
//! The shape's view is a [`Sprite`] with associated attributes and helper functions. Sprites are
//! associated with sprite systems, which are always associated with a given scene, because they
//! contain references to GPU buffers. Thus, creating a new view (e.g. by writing
//! `shape::View::new()`) has to create a new sprite in the correct sprite system instance. Every
//! layer on the scene has its own shape system registry, which basically associates shape system
//! definition type with a shape system instance (containing a sprite system instance). In case the
//! shape system is not present in the registry, it is created on demand. Then, the shape instance
//! (containing the sprite) is created.
//!
//! The shape's view is not a zero-cost abstraction, however, the cost is very low. It allows
//! replacing the shape instance in-place. For example, after moving the view from one layer to
//! another, the underlying shape system can change, and thus, a new sprite should be created and
//! should be used instead of the current one.
//!
//! A new shape system instance will be created in the [`scene::HardcodedLayers::DETACHED`] layer.
//! It contains shapes that were not added to any layer and that will not be rendered. In case a
//! shape system will be detached from the parent display object (and not attached to another one),
//! it will also be moved to the `DETACHED` layer.

use crate::prelude::*;
use crate::system::gpu::types::*;

use crate::display;
use crate::display::object::instance::GenericLayoutApi;
use crate::display::scene::Scene;
use crate::display::shape::primitive::shader;
use crate::display::symbol;
use crate::display::symbol::geometry::compound::sprite;
use crate::display::symbol::geometry::Sprite;
use crate::display::symbol::geometry::SpriteSystem;
use crate::display::symbol::material;
use crate::display::symbol::material::Material;
use crate::system::gpu::data::buffer::item::Storable;
use crate::system::gpu::data::InstanceIndex;

use super::def;



// =====================
// === ShapeSystemId ===
// =====================

newtype_prim_no_default_no_display! {
    /// The ID of a user generated shape system.
    ShapeSystemId(std::any::TypeId);
}



// =============
// === Shape ===
// =============

/// A shape definition. You do not need to implement it manually, use the `shape!`
/// macro instead.
#[allow(missing_docs)]
pub trait Shape: 'static + Sized + AsRef<Self::InstanceParams> {
    type InstanceParams: Debug + InstanceParamsTrait;
    type GpuParams: Debug;
    type SystemData: CustomSystemData<Self>;
    type ShapeData: Debug + ShapeSystemFlavorProvider;
    fn pointer_events() -> bool;
    fn always_above() -> Vec<ShapeSystemId>;
    fn always_below() -> Vec<ShapeSystemId>;
    fn new_instance_params(
        sprite: &Sprite,
        gpu_params: &Self::GpuParams,
        id: InstanceIndex,
    ) -> ShapeWithSize<Self>;
    fn new_gpu_params(shape_system: &ShapeSystemModel) -> Self::GpuParams;
    fn shape_def(style_watch: &display::shape::StyleWatch) -> def::AnyShape;
}

/// An alias for [`Shape]` where [`Shape::ShapeData`] is [`Default`].
pub trait ShapeWithDefaultableData = Shape where <Self as Shape>::ShapeData: Default;

/// A trait that each [`Shape::InstanceParams`] must implement. You do not have to implement it
/// manually, use the [`shape!`] macro instead.
#[allow(missing_docs)]
pub trait InstanceParamsTrait {
    fn swap(&self, other: &Self);
}

/// Some shape systems may want to use custom data in their systems. This trait allows to define
/// such data. In case a shape system does not need any custom data, the empty tuple will be used.
pub trait CustomSystemData<S: Shape> {
    /// Constructor.
    fn new(scene: &Scene, data: &ShapeSystemStandardData<S>, shape_data: &S::ShapeData) -> Self;
}

impl<S: Shape> CustomSystemData<S> for () {
    fn new(_scene: &Scene, _data: &ShapeSystemStandardData<S>, _shape_data: &S::ShapeData) -> Self {
    }
}



// =========================
// === ShapeSystemFlavor ===
// =========================

/// Shape systems are shared between different shape instances. When creating a new shape instance,
/// currently available shape systems are queried and if one matches the shape definition type, it
/// is used, not constructed. However, sometimes shapes need a separate shape system nevertheless.
/// For example, if a shape system uses custom [`ShapeData`] which defines a texture that depends on
/// some shape variables, we might want to construct a new shape system with a specific texture.
/// This is what happens with fonts. For each font family, a separate glyph atlas is created, and
/// thus, a shape system needs to be created for each used font family. The [`ShapeSystemFlavor`] is
/// used to differentiate such shape systems. You do not need to care about it in most cases.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Hash)]
pub struct ShapeSystemFlavor {
    /// The flavor of the shape system. In most cases, it is computed as a hash of some value, like
    /// a hash of font family name.
    pub flavor: u64,
}

/// Provider of a shape system flavor. Read docs of [`ShapeSystemFlavor`] for more information.
#[allow(missing_docs)]
pub trait ShapeSystemFlavorProvider {
    fn flavor(&self) -> ShapeSystemFlavor;
}

impl<T> ShapeSystemFlavorProvider for T {
    default fn flavor(&self) -> ShapeSystemFlavor {
        ShapeSystemFlavor { flavor: 0 }
    }
}



// =====================
// === ShapeWithSize ===
// =====================

/// A shape with its size parameter.
#[allow(missing_docs)]
#[derive(Debug, Deref)]
pub struct ShapeWithSize<S> {
    #[deref]
    shape: S,
    // pub size: ProxyParam<sprite::Size>,
}

impl<S> ShapeWithSize<S> {
    /// Constructor.
    pub fn new(shape: S) -> Self {
        Self { shape }
    }
}

impl<S: Shape> ShapeWithSize<S> {
    /// Swap in-place the shape definition with another one.
    pub(crate) fn swap(&self, other: &ShapeWithSize<S>) {
        self.shape.as_ref().swap(other.shape.as_ref());
    }
}



// =====================
// === ShapeInstance ===
// =====================

/// A visible shape instance, bound to a particular [`ShapeSystem`].
#[allow(missing_docs)]
#[derive(Deref, Debug)]
pub struct ShapeInstance<S> {
    #[deref]
    pub shape:      ShapeWithSize<S>,
    pub sprite:     RefCell<Sprite>,
    display_object: display::object::Instance,
}

impl<S> ShapeInstance<S> {
    /// Check if given pointer-event-target means this object.
    pub fn is_this_target(&self, target: display::scene::PointerTargetId) -> bool {
        self.sprite.borrow().is_this_target(target)
    }
}

impl<S: Shape> ShapeInstance<S> {
    /// Swap in-place the shape definition with another one.
    pub(crate) fn swap(&self, other: &Self) {
        self.shape.swap(&other.shape);
        self.sprite.swap(&other.sprite);
        self.display_object.replace_children(other.display_object.remove_all_children());
        // This function is called during display object hierarchy update, before updating children
        // of this display object, but after updating its layout. Thus, we need to update the layout
        // of the new sprite. Please note, that updating layout in the middle of a structure could
        // lead to wrong results if the new child layout is different than the old one (for example,
        // if the parent display object resizing mode wa set to "hug" and the new child has bigger
        // size, the parent would also need to be updated). However, we control the layout of the
        // sprite, so we know it did not change.
        self.display_object.refresh_layout();
        warn!("is scene dirty? {:#?}", crate::display::world::scene().display_object());
    }
}

impl<S> display::Object for ShapeInstance<S> {
    fn display_object(&self) -> &display::object::Instance {
        &self.display_object
    }
}



// ===================
// === ShapeSystem ===
// ===================

/// A shape system instance.
#[derive(CloneRef, Deref, Derivative)]
#[clone_ref(bound = "")]
#[derivative(Clone(bound = ""))]
#[derivative(Debug(bound = "S::SystemData: Debug"))]
pub struct ShapeSystem<S: Shape> {
    data: Rc<ShapeSystemData<S>>,
}

/// Internal representation of [`ShapeSystem`].
#[allow(missing_docs)]
#[derive(Deref, Derivative)]
#[derivative(Debug(bound = "S::SystemData: Debug"))]
pub struct ShapeSystemData<S: Shape> {
    #[deref]
    pub standard: ShapeSystemStandardData<S>,
    pub user:     S::SystemData,
}

/// The standard shape system data.
#[allow(missing_docs)]
#[derive(Deref, Derivative)]
#[derivative(Debug(bound = ""))]
pub struct ShapeSystemStandardData<S: Shape> {
    #[deref]
    gpu_params:  S::GpuParams,
    pub model:   ShapeSystemModel,
    style_watch: display::shape::StyleWatch,
}

impl<S: Shape> ShapeSystem<S> {
    /// The ID of this shape system.
    pub const fn id() -> ShapeSystemId {
        ShapeSystemId::new(std::any::TypeId::of::<S>())
    }

    /// Reference to the underlying sprite system.
    pub fn sprite_system(&self) -> &SpriteSystem {
        &self.data.model.sprite_system
    }

    /// Constructor.
    #[profile(Debug)]
    pub fn new(scene: &Scene, shape_data: &S::ShapeData) -> Self {
        let style_watch = display::shape::StyleWatch::new(&scene.style_sheet);
        let shape_def = S::shape_def(&style_watch);
        let events = S::pointer_events();
        let model = display::shape::ShapeSystemModel::new(shape_def, events);
        let gpu_params = S::new_gpu_params(&model);
        let standard = ShapeSystemStandardData { gpu_params, model, style_watch };
        let user = CustomSystemData::<S>::new(scene, &standard, shape_data);
        standard.model.init();
        let data = Rc::new(ShapeSystemData { standard, user });
        Self { data }.init_refresh_on_style_change()
    }

    // FIXME: the following 2 fns look similar
    /// Constructor of a new shape instance.
    #[profile(Debug)]
    pub fn new_instance(&self) -> ShapeInstance<S> {
        let sprite = self.model.sprite_system.new_instance();
        let id = sprite.instance_id;
        let shape = S::new_instance_params(&sprite, &self.gpu_params, id);
        let display_object = display::object::Instance::new_named("ShapeSystem");
        display_object.add_child(&sprite);
        // FIXME: workaround:
        display_object.set_layout_horizontal();
        let sprite = RefCell::new(sprite);
        ShapeInstance { sprite, shape, display_object }
    }

    #[profile(Debug)]
    pub(crate) fn instantiate(&self) -> (ShapeInstance<S>, symbol::GlobalInstanceId) {
        let sprite = self.model.sprite_system.new_instance();
        let instance_id = sprite.instance_id;
        let global_id = sprite.global_instance_id;
        let shape = S::new_instance_params(&sprite, &self.gpu_params, instance_id);
        let display_object = display::object::Instance::new_named("ShapeSystem");
        display_object.add_child(&sprite);
        // FIXME: workaround:
        display_object.set_layout_horizontal();
        let sprite = RefCell::new(sprite);
        let shape = ShapeInstance { sprite, shape, display_object };
        (shape, global_id)
    }

    #[profile(Debug)]
    fn init_refresh_on_style_change(self) -> Self {
        let model = &self.model;
        let style_watch = self.style_watch.clone_ref();
        self.style_watch.set_on_style_change(f!(() model.set_shape(S::shape_def(&style_watch))));
        self
    }
}



// ========================
// === ShapeSystemModel ===
// ========================

/// The model of a shape system, a wrapper for sprite system and material with several related
/// utilities, such as shape reloading.
#[allow(missing_docs)]
#[derive(Clone, CloneRef, Debug)]
pub struct ShapeSystemModel {
    pub sprite_system: SpriteSystem,
    pub shape: Rc<RefCell<def::AnyShape>>,
    pub material: Rc<RefCell<Material>>,
    pub geometry_material: Rc<RefCell<Material>>,
    /// Enables or disables pointer events on this shape system. All shapes of a shape system which
    /// have pointer events disabled will be completely transparent for the mouse (they will pass
    /// through all mouse events to shapes behind them).
    pub pointer_events: Immutable<bool>,
    /// Do not use the provided shape definition to generate material's body. It is rarely needed,
    /// when a custom material is provided that does not require any additional shape definition
    /// code. For example, the text system uses this field, as its material fully describes how to
    /// render glyphs.
    pub do_not_use_shape_definition: Rc<Cell<bool>>,
}

impl ShapeSystemModel {
    /// Constructor.
    #[profile(Detail)]
    pub fn new(shape: def::AnyShape, pointer_events: bool) -> Self {
        let sprite_system = SpriteSystem::new();
        let material = Rc::new(RefCell::new(Self::default_material()));
        let geometry_material = Rc::new(RefCell::new(Self::default_geometry_material()));
        let pointer_events = Immutable(pointer_events);
        let shape = Rc::new(RefCell::new(shape));
        let do_not_use_shape_definition = default();
        Self {
            sprite_system,
            shape,
            material,
            geometry_material,
            pointer_events,
            do_not_use_shape_definition,
        }
    }

    fn init(&self) {
        self.reload_shape();
    }

    // TODO[WD]: We should handle these attributes in a nicer way. Currently, they are hardcoded
    //     here, and we use magic to access them in shader builders.
    /// Defines a default material of this system.
    fn default_material() -> Material {
        let mut material = Material::new();
        material.add_input("pixel_ratio", 1.0);
        material.add_input("z_zoom_1", 1.0);
        material.add_input("time", 0.0);
        material.add_input_def::<Vector2<i32>>("mouse_position");
        material.add_input_def::<i32>("mouse_click_count");
        material.add_input("display_mode", 0);
        material.add_output("id", Vector4::<f32>::zero());
        material
    }

    fn default_geometry_material() -> Material {
        let mut material = SpriteSystem::default_geometry_material();
        material.set_before_main(shader::builder::glsl_prelude_and_codes());
        // The GLSL vertex shader implementing automatic shape padding for anti-aliasing. See the
        // docs of [`aa_side_padding`] to learn more about the concept of shape padding.
        //
        // First, we are computing the vertex position without shape padding. This is required to
        // make the function [`aa_side_padding`] work, as it uses [`zoom`], which uses the
        // [`input_local.z`] value. The depth of the vertex can be computed only after the
        // [`model_view_projection`] matrix is applied.
        //
        // Please note that this method is not guaranteed to always provide correct results. If
        // there is a big angle between the camera and the shape normal axes (e.g. when the shape is
        // significantly rotated around its Y-axis), the padding might be too small. To correct it,
        // we might take normal axes into account, but it will require more computations, and we do
        // not need it currently.
        //
        // Also, please note that we are first using the [`input_uv`] variable, and then we are
        // changing it. It's because the unchanged value is the incoming UV in range 0..1, and then
        // we are scaling it to a bigger range, so the padded area UV is not contained within 0..1.
        material.set_main(
            "
                mat4 model_view_projection = input_view_projection * input_transform;

                // Computing the vertex position without shape padding.
                vec3 input_local_no_padding = vec3((input_uv - input_alignment) * input_size, 0.0);
                vec4 position_no_padding = model_view_projection * vec4(input_local_no_padding, 1.0);
                input_local.z = position_no_padding.z;

                // We are now able to compute the padding and grow the canvas by its value.
                vec2 padding = vec2(aa_side_padding());
                if (input_display_mode == DISPLAY_MODE_DEBUG_SPRITE_OVERVIEW) {
                    padding = vec2(float(input_mouse_position.y) / 10.0);
                }

                vec2 padding2 = 2.0 * padding;
                vec2 padded_size = input_size + padding2;
                vec2 uv_scale = padded_size / input_size;
                vec2 uv_offset = padding / input_size;
                input_uv = vertex_uv * uv_scale - uv_offset;

                // We need to recompute the vertex position with the padding.
                input_local = vec3((input_uv - input_alignment) * input_size, 0.0);
                gl_Position = model_view_projection * vec4(input_local,1.0);
                input_local.z = gl_Position.z;
            ",
        );
        material
    }

    /// Replaces the shape definition.
    #[profile(Detail)]
    pub fn set_shape(&self, shape: def::AnyShape) {
        *self.shape.borrow_mut() = shape;
        self.reload_shape();
    }

    /// Generates the shape again. It is called on shape definition change, e.g. after theme update.
    fn reload_shape(&self) {
        if !self.do_not_use_shape_definition.get() {
            let code = shader::builder::Builder::run(&*self.shape.borrow(), *self.pointer_events);
            self.material.borrow_mut().set_code(code);
        }
        self.reload_material();
    }

    /// Define a new shader input.
    #[profile(Debug)]
    pub fn add_input<T: material::Input + Storable>(&self, name: &str, t: T) -> Buffer<T>
    where AnyBuffer: From<Buffer<T>> {
        self.material.borrow_mut().add_input(name, t);
        let buffer = self.sprite_system.symbol().surface().instance_scope().add_buffer(name);
        self.reload_material();
        buffer
    }

    /// Regenerate the shader with the current material.
    #[profile(Detail)]
    fn reload_material(&self) {
        self.sprite_system.set_material(&*self.material.borrow());
        self.sprite_system.set_geometry_material(&*self.geometry_material.borrow());
    }
}

impl display::Object for ShapeSystemModel {
    fn display_object(&self) -> &display::object::Instance {
        self.sprite_system.display_object()
    }
}



// ==================
// === ProxyParam ===
// ==================

/// A wrapper for a parameter, in most cases for [`Atribute`] or for [`Size`]. It allows swapping
/// the parameter in-place, for example after moving the shape to a new layer, which may require
/// re-binding it to a new shape system.
#[derive(Debug)]
#[allow(missing_docs)]
pub struct ProxyParam<T> {
    attribute: RefCell<T>,
}

impl<T> ProxyParam<T>
where
    T: CellProperty,
    T::Item: Copy + Debug,
{
    /// Constructor.
    pub fn new(attribute: T) -> Self {
        let attribute = RefCell::new(attribute);
        Self { attribute }
    }

    /// Set the parameter value.
    pub fn set(&self, value: T::Item) {
        self.attribute.borrow_mut().set(value)
    }

    /// Get the parameter value.
    pub fn get(&self) -> T::Item {
        self.attribute.borrow().get()
    }

    /// Modify the parameter value.
    pub fn modify(&self, f: impl FnOnce(T::Item) -> T::Item) {
        self.set(f(self.get()))
    }

    /// Swap in-place the parameter with another one.
    pub fn swap(&self, other: &Self) {
        other.set(self.get());
        self.attribute.swap(&other.attribute);
    }
}



// ==============
// === Macros ===
// ==============

/// Defines a new shape system. This is the macro that you want to use to define new shapes. The
/// shapes will be automatically managed in a highly efficient manner by the [`ShapeSystem`].
#[macro_export]
macro_rules! shape {
    (
        $(type SystemData = $system_data:ident;)?
        $(type ShapeData = $shape_data:ident;)?
        $(above = [$($always_above_1:tt $(::$always_above_2:tt)*),*];)?
        $(below = [$($always_below_1:tt $(::$always_below_2:tt)*),*];)?
        $(pointer_events = $pointer_events:tt;)?
        ($style:ident : Style $(,$gpu_param : ident : $gpu_param_type : ty)* $(,)?) {$($body:tt)*}
    ) => {
        $crate::_shape! {
            $(SystemData($system_data))?
            $(ShapeData($shape_data))?
            $(above = [$($always_above_1 $(::$always_above_2)*),*];)?
            $(below = [$($always_below_1 $(::$always_below_2)*),*];)?
            $(pointer_events = $pointer_events;)?
            [$style] ($($gpu_param : $gpu_param_type),*){$($body)*}
        }
    };
}

/// Internal helper for the [`shape`] macro.
#[macro_export]
macro_rules! _shape {
    (
        $(SystemData($system_data:ident))?
        $(ShapeData($shape_data:ident))?
        $(above = [$($always_above_1:tt $(::$always_above_2:tt)*),*];)?
        $(below = [$($always_below_1:tt $(::$always_below_2:tt)*),*];)?
        $(pointer_events = $pointer_events:tt;)?
        [$style:ident]
        ($($gpu_param : ident : $gpu_param_type : ty),* $(,)?)
        {$($body:tt)*}
    ) => {

        pub use shape_system_definition::Shape;
        pub use shape_system_definition::View;

        #[allow(unused_qualifications)]
        #[allow(unused_imports)]
        mod shape_system_definition {
            use super::*;
            use $crate::prelude::*;
            use $crate::display;
            use $crate::display::symbol::geometry::Sprite;
            use $crate::system::gpu;
            use $crate::system::gpu::data::Attribute;
            use $crate::display::shape::ShapeSystemId;
            use $crate::display::shape::ShapeOps;
            use $crate::display::shape::PixelDistance;
            use $crate::display::shape::system::ProxyParam;
            use $crate::system::gpu::data::InstanceIndex;
            use $crate::display::shape::ShapeWithSize;
            use $crate::display::shape::system::*;


            // =============
            // === Shape ===
            // =============

            /// The type of the shape. It also contains the parameters of the shape. The parameters
            /// are stored in this type in order to simplify bounds for utlities managing shape
            /// systems. For example, if we would like to handle any shape with given parameters,
            /// we will be processing [`ShapeSystem<S>`] and we can add bounds to [`S`] to reflect
            /// what parameters it should contain.
            #[allow(missing_docs)]
            #[derive(AsRef, Debug, Deref)]
            pub struct Shape {
                pub params: InstanceParams,
            }

            impl $crate::display::shape::system::Shape for Shape {
                type InstanceParams = InstanceParams;
                type GpuParams = GpuParams;
                type SystemData = ($($system_data)?);
                type ShapeData = ($($shape_data)?);
                fn pointer_events() -> bool {
                    let _out = true;
                    $(let _out = $pointer_events;)?
                    _out
                }

                fn always_above() -> Vec<ShapeSystemId> {
                    vec![$($( ShapeSystem::<$always_above_1 $(::$always_above_2)*::Shape>::id() ),*)?]
                }

                fn always_below() -> Vec<ShapeSystemId> {
                    vec![$($(
                        ShapeSystem::<$always_below_1 $(::$always_below_2)*::Shape> :: id()
                    ),*)?]
                }

                fn new_instance_params(
                    sprite: &Sprite,
                    gpu_params:&Self::GpuParams,
                    id: InstanceIndex
                ) -> ShapeWithSize<Shape> {
                    $(let $gpu_param = ProxyParam::new(gpu_params.$gpu_param.at(id));)*
                    let params = Self::InstanceParams { $($gpu_param),* };
                    let shape = Shape { params };
                    ShapeWithSize::new(shape)
                }

                fn new_gpu_params(
                    shape_system: &display::shape::ShapeSystemModel
                ) -> Self::GpuParams {
                    $(
                        let name = stringify!($gpu_param);
                        let val  = gpu::data::default::gpu_default::<$gpu_param_type>();
                        let $gpu_param = shape_system.add_input(name,val);
                    )*
                    Self::GpuParams {$($gpu_param),*}
                }

                fn shape_def(__style_watch__: &display::shape::StyleWatch)
                -> display::shape::primitive::def::AnyShape {
                    #[allow(unused_imports)]
                    use $crate::display::style::data::DataMatch;
                    use $crate::data::color;
                    use $crate::display::shape::*;

                    __style_watch__.reset();
                    let $style  = __style_watch__;
                    // Silencing warnings about not used style.
                    let _unused = &$style;
                    $(
                        let $gpu_param : display::shape::primitive::def::Var<$gpu_param_type> =
                            concat!("input_",stringify!($gpu_param)).into();
                        // Silencing warnings about not used shader input variables.
                        let _unused = &$gpu_param;
                    )*
                    $($body)*
                }
            }

            /// An initialized, GPU-bound shape definition. All changed parameters are immediately
            /// reflected in the [`Buffer`] and will be synchronised with GPU before next frame is
            /// drawn.
            #[derive(Debug)]
            #[allow(missing_docs)]
            pub struct InstanceParams {
                $(pub $gpu_param : ProxyParam<Attribute<$gpu_param_type>>),*
            }

            impl InstanceParamsTrait for InstanceParams {
                fn swap(&self, other: &Self) {
                    $(self.$gpu_param.swap(&other.$gpu_param);)*
                }
            }

            #[derive(Clone, CloneRef, Debug)]
            #[allow(missing_docs)]
            pub struct GpuParams {
                $(pub $gpu_param: gpu::data::Buffer<$gpu_param_type>),*
            }


            // ============
            // === View ===
            // ============

            /// A view of the defined shape. You can place the view in your objects and it will
            /// automatically initialize on-demand.
            pub type View = $crate::gui::component::ShapeView<Shape>;
        }
    };
}
