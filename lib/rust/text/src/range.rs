//! Text range implementation. Similar to `std::ops::Range` but with specialized implementations
//! for text manipulation.

use crate::prelude::*;
use crate::unit::*;

use crate::rope;



// =============
// === Range ===
// =============

// FIXME: This should be refactored to prelude or other module - this is a copyable range.
// FIXME: Selection shape and range are the same, arent they?
/// A (half-open) range bounded inclusively below and exclusively above [start,end).
///
/// Unlike `std::ops::Range`, this type implements `Copy`, and contains text-related trait
/// implementations.
#[derive(Clone, Copy, Default, PartialEq, Eq, Hash)]
#[allow(missing_docs)]
pub struct Range<T> {
    pub start: T,
    pub end:   T,
}

impl<T> Range<T> {
    /// Constructor.
    pub fn new(start: T, end: T) -> Self {
        Self { start, end }
    }

    /// Checks whether the range is empty.
    pub fn is_empty(&self) -> bool
    where T: PartialEq {
        self.start == self.end
    }

    /// The size of the range.
    pub fn size<X>(&self) -> X
    where T: Clone + Sub<T, Output = X> {
        self.end.clone() - self.start.clone()
    }

    /// Return new range with the provided start value.
    pub fn with_start(&self, start: T) -> Self
    where T: Clone {
        let end = self.end.clone();
        Self { start, end }
    }

    /// Return new range with the provided end value.
    pub fn with_end(&self, end: T) -> Self
    where T: Clone {
        let start = self.start.clone();
        Self { start, end }
    }

    /// Return new range with the `offset` subtracted from both ends.
    pub fn moved_left(&self, offset: T) -> Self
    where T: Clone + Sub<T, Output = T> {
        Self { start: self.start.clone() - offset.clone(), end: self.end.clone() - offset }
    }

    /// Return new range with the `offset` added to both ends.
    pub fn moved_right(&self, offset: T) -> Self
    where T: Clone + Add<T, Output = T> {
        Self { start: self.start.clone() + offset.clone(), end: self.end.clone() + offset }
    }

    /// Map both values with the provided function.
    pub fn map<U>(&self, f: impl Fn(T) -> U) -> Range<U>
    where T: Clone {
        Range { start: f(self.start.clone()), end: f(self.end.clone()) }
    }

    /// Map the start value with the provided function.
    pub fn map_start(&self, f: impl FnOnce(T) -> T) -> Self
    where T: Clone {
        self.with_start(f(self.start.clone()))
    }

    /// Map the end value with the provided function.
    pub fn map_end(&self, f: impl FnOnce(T) -> T) -> Self
    where T: Clone {
        self.with_end(f(self.end.clone()))
    }

    /// Check if the range contains the given value.
    pub fn contains<U>(&self, value: &U) -> bool
    where
        T: PartialOrd<U>,
        U: PartialOrd<T>, {
        value >= &self.start && value < &self.end
    }

    /// Check if the range contains all values from `other` range.
    pub fn contains_range(&self, other: &Range<T>) -> bool
    where T: PartialOrd {
        self.start <= other.start && self.end >= other.end
    }
}

impl<Offset, Line: PartialEq> Range<Location<Offset, Line>> {
    /// Checks whether the range describes a single line.
    pub fn single_line(&self) -> bool {
        self.start.line == self.end.line
    }
}


// === Range<UBytes> methods ===

impl Range<UBytes> {
    /// Convert to `rope::Interval`.
    pub fn into_rope_interval(self) -> rope::Interval {
        self.into()
    }
}


// === Impls ===

impl<T: Display> Display for Range<T> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[{}, {})", self.start, self.end)
    }
}

impl<T: Debug> Debug for Range<T> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "[{:?}, {:?})", self.start, self.end)
    }
}

impl<T, U: Into<T>> From<std::ops::Range<U>> for Range<T> {
    fn from(range: std::ops::Range<U>) -> Range<T> {
        Range { start: range.start.into(), end: range.end.into() }
    }
}

impl<T, U: Clone + Into<T>> From<&std::ops::Range<U>> for Range<T> {
    fn from(range: &std::ops::Range<U>) -> Range<T> {
        Range { start: range.start.clone().into(), end: range.end.clone().into() }
    }
}

