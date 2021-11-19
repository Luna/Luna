//! Definition of strongly typed units, like `Line`, `Column`, or `Location`. Used to express type
//! level dependencies in the whole library.

use crate::prelude::*;

use enso_types::newtype;
use enso_types::unit;



// ===============
// === Exports ===
// ===============

/// Common traits.
pub mod traits {
    pub use super::bytes::Into as TRAIT_bytes_into;
    pub use super::codepoints::Into as TRAIT_codepoints_into;
    pub use super::column::Into as TRAIT_column_into;
    pub use super::line::Into as TRAIT_line_into;
}
pub use traits::*;



// =============
// === Bytes ===
// =============

unit! {
/// An offset in the buffer in bytes.
Bytes::bytes(i32)
}

impl Bytes {
    /// Saturating conversion to `usize`.
    pub fn as_usize(self) -> usize {
        self.value.max(0) as usize
    }
}

impl<T: Into<Bytes>> bytes::Into for Range<T> {
    type Output = Range<Bytes>;
    fn bytes(self) -> Self::Output {
        let start = self.start.into();
        let end = self.end.into();
        Range { start, end }
    }
}

impl From<usize> for Bytes {
    fn from(t: usize) -> Self {
        (t as i32).into()
    }
}

impl From<&usize> for Bytes {
    fn from(t: &usize) -> Self {
        (*t as i32).into()
    }
}



// ==================
// === Codepoints ===
// ==================

unit! {
/// An offset in the buffer in bytes.
Codepoints::codepoints(i32)
}

impl Codepoints {
    /// Saturating conversion to `usize`.
    pub fn as_usize(self) -> usize {
        self.value.max(0) as usize
    }
}

impl<T: Into<Codepoints>> codepoints::Into for Range<T> {
    type Output = Range<Codepoints>;
    fn codepoints(self) -> Self::Output {
        let start = self.start.into();
        let end = self.end.into();
        Range { start, end }
    }
}

impl From<usize> for Codepoints {
    fn from(t: usize) -> Self {
        (t as i32).into()
    }
}

impl From<&usize> for Codepoints {
    fn from(t: &usize) -> Self {
        (*t as i32).into()
    }
}

impl serde::Serialize for Codepoints {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        i32::from(self).serialize(serializer)
    }
}

impl<'de> serde::Deserialize<'de> for Codepoints {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where D: serde::Deserializer<'de> {
        i32::deserialize(deserializer).map(|val| val.into())
    }
}


// ============
// === Line ===
// ============

// TODO: Improvement idea. Create `i32Saturated` type which will have all operations saturated.
//       This will make this unit safer.
unit! {
/// A type representing vertical measurements.
Line::line(i32)
}

impl Line {
    /// Saturating conversion to `usize`.
    pub fn as_usize(self) -> usize {
        self.value.max(0) as usize
    }

    /// Compute the absolute value of this line.
    pub fn abs(self) -> Self {
        self.value.saturating_abs().into()
    }
}

impl From<usize> for Line {
    fn from(t: usize) -> Self {
        (t as i32).into()
    }
}

impl From<&usize> for Line {
    fn from(t: &usize) -> Self {
        (*t as i32).into()
    }
}



// ==============
// === Column ===
// ==============

// TODO: Improvement idea. Create `i32Saturated` type which will have all operations saturated.
//       This will make this unit safer.
unit! {
/// A type representing horizontal measurements expressed as number of unicode codepoints.
///
/// Note: Currently our text rendering engine display each codepoint as a separate glyph, so it does
/// not support the grapheme clusters (as described in https://stackoverflow.com/a/27331885).
/// If it does, the column should be measured in grapheme clusters, to have Text Area cursors behave
/// correctly (and the usages shall be then fixed, as in
/// [`crate::text::Text::column_of_byte_offset`]
Column::column(i32)
}

impl Column {
    /// Saturating conversion to `usize`.
    pub fn as_usize(self) -> usize {
        self.value.max(0) as usize
    }

    /// Compute the absolute value of this column.
    pub fn abs(self) -> Self {
        self.value.saturating_abs().into()
    }
}

impl From<usize> for Column {
    fn from(t: usize) -> Self {
        (t as i32).into()
    }
}

impl From<&usize> for Column {
    fn from(t: &usize) -> Self {
        (*t as i32).into()
    }
}



// ================
// === Location ===
// ================

newtype! {
/// A type representing 2d measurements.
Location {
    line: Line,
    column: Column,
}}

impl Location {
    /// Line setter.
    pub fn with_line(self, line: Line) -> Self {
        Self { line, ..self }
    }

    /// Column setter.
    pub fn with_column(self, column: Column) -> Self {
        Self { column, ..self }
    }
}
