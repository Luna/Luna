pub mod item;
pub mod data;

use crate::prelude::*;

use crate::backend::webgl::Context;
use crate::closure;
use crate::data::function::callback::*;
use crate::dirty;
use crate::dirty::traits::*;
use crate::system::web::fmt;
use crate::system::web::group;
use crate::system::web::Logger;
use crate::tp::debug::TypeDebugName;
use item::Item;
use item::Prim;
use nalgebra::Vector2;
use nalgebra::Vector3;
use nalgebra::Vector4;
use nalgebra::Matrix4;
use std::iter::Extend;
use web_sys::WebGlBuffer;


// ==============
// === Buffer ===
// ==============

// === Definition ===

/// Please refer to the 'Buffer management pipeline' doc to learn more about
/// attributes, scopes, geometries, meshes, scenes, and other relevant concepts.
///
/// Buffers are values stored in geometry. Under the hood they are stored in
/// vectors and are synchronised with GPU buffers on demand.
#[derive(Derivative,Shrinkwrap)]
#[shrinkwrap(mutable)]
#[derivative(Debug(bound="T:Debug"))]
pub struct Buffer<T,OnSet,OnResize> {
    #[shrinkwrap(main_field)]
    pub buffer       : Data        <T,OnSet,OnResize>,
    pub set_dirty    : SetDirty    <OnSet>,
    pub resize_dirty : ResizeDirty <OnResize>,
    pub logger       : Logger,
    pub gl_buffer    : WebGlBuffer,
    context          : Context
}

// === Types ===

pub type Data <T,S,R> = data::Data <T,DataOnSet<S>,DataOnResize<R>>;

#[macro_export]
macro_rules! promote_buffer_types { ($callbacks:tt $module:ident) => {
    promote! { $callbacks $module [Var<T>,Buffer<T>,SharedBuffer<T>,AnyBuffer] }
};}

// === Callbacks ===

pub type SetDirty    <Callback> = dirty::SharedRange<usize,Callback>;
pub type ResizeDirty <Callback> = dirty::SharedBool<Callback>;

closure! {
fn buffer_on_resize<C:Callback0> (dirty:ResizeDirty<C>) -> DataOnResize {
    || dirty.set()
}}

closure! {
fn buffer_on_set<C:Callback0> (dirty:SetDirty<C>) -> DataOnSet {
    |ix: usize| dirty.set(ix)
}}

// === Instances ===

impl<T,OnSet:Callback0, OnResize:Callback0>
Buffer<T,OnSet,OnResize> {
    /// Creates new buffer from provided explicit buffer object.
    pub fn new_from
    ( context   : &Context
    , vec       : Vec<T>
    , logger    : Logger
    , on_set    : OnSet
    , on_resize : OnResize
    ) -> Self {
        logger.info(fmt!("Creating new {} buffer.", T::type_debug_name()));
        let set_logger     = logger.sub("set_dirty");
        let resize_logger  = logger.sub("resize_dirty");
        let set_dirty      = SetDirty::new(set_logger,on_set);
        let resize_dirty   = ResizeDirty::new(resize_logger,on_resize);
        let buff_on_resize = buffer_on_resize(resize_dirty.clone_rc());
        let buff_on_set    = buffer_on_set(set_dirty.clone_rc());
        let buffer         = Data::new_from(vec, buff_on_set, buff_on_resize);
        let context        = context.clone();
        let gl_buffer      = create_gl_buffer(&context);
        Self {buffer,set_dirty,resize_dirty,logger,gl_buffer,context}
    }
    /// Creates a new empty buffer.
    pub fn new
    (context:&Context, logger:Logger, on_set:OnSet, on_resize:OnResize)
     -> Self {
        Self::new_from(context,default(),logger,on_set,on_resize)
    }
    /// Build the buffer from the provider configuration builder.
    pub fn build
    (context:&Context, builder:Builder<T>, on_set:OnSet, on_resize:OnResize)
     -> Self {
        let buffer = builder._buffer.unwrap_or_else(default);
        let logger = builder._logger.unwrap_or_else(default);
        Self::new_from(context,buffer,logger,on_set,on_resize)
    }
}