impl<T: PartialEq<T>> PartialEq<std::ops::Range<T>> for Range<T> {
    fn eq(&self, other: &std::ops::Range<T>) -> bool {
        (&self.start, &self.end) == (&other.start, &other.end)
    }
}


// === UBytes Impls ===

impl From<RangeTo<UBytes>> for Range<UBytes> {
    fn from(range: RangeTo<UBytes>) -> Range<UBytes> {
        Range::new(0.ubytes(), range.end)
    }
}

impl From<RangeInclusive<UBytes>> for Range<UBytes> {
    fn from(range: RangeInclusive<UBytes>) -> Range<UBytes> {
        Range::new(*range.start(), range.end().saturating_add(1.ubytes()))
    }
}

impl From<RangeToInclusive<UBytes>> for Range<UBytes> {
    fn from(range: RangeToInclusive<UBytes>) -> Range<UBytes> {
        Range::new(0.ubytes(), range.end.saturating_add(1.ubytes()))
    }
}

impl Index<Range<UBytes>> for str {
    type Output = str;
    fn index(&self, index: Range<UBytes>) -> &Self::Output {
        let start = index.start.value;
        let end = index.end.value;
        &self[start..end]
    }
}

impl Index<Range<UBytes>> for String {
    type Output = str;
    fn index(&self, index: Range<UBytes>) -> &Self::Output {
        &self.as_str()[index]
    }
}

impl Index<Range<Bytes>> for str {
    type Output = str;
    fn index(&self, index: Range<Bytes>) -> &Self::Output {
        let start = index.start.value;
        let end = index.end.value;
        &self[start as usize..end as usize]
    }
}

impl Index<Range<Bytes>> for String {
    type Output = str;
    fn index(&self, index: Range<Bytes>) -> &Self::Output {
        &self.as_str()[index]
    }
}


// === Conversions ===

impl<T: Clone> From<&Range<T>> for Range<T> {
    fn from(t: &Range<T>) -> Self {
        t.clone()
    }
}

impl From<Range<UBytes>> for rope::Interval {
    fn from(t: Range<UBytes>) -> Self {
        Self { start: t.start.value, end: t.end.value }
    }
}

impl From<Range<UBytes>> for Range<Bytes> {
    fn from(t: Range<UBytes>) -> Self {
        let start = t.start.into();
        let end = t.end.into();
        Self { start, end }
    }
}

impl From<&Range<UBytes>> for Range<Bytes> {
    fn from(t: &Range<UBytes>) -> Self {
        let start = t.start.into();
        let end = t.end.into();
        Self { start, end }
    }
}

impl From<&mut Range<UBytes>> for Range<Bytes> {
    fn from(t: &mut Range<UBytes>) -> Self {
        let start = t.start.into();
        let end = t.end.into();
        Self { start, end }
    }
}

impl TryFrom<Range<Bytes>> for Range<UBytes> {
    type Error = BytesToUBytesConversionError;
    fn try_from(t: Range<Bytes>) -> Result<Self, Self::Error> {
        let start = t.start.try_into()?;
        let end = t.end.try_into()?;
        Ok(Self { start, end })
    }
}



// ===================
// === RangeBounds ===
// ===================

/// RangeBounds allows converting all Rust ranges to the `Range` type, including open ranges, like
/// `..`, `a..`, `..b`, and `..=c`. When used for text manipulation, open ranges are clamped between
/// 0 bytes and the total bytes of the text.
pub trait RangeBounds {
    /// Clamp the range to the total bytes of the text/
    fn with_upper_bound(self, upper_bound: UBytes) -> Range<UBytes>;
}

impl<T: Into<Range<UBytes>>> RangeBounds for T {
    fn with_upper_bound(self, _upper_bound: UBytes) -> Range<UBytes> {
        self.into()
    }
}

impl RangeBounds for RangeFrom<UBytes> {
    fn with_upper_bound(self, upper_bound: UBytes) -> Range<UBytes> {
        Range::new(self.start, upper_bound)
    }
}

impl RangeBounds for RangeFull {
    fn with_upper_bound(self, upper_bound: UBytes) -> Range<UBytes> {
        Range::new(0.ubytes(), upper_bound)
    }
}
