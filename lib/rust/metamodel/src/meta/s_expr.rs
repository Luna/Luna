//! Producing S-expression representations of data based on reflection information.
//!
//! The chosen output format is compact--more so than the pretty-printing supported by `lexpr`
//! (which is what is used by `serde_lexpr` to derive an S-expression "format" for data).
//!
//! - A struct is represented as a list of its fields.
//! - No type names are emitted. For variant types, the discriminant is included before the fields.
//! - Named fields are represented with the structure used for Lisp's `alist`s: `(name . value)`.
//! - Field names are prefixed with ':'.
//! - Sequence types like Rust's `Vec<_>` are represent with `lexpr` `Vector`s: `#(element element)`
//! - An option prints the same way as its contained value in the `Some` case, or as an empty list
//!   `()` in the `None` case.

use crate::meta::*;

use derivative::Derivative;
use lexpr::Value;



// =============================
// === Meta to S-expressions ===
// =============================

/// Render data to an S-expression representation based on its `meta` model.
#[derive(Derivative)]
#[derivative(Debug)]
pub struct ToSExpr<'g> {
    graph:   &'g TypeGraph,
    #[derivative(Debug = "ignore")]
    mappers: BTreeMap<TypeId, Box<dyn Fn(Value) -> Value>>,
}

impl<'g> ToSExpr<'g> {
    #[allow(missing_docs)]
    pub fn new(graph: &'g TypeGraph) -> Self {
        let mappers = Default::default();
        Self { graph, mappers }
    }

    /// Set a transformation to be applied to a type after translating to an S-expression.
    pub fn mapper(&mut self, id: TypeId, f: impl Fn(Value) -> Value + 'static) {
        self.mappers.insert(id, Box::new(f));
    }

    /// Given a bincode-serialized input, use its `meta` type info to transcribe it to an
    /// S-expression.
    pub fn value(&self, id: TypeId, data: &mut &[u8]) -> Value {
        match &self.graph[id].data {
            Data::Struct(_) => self.struct_(id, data),
            Data::Primitive(primitive) => self.primitive(*primitive, data),
        }
    }
}


// === Implementation ===

impl<'g> ToSExpr<'g> {
    fn struct_(&self, id: TypeId, data: &mut &[u8]) -> Value {
        let mut hierarchy = vec![];
        let mut child = None;
        let discriminants = &self.graph[id].discriminants;
        if !discriminants.is_empty() {
            let discriminant_index = read_u32(data);
            let child_ = discriminants[&(discriminant_index as usize)];
            hierarchy.push(child_);
            child = Some(child_);
        }
        hierarchy.push(id);
        let mut id_ = id;
        while let Some(parent) = self.graph[id_].parent {
            hierarchy.push(parent);
            id_ = parent;
        }
        let mut out = vec![];
        self.fields(&mut hierarchy, data, &mut out);
        assert_eq!(hierarchy, &[]);
        let mut value = Value::list(out);
        if let Some(id) = child {
            if let Some(mapper) = self.mappers.get(&id) {
                value = (mapper)(value);
                if !value.is_cons() {
                    value = Value::cons(value, Value::Null);
                }
            };
            let discriminant = self.graph[id].name.to_pascal_case().into_boxed_str();
            let discriminant = Value::Symbol(discriminant);
            value = Value::cons(discriminant, value);
        }
        if let Some(mapper) = self.mappers.get(&id) {
            value = (mapper)(value);
        }
        value
    }

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
            if !field.name.is_empty() {
                let car = Value::Symbol(format!(":{}", field.name).into_boxed_str());
                let cdr = self.value(field.type_, data);
                out.push(Value::cons(car, cdr));
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



// =============
// === Tests ===
// =============

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test() {
        #[derive(serde::Serialize)]
        struct A {
            value: u32,
        }
        let mut graph = TypeGraph::new();
        let int_name = TypeName::from_pascal_case("U32");
        let int = Type::new(int_name, Data::Primitive(Primitive::U32));
        let int = graph.types.insert(int);
        let a_name = TypeName::from_pascal_case("A");
        let a_field_name = FieldName::from_snake_case("value");
        let a_field = Field::named(a_field_name, int);
        let a = Type::new(a_name, Data::Struct(vec![a_field]));
        let a = graph.types.insert(a);
        let a_value = A { value: 36 };
        use bincode::Options;
        let bincoder = bincode::DefaultOptions::new().with_fixint_encoding();
        let a_value = bincoder.serialize(&a_value).unwrap();
        let mut a_value = &a_value[..];
        let s_expr = ToSExpr::new(&graph).value(a, &mut a_value);
        assert_eq!(s_expr, lexpr::sexp![(value.32)]);
    }
}