impl<T:Item,OnSet,OnResize>
Buffer<T,OnSet,OnResize> where Prim<T>:Debug { // TODO remove Prim<T>:Debug
pub fn as_prim(&self) -> &[Prim<T>] {
    <T as Item>::to_prim_buffer(&self.buffer.data)
}
    /// Check dirty flags and update the state accordingly.
    pub fn update(&mut self) {
        group!(self.logger, "Updating.", {
            self.set_dirty.unset_all();
            self.resize_dirty.unset_all();
            let data = self.as_prim();
            self.context.bind_buffer(Context::ARRAY_BUFFER, Some(&self.gl_buffer));
            Self::buffer_data(&self.context,data);
            // TODO finish
        })
    }

    fn buffer_data(context:&Context, data:&[T::Prim]) {
        // Note that `js_buffer_view` is somewhat dangerous (hence the
        // `unsafe`!). This is creating a raw view into our module's
        // `WebAssembly.Memory` buffer, but if we allocate more pages for
        // ourself (aka do a memory allocation in Rust) it'll cause the buffer
        // to change, causing the resulting js array to be invalid.
        //
        // As a result, after `js_buffer_view` we have to be very careful not to
        // do any memory allocations before it's dropped.
        unsafe {
            let js_array = <T as Item>::js_buffer_view(&data);
            context.buffer_data_with_array_buffer_view
            (Context::ARRAY_BUFFER, &js_array, Context::STATIC_DRAW);
        }
    }
    /// Binds the buffer currently bound to gl.ARRAY_BUFFER to a generic vertex attribute of the
    /// current vertex buffer object and specifies its layout. Please note that this function is
    /// more complex that a raw call to `WebGLRenderingContext.vertexAttribPointer`, as it correctly
    /// handles complex data types like `mat4`. See the following links to learn more:
    /// https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
    /// https://stackoverflow.com/questions/38853096/webgl-how-to-bind-values-to-a-mat4-attribute
    pub fn vertex_attrib_pointer(&self, loc:u32) {
        let item_size = <T as Item>::gl_item_byte_size() as i32;
        let item_type = <T as Item>::gl_item_type();
        let rows      = <T as Item>::rows() as i32;
        let cols      = <T as Item>::cols() as i32;
        let col_size  = item_size * rows;
        let stride    = col_size  * cols;
        let normalize = false;
        for col in 0..cols {
            let lloc = loc + col as u32;
            let off  = col * col_size;
            self.context.enable_vertex_attrib_array(lloc);
            self.context.vertex_attrib_pointer_with_i32(lloc,rows,item_type,normalize,stride,off);
        }
    }
}

impl<T,OnSet,OnResize>
Buffer<T,OnSet,OnResize> {
    /// Returns a new buffer `Builder` object.
    pub fn builder() -> Builder<T> {
        default()
    }

    /// Returns the number of elements in the buffer.
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    /// Checks if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    /// Binds the underlying WebGLBuffer to a given target.
    /// https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindBuffer
    pub fn bind(&self, target:u32) {
        self.context.bind_buffer(target, Some(&self.gl_buffer));
    }
}

pub trait AddElementCtx<T,OnResize> = where
    T: Item + Clone,
    OnResize: Callback0;

impl<T,OnSet,OnResize>
Buffer<T,OnSet,OnResize> where Self: AddElementCtx<T,OnResize> {
    /// Adds a single new element initialized to default value.
    pub fn add_element(&mut self) {
        self.add_elements(1);
    }

    /// Adds multiple new elements initialized to default values.
    pub fn add_elements(&mut self, elem_count: usize) {
        self.extend(iter::repeat(T::empty()).take(elem_count));
    }
}

impl<T,OnSet,OnResize>
Index<usize> for Buffer<T,OnSet,OnResize> {
    type Output = T;
    fn index(&self, index: usize) -> &Self::Output {
        self.buffer.index(index)
    }
}

impl<T,OnSet:Callback0,OnResize>
IndexMut<usize> for Buffer<T,OnSet,OnResize> {
    fn index_mut(&mut self, index: usize) -> &mut Self::Output {
        self.buffer.index_mut(index)
    }
}

// === Utils ===

fn create_gl_buffer(context:&Context) -> WebGlBuffer {
    let buffer = context.create_buffer();
    buffer.ok_or("failed to create buffer").unwrap()
}


// ====================
// === SharedBuffer ===
// ====================

/// Shared view for `Buffer`.
#[derive(Derivative,Shrinkwrap)]
#[derivative(Debug(bound="T:Debug"))]
#[derivative(Clone(bound=""))]
pub struct SharedBuffer<T,OnSet,OnResize> {
    rc: Rc<RefCell<Buffer<T,OnSet,OnResize>>>
}

impl<T, OnSet:Callback0, OnResize:Callback0>
SharedBuffer<T,OnSet,OnResize> {
    /// Creates a new empty buffer.
    pub fn new
    (context:&Context, logger:Logger, on_set:OnSet, on_resize:OnResize)
     -> Self {
        let data = Buffer::new(context,logger,on_set,on_resize);
        let rc   = Rc::new(RefCell::new(data));
        Self {rc}
    }

    /// Build the buffer from the provider configuration builder.
    pub fn build
    (context:&Context, builder:Builder<T>, on_set:OnSet, on_resize:OnResize)
     -> Self {
        let data = Buffer::build(context,builder,on_set,on_resize);
        let rc   = Rc::new(RefCell::new(data));
        Self {rc}
    }
}

