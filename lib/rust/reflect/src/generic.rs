pub mod graphviz;
pub mod serialization;
pub mod transform;

use std::collections::BTreeMap;
use std::collections::BTreeSet;



// ======================
// === Datatype Types ===
// ======================

/// A datatype.
#[derive(Debug, PartialEq, Eq, Hash)]
pub struct Type {
    // data
    pub name:            TypeName,
    pub data:            Data,
    pub parent:          Option<TypeId>,
    pub mixins:          Vec<TypeId>,
    pub weak_interfaces: Vec<TypeId>,
    pub abstract_:       bool,
    pub closed:          bool,
    // attributes
    /// When serializing/deserializing, indicates the index of the field in a `Type` before which a
    /// child object's data will be placed/expected.
    pub child_field:     Option<usize>,
    pub discriminants:   BTreeMap<usize, TypeId>,
}

impl Type {
    /// Create a new datatype, with defaults for most fields.
    pub fn new(name: TypeName, data: Data) -> Self {
        let parent = Default::default();
        let mixins = Default::default();
        let weak_interfaces = Default::default();
        let abstract_ = Default::default();
        let closed = Default::default();
        let child_field = Default::default();
        let discriminants = Default::default();
        Type {
            name,
            data,
            parent,
            mixins,
            weak_interfaces,
            abstract_,
            closed,
            child_field,
            discriminants,
        }
    }
}

#[derive(Debug, PartialEq, Eq, Hash)]
pub enum Data {
    Struct(Vec<Field>),
    Primitive(Primitive),
}

/// Standard types.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Copy)]
pub enum Primitive {
    Bool,
    Usize,
    U32,
    String,
    Sequence(TypeId),
    // Rust's option-types are more general than Java's optional (by default) fields.
    Option(TypeId),
    Result(TypeId, TypeId),
}

#[derive(Debug, PartialEq, Eq, Hash)]
pub struct Field {
    pub name:  FieldName,
    pub type_: TypeId,
    pub hide:  bool,
    id:        FieldId,
}

impl Field {
    pub fn id(&self) -> FieldId {
        self.id
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TypeId(pub usize);

impl std::fmt::Display for TypeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FieldId(u32);

impl std::fmt::Display for FieldId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}



// ===================
// === Identifiers ===
// ===================

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Identifier {
    segments: Vec<String>,
}

impl Identifier {
    fn new(segments: Vec<String>) -> Self {
        for segment in &segments {
            assert!(!segment.is_empty());
        }
        Self { segments }
    }

    fn segments_len(&self) -> usize {
        let mut n = 0;
        for segment in &self.segments {
            n += segment.len();
        }
        n
    }

    pub fn to_pascal_case(&self) -> String {
        let mut pascal = String::with_capacity(self.segments_len() + self.segments.len());
        for segment in &self.segments {
            let mut chars = segment.chars();
            pascal.push(chars.next().unwrap().to_ascii_uppercase());
            pascal.extend(chars);
        }
        pascal
    }

    pub fn to_camel_case(&self) -> String {
        let mut camel = String::with_capacity(self.segments_len());
        let (head, tail) = self.segments.split_first().unwrap();
        camel.push_str(head);
        for segment in tail {
            let mut chars = segment.chars();
            camel.push(chars.next().unwrap().to_ascii_uppercase());
            camel.extend(chars);
        }
        camel
    }

    pub fn to_snake_case(&self) -> String {
        self.segments.join("_")
    }

    pub fn from_snake_case(s: &str) -> Self {
        let segments = s.split("_").map(|s| s.to_string()).collect();
        Self::new(segments)
    }

    pub fn from_pascal_case(s: &str) -> Self {
        let mut segments = vec![];
        let mut current = String::new();
        for c in s.chars() {
            if c.is_ascii_uppercase() && !current.is_empty() {
                segments.push(std::mem::take(&mut current));
            }
            current.push(c.to_ascii_lowercase());
        }
        segments.push(current);
        Self::new(segments)
    }

    pub fn append(&mut self, other: Self) {
        self.segments.extend(other.segments)
    }
}


// === Type Names ===

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TypeName(Identifier);

impl std::fmt::Display for TypeName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0.to_pascal_case())
    }
}

impl TypeName {
    pub fn from_pascal_case(s: &str) -> Self {
        Self(Identifier::from_pascal_case(s))
    }
    pub fn to_pascal_case(&self) -> String {
        self.0.to_pascal_case()
    }
    pub fn append(&mut self, other: Self) {
        self.0.append(other.0)
    }
}


// === Field Names ===

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct FieldName(Identifier);

impl std::fmt::Display for FieldName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0.to_camel_case())
    }
}

impl FieldName {
    pub fn from_snake_case(s: &str) -> Self {
        Self(Identifier::from_snake_case(s))
    }
    pub fn to_camel_case(&self) -> Option<String> {
        match self.0.to_camel_case() {
            ident if ident.is_empty() => None,
            ident => Some(ident),
        }
    }
    pub fn append(&mut self, other: Self) {
        self.0.append(other.0)
    }
}



// ===========================
// === System of Datatypes ===
// ===========================

