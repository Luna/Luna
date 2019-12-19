//! A lightweight GLSL implementation. Based on section the GLSL ES Spec docs:
//! https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf

use crate::prelude::*;

use crate::data::container::Add;
use code_builder::{CodeBuilder, HasCodeRepr};
use shapely::derive_clone_plus;


// =============================================================================
// === Expr ====================================================================
// =============================================================================

/// Any GLSL expression, like function call, or math operations.
#[derive(Shrinkwrap,Clone,Debug)]
pub struct Expr(Box<ExprUnboxed>);

impl Expr {
    pub fn new<T:Into<ExprUnboxed>>(t:T) -> Self {
        Self(Box::new(Into::<ExprUnboxed>::into(t)))
    }
}

impl HasCodeRepr for Expr {
    fn build(&self, builder:&mut CodeBuilder) {
        self.deref().build(builder)
    }
}

impl From<&String> for Expr {
    fn from(t: &String) -> Self {
        Expr::new(t)
    }
}

// === ExprUnboxed ===

macro_rules! mk_expr_unboxed { ($($variant:ident),*) => {
    #[derive(Clone,Debug)]
    pub enum ExprUnboxed {
        $($variant($variant)),*
    }

    $(impl From<$variant> for ExprUnboxed {
        fn from(t: $variant) -> Self {
            ExprUnboxed::$variant(t)
        }
    })*

    $(impl From<$variant> for Expr {
        fn from(t: $variant) -> Self {
            Expr::new(t)
        }
    })*

    impl HasCodeRepr for ExprUnboxed {
        fn build(&self, builder:&mut CodeBuilder) {
            match self {
                $(ExprUnboxed::$variant(t) => t.build(builder)),*
            }
        }
    }
};}

mk_expr_unboxed!(RawCode,Identifier,Block,Assignment);

impl From<&String> for ExprUnboxed {
    fn from(t: &String) -> Self {
        Self::Identifier(t.into())
    }
}


// ===============
// === RawCode ===
// ===============

/// Raw, unchecked GLSL code.
#[derive(Clone,Debug)]
pub struct RawCode {
    pub str: String
}

impl RawCode {
    pub fn new(str:String) -> Self {
        Self {str}
    }
}

impl HasCodeRepr for RawCode {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.write(&self.str)
    }
}


// ==================
// === Identifier ===
// ==================

/// Variable or type identifier.
#[derive(Clone,Debug,Eq,Hash,PartialEq)]
pub struct Identifier(pub String);

impl HasCodeRepr for Identifier {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add(&self.0);
    }
}

impl From<String> for Identifier {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&String> for Identifier {
    fn from(s: &String) -> Self {
        Self(s.clone())
    }
}

impl From<&str> for Identifier {
    fn from(s: &str) -> Self {
        Self(s.into())
    }
}


// =============
// === Block ===
// =============

/// Block of expressions. Used e.g. as function body.
#[derive(Clone,Debug,Default)]
pub struct Block {
    pub exprs: Vec<Expr>
}

impl<T:Into<Expr>> Add<T> for Block {
    type Result = ();
    fn add(&mut self, t:T) {
        self.exprs.push(t.into());
    }
}

impl HasCodeRepr for Block {
    fn build(&self, builder:&mut CodeBuilder) {
        for line in &self.exprs {
            builder.newline();
            builder.add(line);
        }
    }
}


// ==================
// === Assignment ===
// ==================

/// Assignment expressiong (`a = b`).
#[derive(Clone,Debug)]
pub struct Assignment {
    pub left  : Expr,
    pub right : Expr,
}

impl Assignment {
    pub fn new<L:Into<Expr>,R:Into<Expr>>(left:L, right:R) -> Self {
        Self {left:left.into(),right:right.into()}
    }
}

impl HasCodeRepr for Assignment {
    fn build(&self, builder:&mut CodeBuilder) {
        self.left.build(builder);
        builder.add("=");
        builder.add(&self.right);
        builder.terminator();
    }
}



// =============================================================================
// === Statement ===============================================================
// =============================================================================

/// Top-level statement, like function declaration.
#[derive(Clone,Debug)]
pub enum Statement {
    Function      (Function),
    PrecisionDecl (PrecisionDecl)
}

impl HasCodeRepr for Statement {
    fn build(&self, builder:&mut CodeBuilder) {
        match self {
            Self::Function       (t) => builder.add(t),
            Self::PrecisionDecl  (t) => builder.add(t),
        };
    }
}

impl From<PrecisionDecl> for Statement {
    fn from(t: PrecisionDecl) -> Self {
        Self::PrecisionDecl(t)
    }
}


// ================
// === Function ===
// ================

/// Top-level function declaration.
#[derive(Clone,Debug)]
pub struct Function {
    pub typ   : Type,
    pub ident : Identifier,
    pub body  : Block
}

impl HasCodeRepr for Function {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add(&self.typ).add(&self.ident).add("() {");
        builder.inc_indent();
        builder.add(&self.body);
        builder.dec_indent();
        builder.newline();
        builder.add("}");
    }
}