impl<T:Item,OnSet,OnResize>
SharedBuffer<T,OnSet,OnResize> where Prim<T>: Debug { // TODO: remove Prim<T>: Debug
/// Check dirty flags and update the state accordingly.
pub fn update(&self) {
    self.borrow_mut().update()
}

    /// binds the buffer currently bound to gl.ARRAY_BUFFER to a generic vertex
    /// attribute of the current vertex buffer object and specifies its layout.
    /// https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
    pub fn vertex_attrib_pointer(&self, index: u32) {
        self.borrow().vertex_attrib_pointer(index)
    }
}

impl<T,OnSet,OnResize>
SharedBuffer<T,OnSet,OnResize> {
    /// Get the variable by given index.
    pub fn get(&self, index:usize) -> Var<T,OnSet,OnResize> {
        Var::new(index,self.clone_rc())
    }

    /// Returns the number of elements in the buffer.
    pub fn len(&self) -> usize {
        self.borrow().len()
    }

    /// Checks if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.borrow().is_empty()
    }

    /// Binds the underlying WebGLBuffer to a given target.
    /// https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindBuffer
    pub fn bind(&self, target:u32) {
        self.borrow().bind(target)
    }
}

impl<T,OnSet,OnResize>
SharedBuffer<T,OnSet,OnResize> where (): AddElementCtx<T,OnResize> {
    /// Adds a single new element initialized to default value.
    pub fn add_element(&self){
        self.borrow_mut().add_element()
    }
}

impl <T,OnSet,OnResize>
From<Rc<RefCell<Buffer<T,OnSet,OnResize>>>> for SharedBuffer<T,OnSet,OnResize> {
    fn from(rc: Rc<RefCell<Buffer<T, OnSet, OnResize>>>) -> Self {
        Self {rc}
    }
}


// ===========
// === Var ===
// ===========

/// View for a particular buffer. Allows reading and writing buffer data
/// via the internal mutability pattern. It is implemented as a view on
/// a selected `SharedBuffer` element under the hood.
#[derive(Clone,Derivative)]
#[derivative(Debug(bound="T:Debug"))]
pub struct Var<T,OnSet,OnResize> {
    index  : usize,
    buffer : SharedBuffer<T,OnSet,OnResize>
}

impl<T,OnSet,OnResize>
Var<T,OnSet,OnResize> {
    /// Creates a new variable as an indexed view over provided buffer.
    pub fn new(index:usize, buffer: SharedBuffer<T,OnSet,OnResize>) -> Self {
        Self {index, buffer}
    }

    /// Gets immutable reference to the underlying data.
    // [1] Please refer to `Prelude::drop_lifetime` docs to learn why it is safe
    // to use it here.
    pub fn get(&self) -> IndexGuard<Buffer<T,OnSet,OnResize>> {
        let _borrow = self.buffer.borrow();
        let target  = _borrow.index(self.index);
        let target  = unsafe { drop_lifetime(target) }; // [1]
        IndexGuard {target,_borrow}
    }
}

impl<T,OnSet:Callback0,OnResize>
Var<T,OnSet,OnResize> {
    /// Gets mutable reference to the underlying data.
    // [1] Please refer to `Prelude::drop_lifetime` docs to learn why it is safe
    // to use it here.
    pub fn get_mut(&self) -> IndexGuardMut<Buffer<T,OnSet,OnResize>> {
        let mut _borrow = self.buffer.borrow_mut();
        let target      = _borrow.index_mut(self.index);
        let target      = unsafe { drop_lifetime_mut(target) }; // [1]
        IndexGuardMut {target,_borrow}
    }

    /// Sets the variable to a new value.
    pub fn set(&self, val:T) {
        **self.get_mut() = val;
    }

    /// Modifies the underlying data by using the provided function.
    pub fn modify<F: FnOnce(&mut T)>(&self, f:F) {
        f(&mut self.buffer.borrow_mut()[self.index]);
    }
}

#[derive(Shrinkwrap)]
pub struct IndexGuard<'t,T> where T:Index<usize> {
    #[shrinkwrap(main_field)]
    pub target : &'t <T as Index<usize>>::Output,
    _borrow    : Ref<'t,T>
}