#[derive(Debug, Default)]
pub struct TypeGraph {
    pub types:  Vec<Option<Type>>,
    next_field: std::cell::Cell<u32>,
}

impl TypeGraph {
    pub fn reserve_type_id(&mut self) -> TypeId {
        let id = TypeId(self.types.len());
        self.types.push(None);
        id
    }

    pub fn set(&mut self, id: TypeId, value: Type) {
        assert_eq!(&self.types[id.0], &None);
        self.types[id.0] = Some(value);
    }

    pub fn replace(&mut self, id: TypeId, value: Type) -> Type {
        std::mem::replace(&mut self.types[id.0], Some(value)).unwrap()
    }

    pub fn take(&mut self, id: TypeId) -> Type {
        std::mem::take(&mut self.types[id.0]).unwrap()
    }

    pub fn insert(&mut self, value: Type) -> TypeId {
        let id = TypeId(self.types.len());
        self.types.push(Some(value));
        id
    }

    pub fn type_ids(&self) -> impl Iterator<Item = TypeId> + '_ {
        self.types.iter().enumerate().filter_map(|(i, ty)| ty.as_ref().map(|_| TypeId(i)))
    }

    pub fn field(&self, type_: TypeId) -> Field {
        let hide = false;
        let id = self.next_field.get();
        self.next_field.set(id + 1);
        let id = FieldId(id);
        let name = FieldName::default();
        Field { name, type_, hide, id }
    }

    /// Replace all occurrences of certain IDs with other IDs.
    pub fn apply_aliases<'a>(&mut self, aliases: impl IntoIterator<Item = &'a (TypeId, TypeId)>) {
        let mut canonical = BTreeMap::new();
        for (from_, to_) in aliases.into_iter() {
            canonical.insert(*from_, *to_);
        }
        let rewrite = |id: &mut TypeId| {
            if let Some(id_) = canonical.get(id) {
                *id = *id_;
            }
        };
        for ty in self.types.iter_mut() {
            let ty = match ty {
                Some(ty) => ty,
                None => continue,
            };
            if let Some(parent) = &mut ty.parent {
                rewrite(parent);
            }
            for parent in &mut ty.mixins {
                rewrite(parent);
            }
            for parent in &mut ty.weak_interfaces {
                rewrite(parent);
            }
            match &mut ty.data {
                Data::Struct(fields) =>
                    for field in fields {
                        rewrite(&mut field.type_);
                    },
                Data::Primitive(Primitive::Sequence(t0))
                | Data::Primitive(Primitive::Option(t0)) => rewrite(t0),
                Data::Primitive(Primitive::Result(t0, t1)) => {
                    rewrite(t0);
                    rewrite(t1);
                }
                Data::Primitive(Primitive::U32)
                | Data::Primitive(Primitive::Bool)
                | Data::Primitive(Primitive::Usize)
                | Data::Primitive(Primitive::String) => {}
            }
        }
    }

    /// Eliminate types that are not in the referential transitive closure of the given collection
    /// of roots.
    pub fn gc(&mut self, roots: impl IntoIterator<Item = TypeId>) {
        let mut visited = BTreeSet::new();
        let mut to_visit = BTreeSet::new();
        to_visit.extend(roots);
        while let Some(id) = to_visit.pop_last() {
            let ty = match &self.types[id.0] {
                Some(ty) => ty,
                None => continue,
            };
            let Type {
                name: _,
                data,
                parent,
                mixins,
                weak_interfaces: _,
                abstract_: _,
                closed: _,
                child_field: _,
                discriminants,
            } = ty;
            let already_visited = !visited.insert(id);
            if already_visited {
                continue;
            }
            if let Some(parent) = parent {
                to_visit.insert(*parent);
            }
            to_visit.extend(mixins);
            to_visit.extend(discriminants.values());
            match data {
                Data::Struct(fields) => to_visit.extend(fields.iter().map(|field| field.type_)),
                Data::Primitive(Primitive::Sequence(t0))
                | Data::Primitive(Primitive::Option(t0)) => {
                    to_visit.insert(*t0);
                }
                Data::Primitive(Primitive::Result(t0, t1)) => {
                    to_visit.insert(*t0);
                    to_visit.insert(*t1);
                }
                Data::Primitive(Primitive::U32)
                | Data::Primitive(Primitive::Bool)
                | Data::Primitive(Primitive::Usize)
                | Data::Primitive(Primitive::String) => {}
            }
        }
        let live = |id: &TypeId| visited.contains(id);
        for (i, ty) in self.types.iter_mut().enumerate() {
            let id = TypeId(i);
            if live(&id) {
                ty.as_mut().unwrap().weak_interfaces.retain(live);
            } else {
                *ty = None;
            }
        }
    }
}

impl std::ops::Index<TypeId> for TypeGraph {
    type Output = Type;
    fn index(&self, index: TypeId) -> &Self::Output {
        self.types[index.0].as_ref().unwrap()
    }
}

impl std::ops::IndexMut<TypeId> for TypeGraph {
    fn index_mut(&mut self, index: TypeId) -> &mut Self::Output {
        self.types[index.0].as_mut().unwrap()
    }
}