impl<T:Into<Expr>> Add<T> for Function {
    type Result = ();
    fn add(&mut self, t: T) {
        self.body.add(t)
    }
}


// =====================
// === PrecisionDecl ===
// =====================

/// Top-level type precision declaration.
#[derive(Clone,Debug)]
pub struct PrecisionDecl {
    pub prec : Precision,
    pub typ  : Type
}


trait AsOwned {
    type Owned;
    fn as_owned(t:Self) -> Self::Owned;
}

impl<T:Clone> AsOwned for &T {
    type Owned = T;
    fn as_owned(t:Self) -> Self::Owned {
        t.clone()
    }
}

impl PrecisionDecl {
    pub fn new<P:Into<Precision>,T:Into<Type>>(prec:P, typ:T) -> Self {
        Self {prec:prec.into(),typ:typ.into()}
    }
}

impl HasCodeRepr for PrecisionDecl {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add("precision");
        builder.add(&self.prec);
        builder.add(&self.typ);
        builder.terminator();
    }
}



// =============================================================================
// === AST Elements ============================================================
// =============================================================================


// ============
// === Type ===
// ============

/// Abstraction for any GLSL type, including array types.
#[derive(Clone,Debug)]
pub struct Type {
    pub prim  : PrimType,
    pub array : Option<usize>
}

impl From<PrimType> for Type {
    fn from(prim: PrimType) -> Self {
        let array = None;
        Self {prim,array}
    }
}

impl HasCodeRepr for Type {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add(&self.prim).add(&self.array);
    }
}

derive_clone_plus!(Type);


// ================
// === PrimType ===
// ================

/// Any non-array GLSL type.
#[derive(Clone,Debug,Eq,Hash,PartialEq)]
pub enum PrimType {
    Float, Int, Void, Bool,
    Mat2, Mat3, Mat4,
    Mat2x2, Mat2x3, Mat2x4,
    Mat3x2, Mat3x3, Mat3x4,
    Mat4x2, Mat4x3, Mat4x4,
    Vec2, Vec3, Vec4, IVec2, IVec3, IVec4, BVec2, BVec3, BVec4,
    UInt, UVec2, UVec3, UVec4,
    Sampler2D, Sampler3D, SamplerCube,
    Sampler2DShadow, SamplerCubeShadow,
    Sampler2DArray,
    Sampler2DArrayShadow,
    ISampler2D, ISampler3D, ISamplerCube,
    ISampler2DArray,
    USampler2D, USampler3D, USamplerCube,
    USampler2DArray,
    Struct(Identifier),
}

impl HasCodeRepr for PrimType {
    fn build(&self, builder:&mut CodeBuilder) {
        match self {
            Self::Float                => builder.add("float"),
            Self::Int                  => builder.add("int"),
            Self::Void                 => builder.add("void"),
            Self::Bool                 => builder.add("bool"),
            Self::Mat2                 => builder.add("mat2"),
            Self::Mat3                 => builder.add("mat3"),
            Self::Mat4                 => builder.add("mat4"),
            Self::Mat2x2               => builder.add("mat2x2"),
            Self::Mat2x3               => builder.add("mat2x3"),
            Self::Mat2x4               => builder.add("mat2x4"),
            Self::Mat3x2               => builder.add("mat3x2"),
            Self::Mat3x3               => builder.add("mat3x3"),
            Self::Mat3x4               => builder.add("mat3x4"),
            Self::Mat4x2               => builder.add("mat4x2"),
            Self::Mat4x3               => builder.add("mat4x3"),
            Self::Mat4x4               => builder.add("mat4x4"),
            Self::Vec2                 => builder.add("vec2"),
            Self::Vec3                 => builder.add("vec3"),
            Self::Vec4                 => builder.add("vec4"),
            Self::IVec2                => builder.add("ivec2"),
            Self::IVec3                => builder.add("ivec3"),
            Self::IVec4                => builder.add("ivec4"),
            Self::BVec2                => builder.add("bvec2"),
            Self::BVec3                => builder.add("bvec3"),
            Self::BVec4                => builder.add("bvec4"),
            Self::UInt                 => builder.add("int"),
            Self::UVec2                => builder.add("uvec2"),
            Self::UVec3                => builder.add("uvec3"),
            Self::UVec4                => builder.add("uvec4"),
            Self::Sampler2D            => builder.add("sampler2d"),
            Self::Sampler3D            => builder.add("sampler3d"),
            Self::SamplerCube          => builder.add("samplerCube"),
            Self::Sampler2DShadow      => builder.add("sampler2DShadow"),
            Self::SamplerCubeShadow    => builder.add("samplerCubeShadow"),
            Self::Sampler2DArray       => builder.add("sampler2DArray"),
            Self::Sampler2DArrayShadow => builder.add("sampler2DArrayShadow"),
            Self::ISampler2D           => builder.add("isampler2D"),
            Self::ISampler3D           => builder.add("isampler3D"),
            Self::ISamplerCube         => builder.add("isamplerCube"),
            Self::ISampler2DArray      => builder.add("isampler2DArray"),
            Self::USampler2D           => builder.add("usampler2D"),
            Self::USampler3D           => builder.add("usampler3D"),
            Self::USamplerCube         => builder.add("usamplerCube"),
            Self::USampler2DArray      => builder.add("usampler2DArray"),
            Self::Struct(ident)        => builder.add(ident),
        };
    }
}


