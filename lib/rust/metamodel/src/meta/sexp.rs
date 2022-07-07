//! Producing S-expression representations of data based on reflection information.
//!
//! The chosen output format is compact--more so than the pretty-printing supported by `lexpr`
//! (which is what is used by `serde_lexpr` to derive an S-expression "format" for data).
//!
//! - A struct is represented as a list of its fields.
//! - No typenames are emitted. For variant types, the discriminant is included before the fields.
//! - Named fields are represented with the structure used for Lisp's `alist`s: `(name . value)`.
//! - Sequence types like Rust's `Vec<_>` are represent with `lexpr` `Vector`s: `#(element element)`
//! - An option prints the same way as its contained value in the `Some` case, or as an empty list
//!   `()` in the `None` case.

use crate::meta::*;

use derivative::Derivative;
use lexpr::Cons;
use lexpr::Value;



// ====================
// === Meta to Sexp ===
// ====================

/// Render data to an S-expression representation based on its `meta` model.
#[derive(Derivative)]
#[derivative(Debug)]
pub struct ToSexp<'g> {
    graph:   &'g TypeGraph,
    #[derivative(Debug = "ignore")]
    mappers: BTreeMap<TypeId, Box<dyn Fn(Value) -> Value>>,
}

impl<'g> ToSexp<'g> {
    #[allow(missing_docs)]
    pub fn new(graph: &'g TypeGraph) -> Self {
        let mappers = Default::default();
        Self { graph, mappers }
    }

    /// Set a transformation to be applied to a type after translating to an S-expression.
    pub fn mapper(&mut self, id: TypeId, f: impl Fn(Value) -> Value + 'static) {
        self.mappers.insert(id, Box::new(f));
    }

    /// Render a value to an S-expression.
    pub fn value(&self, id: TypeId, data: &mut &[u8]) -> Value {
        let ty = &self.graph[id];
        let value = match &ty.data {
            Data::Struct(_) => {
                let mut out = vec![];
                let mut hierarchy = vec![];
                if !ty.discriminants.is_empty() {
                    let discriminant = read_u32(data);
                    let child = ty.discriminants[&(discriminant as usize)];
                    let name = self.graph[child].name.to_pascal_case().into_boxed_str();
                    out.push(Value::Symbol(name));
                    hierarchy.push(child);
                }
                hierarchy.push(id);
                let mut id = id;
                while let Some(parent) = self.graph[id].parent {
                    hierarchy.push(parent);
                    id = parent;
                }
                self.fields(&mut hierarchy, data, &mut out);
                assert_eq!(hierarchy, &[]);
                Value::list(out)
            }
            Data::Primitive(primitive) => self.primitive(*primitive, data),
        };
        match self.mappers.get(&id) {
            Some(mapper) => (mapper)(value),
            None => value,
        }
    }
}


// === Implementation ===

impl<'g> ToSexp<'g> {
    fn fields(&self, hierarchy: &mut Vec<TypeId>, data: &mut &[u8], out: &mut Vec<Value>) {
        let id = match hierarchy.pop() {
            Some(id) => id,
            None => return,
        };
        let fields = match &self.graph[id].data {
            Data::Struct(fields) => fields,
            Data::Primitive(_) => panic!(),
        };
        if self.graph[id].child_field == Some(0) || fields.is_empty() {
            self.fields(hierarchy, data, out);
        }
        for (i, field) in fields.iter().enumerate() {
            if let Some(name) = field.name.to_camel_case() {
                let car = Value::Symbol(name.into_boxed_str());
                let cdr = self.value(field.type_, data);
                out.push(Value::Cons(Cons::new(car, cdr)));
            } else {
                out.push(self.value(field.type_, data));
            }
            if self.graph[id].child_field == Some(i + 1) {
                self.fields(hierarchy, data, out);
            }
        }
    }

    fn primitive(&self, primitive: Primitive, data: &mut &[u8]) -> Value {
        match primitive {
            Primitive::U32 => Value::Number(read_u32(data).into()),
            Primitive::U64 => Value::Number(read_u64(data).into()),
            Primitive::Bool => {
                let value = read_u8(data);
                let value = match value {
                    0 => false,
                    1 => true,
                    _ => panic!(),
                };
                Value::Bool(value)
            }
            Primitive::String => Value::String(read_string(data).into()),
            Primitive::Sequence(t0) => {
                let len = read_u64(data);
                Value::vector((0..len).map(|_| self.value(t0, data)))
            }
            Primitive::Option(t0) => match read_u8(data) {
                0 => Value::Null,
                1 => self.value(t0, data),
                _ => panic!(),
            },
            Primitive::Result(t0, t1) => {
                let mut values = vec![];
                match read_u32(data) {
                    0 => {
                        values.push(Value::Symbol("Ok".to_owned().into_boxed_str()));
                        values.push(self.value(t0, data));
                    }
                    1 => {
                        values.push(Value::Symbol("Err".to_owned().into_boxed_str()));
                        values.push(self.value(t1, data));
                    }
                    _ => panic!(),
                }
                Value::list(values)
            }
        }
    }
}


// === Primitive Deserializers ===

fn read_u8(buffer: &mut &[u8]) -> u8 {
    let (bytes, rest) = buffer.split_at(1);
    *buffer = rest;
    bytes[0]
}

fn read_u32(buffer: &mut &[u8]) -> u32 {
    let (bytes, rest) = buffer.split_at(4);
    *buffer = rest;
    let mut data = [0; 4];
    data.copy_from_slice(bytes);
    u32::from_le_bytes(data)
}

fn read_u64(buffer: &mut &[u8]) -> u64 {
    let (bytes, rest) = buffer.split_at(8);
    *buffer = rest;
    let mut data = [0; 8];
    data.copy_from_slice(bytes);
    u64::from_le_bytes(data)
}

fn read_string(buffer: &mut &[u8]) -> String {
    let len = read_u64(buffer);
    let (bytes, rest) = buffer.split_at(len as usize);
    *buffer = rest;
    String::from_utf8(bytes.to_owned()).unwrap()
}