#[derive(Shrinkwrap)]
#[shrinkwrap(mutable)]
pub struct IndexGuardMut<'t,T> where T:Index<usize> {
    #[shrinkwrap(main_field)]
    pub target : &'t mut <T as Index<usize>>::Output,
    _borrow    : RefMut<'t,T>
}


// ===============
// === Builder ===
// ===============

/// Buffer builder.
#[derive(Derivative)]
#[derivative(Default(bound=""))]
pub struct Builder<T> {
    pub _buffer : Option <Vec<T>>,
    pub _logger : Option <Logger>
}

impl<T> Builder<T> {
    /// Creates a new builder object.
    pub fn new() -> Self {
        default()
    }

    /// Sets the underlying buffer data.
    pub fn buffer(self, val: Vec <T>) -> Self {
        Self { _buffer: Some(val), _logger: self._logger }
    }

    /// Sets the logger.
    pub fn logger(self, val: Logger) -> Self {
        Self { _buffer: self._buffer, _logger: Some(val) }
    }
}

// ========================
// === TO BE REFACTORED ===
// ========================

// TODO The following code should be refactored to use the new macro `eval-tt`
// TODO engine. Some utils, like `cartesian` macro should also be refactored
// TODO out.

macro_rules! cartesian_impl {
    ($out:tt [] $b:tt $init_b:tt, $f:ident) => {
        $f!{ $out }
    };
    ($out:tt [$a:ident, $($at:tt)*] [] $init_b:tt, $f:ident) => {
        cartesian_impl!{ $out [$($at)*] $init_b $init_b, $f }
    };
    ([$($out:tt)*] [$a:ident, $($at:tt)*] [$b:ident, $($bt:tt)*] $init_b:tt
    ,$f:ident) => {
        cartesian_impl!{
            [$($out)* ($a, $b),] [$a, $($at)*] [$($bt)*] $init_b, $f
        }
    };
}

macro_rules! cartesian {
    ([$($a:tt)*], [$($b:tt)*], $f:ident) => {
        cartesian_impl!{ [] [$($a)*,] [$($b)*,] [$($b)*,], $f }
    };
}

// =================
// === AnyBuffer ===
// =================

use enum_dispatch::*;

// === Macros ===

#[derive(Debug)]
pub struct BadVariant;

macro_rules! mk_any_buffer_impl {
([$(($base:ident, $param:ident)),*,]) => { paste::item! {

    /// An enum with a variant per possible buffer type (i32, f32, Vector<f32>,
    /// and many, many more). It provides a faster alternative to dyn trait one:
    /// `Buffer<dyn Item, OnSet, OnResize>`.
    #[enum_dispatch(IsBuffer)]
    #[derive(Derivative)]
    #[derivative(Debug(bound=""))]
    pub enum AnyBuffer<OnSet, OnResize> {
        $(  [<Variant $base For $param>]
                (SharedBuffer<$base<$param>, OnSet, OnResize>),
        )*
    }

    $( // ======================================================================

    impl<'t, T, S>
    TryFrom<&'t AnyBuffer<T, S>>
    for &'t SharedBuffer<$base<$param>, T, S> {
        type Error = BadVariant;
        fn try_from(v: &'t AnyBuffer<T, S>)
        -> Result <&'t SharedBuffer<$base<$param>, T, S>, Self::Error> {
            match v {
                AnyBuffer::[<Variant $base For $param>](a) => Ok(a),
                _ => Err(BadVariant)
            }
        }
    }

    impl<'t, T, S>
    TryFrom<&'t mut AnyBuffer<T, S>>
    for &'t mut SharedBuffer<$base<$param>, T, S> {
        type Error = BadVariant;
        fn try_from(v: &'t mut AnyBuffer<T, S>)
        -> Result <&'t mut SharedBuffer<$base<$param>, T, S>, Self::Error> {
            match v {
                AnyBuffer::[<Variant $base For $param>](a) => Ok(a),
                _ => Err(BadVariant)
            }
        }
    }

    )* // ======================================================================
}
}}

macro_rules! mk_any_buffer {
    ($bases:tt, $params:tt) => {
        cartesian!($bases, $params, mk_any_buffer_impl);
    }
}

// === Definition ===

type Identity<T> = T;
mk_any_buffer!([Identity,Vector2,Vector3,Vector4,Matrix4], [f32]);

/// Collection of all methods common to every buffer variant.
#[enum_dispatch]
pub trait IsBuffer<OnSet: Callback0, OnResize: Callback0> {
    fn add_element(&self);
    fn len(&self) -> usize;
    fn is_empty(&self) -> bool;
    fn update(&self);
    fn bind(&self, target:u32);
    fn vertex_attrib_pointer(&self, index: u32);
}