// =================
// === GlobalVar ===
// =================

/// Global variable declaration, including attributes and uniforms.
#[derive(Clone,Debug)]
pub struct GlobalVar {
    pub layout  : Option<Layout>,
    pub storage : Option<GlobalVarStorage>,
    pub prec    : Option<Precision>,
    pub typ     : Type,
    pub ident   : Identifier,
}

/// Global variable layout definition.
#[derive(Clone,Debug,Default)]
pub struct Layout {
    pub location: usize,
}

/// Global variable storage definition.
#[derive(Clone,Debug)]
pub enum GlobalVarStorage {
    ConstStorage,
    InStorage(LinkageStorage),
    OutStorage(LinkageStorage),
    UniformStorage,
}

/// Storage definition for in- and out- attributes.
#[derive(Clone,Debug,Default)]
pub struct LinkageStorage {
    pub centroid      : bool,
    pub interpolation : Option<InterpolationStorage>,
}

/// Interpolation storage type for attributes.
#[derive(Clone,Debug)]
pub enum InterpolationStorage {Smooth, Flat}

// === Printers ===

impl HasCodeRepr for Layout {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add_spaced("layout(location=");
        builder.add(&self.location);
        builder.add_spaced(")");
    }
}

impl HasCodeRepr for InterpolationStorage {
    fn build(&self, builder:&mut CodeBuilder) {
        match self {
            Self::Smooth => builder.add("smooth"),
            Self::Flat   => builder.add("flat"),
        };
    }
}

impl HasCodeRepr for LinkageStorage {
    fn build(&self, builder:&mut CodeBuilder) {
        if self.centroid { builder.add("centroid"); };

    }
}

impl HasCodeRepr for GlobalVarStorage {
    fn build(&self, builder:&mut CodeBuilder) {
        match self {
            Self::ConstStorage        => builder.add("const"),
            Self::UniformStorage      => builder.add("uniform"),
            Self::InStorage    (qual) => builder.add("in").add(qual),
            Self::OutStorage   (qual) => builder.add("out").add(qual),
        };
    }
}

impl HasCodeRepr for GlobalVar {
    fn build(&self, builder:&mut CodeBuilder) {
        builder.add(&self.layout).add(&self.storage).add(&self.typ).add(&self.ident);
    }
}


// ================
// === LocalVar ===
// ================

/// Local variable definition.
#[derive(Clone,Debug)]
pub struct LocalVar {
    pub constant : bool,
    pub typ      : Type,
    pub ident    : Identifier,
}

impl HasCodeRepr for LocalVar {
    fn build(&self, builder:&mut CodeBuilder) {
        if self.constant {
            builder.add("const");
        }
        builder.add(&self.typ).add(&self.ident);
    }
}


// =================
// === Precision ===
// =================

/// Type precision definition.
#[derive(Clone,Debug)]
pub enum Precision { Low, Medium, High }

impl Display for Precision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let prec = match self {
            Self::Low    => "lowp",
            Self::Medium => "mediump",
            Self::High   => "highp"
        };
        write!(f,"{}",prec)
    }
}

impl HasCodeRepr for Precision {
    fn build(&self, builder:&mut CodeBuilder) {
        let str = match self {
            Self::Low    => "lowp",
            Self::Medium => "mediump",
            Self::High   => "highp"
        };
        builder.add(str);
    }
}

impl From<&Precision> for Precision {
    fn from(t: &Precision) -> Self {
        t.clone()
    }
}



// =============================================================================
// === Module ==================================================================
// =============================================================================

/// Translation unit definition. It represents the whole GLSL file.
#[derive(Clone,Debug)]
pub struct Module {
    pub global_vars : Vec<GlobalVar>,
    pub statements  : Vec<Statement>,
    pub main        : Function
}

impl Default for Module {
    fn default() -> Self {
        let global_vars = default ();
        let statements  = default();
        let main        = Function {
            typ   : PrimType::Void.into(),
            ident : "main".into(),
            body  : default()
        };
        Self {global_vars,statements,main}
    }
}

impl Add<GlobalVar> for Module {
    type Result = ();
    fn add(&mut self, t: GlobalVar) {
        self.global_vars.push(t);
    }
}

impl Add<Statement> for Module {
    type Result = ();
    fn add(&mut self, t: Statement) {
        self.statements.push(t);
    }
}

impl Add<PrecisionDecl> for Module {
    type Result = ();
    fn add(&mut self, t: PrecisionDecl) {
        self.statements.push(t.into());
    }
}

impl Add<Expr> for Module {
    type Result = ();
    fn add(&mut self, t: Expr) {
        self.main.add(t);
    }
}

impl HasCodeRepr for Module {
    fn build(&self, builder:&mut CodeBuilder) {
        for t in &self.global_vars {
            builder.add(t);
            builder.terminator();
            builder.newline();
        }
        for t in &self.statements {
            builder.add(t);
            builder.newline();
        }
        builder.add(&self.main);
    }
}