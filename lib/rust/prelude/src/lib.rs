//! This module re-exports a lot of useful stuff. It is not meant to be used
//! by libraries, but it is definitely usefull for bigger projects. It also
//! defines several aliases and utils which may find their place in new
//! libraries in the future.

// === Features ===
#![feature(concat_idents)]
#![feature(specialization)]
#![feature(trait_alias)]
#![feature(generators)]
#![feature(step_trait)]
#![feature(allocator_api)]
#![feature(auto_traits)]
#![feature(negative_impls)]
#![feature(pattern)]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]
#![allow(incomplete_features)] // To be removed, see: https://github.com/enso-org/ide/issues/1559
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(unsafe_code)]
#![recursion_limit = "256"]

mod bool;
pub mod channel;
mod collections;
mod data;
pub mod debug;
pub mod env;
mod fail;
pub mod future;
mod leak;
mod macros;
mod not_same;
mod option;
mod phantom;
mod range;
mod rc;
mod reference;
mod result;
mod serde;
mod smallvec;
mod std_reexports;
mod string;
mod switch;
mod test;
mod tp;
mod vec;
mod wrapper;

pub use crate::bool::*;
pub use crate::serde::*;
pub use crate::smallvec::*;
pub use anyhow;
pub use collections::*;
pub use data::*;
pub use debug::*;
pub use enso_shapely::before_main;
pub use enso_shapely::clone_ref::*;
pub use enso_shapely::definition_path;
pub use enso_shapely::impl_clone_ref_as_clone;
pub use fail::*;
pub use leak::Leak;
pub use leak::*;
pub use macros::*;
pub use not_same::*;
pub use option::*;
pub use phantom::*;
pub use range::traits::*;
pub use rc::*;
pub use reference::*;
pub use result::*;
pub use std_reexports::*;
pub use string::*;
pub use switch::*;
pub use test::traits::*;
pub use tp::*;
pub use vec::*;
pub use wrapper::*;

pub use assert_approx_eq::assert_approx_eq;
pub use boolinator::Boolinator;
pub use derivative::Derivative;
pub use derive_more::*;
pub use enclose::enclose;
pub use failure::Fail;
pub use ifmt::*;
pub use itertools::Itertools;
pub use lazy_static::lazy_static;
pub use num::Num;
pub use paste::paste;
pub use shrinkwraprs::Shrinkwrap;

pub use weak_table;
pub use weak_table::traits::WeakElement;
pub use weak_table::traits::WeakKey;
pub use weak_table::WeakKeyHashMap;
pub use weak_table::WeakValueHashMap;

pub use gen_iter::gen_iter;
pub use std::collections::hash_map::DefaultHasher;
pub use std::hash::Hash;
pub use std::hash::Hasher;

/// Re-export of [`wasm_bindgen`] is needed because the code generated by [`before_main`] macro
/// uses it. Unfortunately, `$crate` does not exist in proc macros, so it is not possible to
/// refer to [`wasm_bindgen`] from the macro in a generic way.
pub use wasm_bindgen;

pub use enso_reflect::prelude::*;

pub use std::ops::AddAssign;
pub use std::ops::SubAssign;

use std::cell::UnsafeCell;


mod anyhow_macros {
    pub use anyhow::anyhow;
}
pub use anyhow_macros::*;


/// Module designed to be used in an explicit way. After importing `prelude::*` you can use it for
/// example as `std_ext::range::merge_overlapping_ranges(...)`.
#[allow(missing_docs)]
pub mod std_ext {
    pub mod range {
        pub use crate::range::*;
    }
}

/// Serde reexports for the code generated by declarative macros.
///
/// They cannot be directly reexported from prelude, as the methods `serialize` and `deserialize`
/// that would be brought into scope by this, would collide with the other IDE-defined traits.
pub mod serde_reexports {
    pub use serde::Deserialize;
    pub use serde::Serialize;
}



// ===============
// === Tracing ===
// ===============

pub mod tracing {
    pub use tracing::*;
    pub use tracing_subscriber::*;
}

pub use ::tracing::debug;
pub use ::tracing::debug_span;
pub use ::tracing::error;
pub use ::tracing::error_span;
pub use ::tracing::info;
pub use ::tracing::info_span;
pub use ::tracing::trace;
pub use ::tracing::trace_span;
pub use ::tracing::warn;
pub use ::tracing::warn_span;

pub const ERROR: tracing::Level = tracing::Level::ERROR;
pub const WARN: tracing::Level = tracing::Level::WARN;
pub const INFO: tracing::Level = tracing::Level::INFO;
pub const DEBUG: tracing::Level = tracing::Level::DEBUG;
pub const TRACE: tracing::Level = tracing::Level::TRACE;


use std::sync::Once;

/// Tracing's `set_global_default` can be called only once. When running tests this can fail if
/// not fenced.
static TRACING_INIT_ONCE: Once = Once::new();

pub fn init_tracing(level: tracing::Level) {
    TRACING_INIT_ONCE.call_once(|| {
        #[cfg(not(target_arch = "wasm32"))]
        let subscriber = tracing::fmt()
            .compact()
            .with_target(false)
            .with_max_level(level)
            .without_time()
            .finish();
        #[cfg(target_arch = "wasm32")]
        let subscriber = {
            use tracing_subscriber::layer::SubscriberExt;
            use tracing_wasm::*;
            let config = WASMLayerConfigBuilder::new().set_max_level(level).build();
            tracing::Registry::default().with(WASMLayer::new(config))
        };
        tracing::subscriber::set_global_default(subscriber).expect("Failed to initialize logger.");
    });
}

pub fn init_global() {
    init_tracing(WARN);
    init_global_internal();
}

#[cfg(target_arch = "wasm32")]
fn init_global_internal() {
    enso_web::forward_panic_hook_to_console();
    enso_web::set_stack_trace_limit();
}

#[cfg(not(target_arch = "wasm32"))]
fn init_global_internal() {}



// =================
// === Immutable ===
// =================

/// A zero-overhead newtype which provides immutable access to its content. Of course this does not
/// apply to internal mutability of the wrapped data. A good use case of this structure is when you
/// want to pass an ownership to a structure, allow access all its public fields, but do not allow
/// their modification.
#[derive(Clone, Copy, Default, Eq, PartialEq)]
pub struct Immutable<T> {
    data: T,
}

/// Constructor of the `Immutable` struct.
#[allow(non_snake_case)]
pub fn Immutable<T>(data: T) -> Immutable<T> {
    Immutable { data }
}

impl<T: Debug> Debug for Immutable<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.data.fmt(f)
    }
}

impl<T: Display> Display for Immutable<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.data.fmt(f)
    }
}

impl<T: Clone> CloneRef for Immutable<T> {
    fn clone_ref(&self) -> Self {
        Self { data: self.data.clone() }
    }
}

impl<T> AsRef<T> for Immutable<T> {
    fn as_ref(&self) -> &T {
        &self.data
    }
}

impl<T> std::borrow::Borrow<T> for Immutable<T> {
    fn borrow(&self) -> &T {
        &self.data
    }
}

impl<T> Deref for Immutable<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

// ==============
// === ToImpl ===
// ==============

/// Provides method `to`, which is just like `into` but allows fo superfish syntax.
pub trait ToImpl: Sized {
    fn to<P>(self) -> P
    where Self: Into<P> {
        self.into()
    }
}
impl<T> ToImpl for T {}



#[macro_export]
macro_rules! clone_boxed {
    ( $name:ident ) => {
        paste! {
            #[allow(missing_docs)]
            pub trait [<CloneBoxedFor $name>] {
                fn clone_boxed(&self) -> Box<dyn $name>;
            }

            impl<T:Clone+$name+'static> [<CloneBoxedFor $name>] for T {
                fn clone_boxed(&self) -> Box<dyn $name> {
                    Box::new(self.clone())
                }
            }

            impl Clone for Box<dyn $name> {
                fn clone(&self) -> Self {
                    self.clone_boxed()
                }
            }
        }
    };
}

/// Alias for `for<'t> &'t Self : Into<T>`.
pub trait RefInto<T> = where for<'t> &'t Self: Into<T>;

// =================
// === CloneCell ===
// =================

#[derive(Debug)]
pub struct CloneCell<T> {
    data: UnsafeCell<T>,
}

impl<T> CloneCell<T> {
    pub fn new(elem: T) -> CloneCell<T> {
        CloneCell { data: UnsafeCell::new(elem) }
    }

    #[allow(unsafe_code)]
    pub fn get(&self) -> T
    where T: Clone {
        unsafe { (*self.data.get()).clone() }
    }

    #[allow(unsafe_code)]
    pub fn set(&self, elem: T) {
        unsafe {
            *self.data.get() = elem;
        }
    }

    #[allow(unsafe_code)]
    pub fn take(&self) -> T
    where T: Default {
        let ptr: &mut T = unsafe { &mut *self.data.get() };
        std::mem::take(ptr)
    }
}

impl<T: Clone> Clone for CloneCell<T> {
    fn clone(&self) -> Self {
        Self::new(self.get())
    }
}

impl<T: Default> Default for CloneCell<T> {
    fn default() -> Self {
        Self::new(default())
    }
}

// ====================
// === CloneRefCell ===
// ====================

#[derive(Debug)]
pub struct CloneRefCell<T: ?Sized> {
    data: UnsafeCell<T>,
}

impl<T> CloneRefCell<T> {
    pub fn new(elem: T) -> CloneRefCell<T> {
        CloneRefCell { data: UnsafeCell::new(elem) }
    }

    #[allow(unsafe_code)]
    pub fn get(&self) -> T
    where T: CloneRef {
        unsafe { (*self.data.get()).clone_ref() }
    }

    #[allow(unsafe_code)]
    pub fn set(&self, elem: T) {
        unsafe {
            *self.data.get() = elem;
        }
    }

    #[allow(unsafe_code)]
    pub fn take(&self) -> T
    where T: Default {
        let ptr: &mut T = unsafe { &mut *self.data.get() };
        std::mem::take(ptr)
    }
}

impl<T: CloneRef> Clone for CloneRefCell<T> {
    fn clone(&self) -> Self {
        Self::new(self.get())
    }
}

impl<T: CloneRef> CloneRef for CloneRefCell<T> {
    fn clone_ref(&self) -> Self {
        Self::new(self.get())
    }
}

impl<T: Default> Default for CloneRefCell<T> {
    fn default() -> Self {
        Self::new(default())
    }
}

// ================================
// === RefCell<Option<T>> Utils ===
// ================================

pub trait RefCellOptionOps<T> {
    fn clear(&self);
    fn set(&self, val: T);
    fn set_if_empty_or_warn(&self, val: T);
}

impl<T> RefCellOptionOps<T> for RefCell<Option<T>> {
    default fn clear(&self) {
        *self.borrow_mut() = None;
    }

    default fn set(&self, val: T) {
        *self.borrow_mut() = Some(val);
    }

    default fn set_if_empty_or_warn(&self, val: T) {
        if self.borrow().is_some() {
            WARNING!("Trying to set value that was already set.")
        }
        *self.borrow_mut() = Some(val);
    }
}

impl<T: Debug> RefCellOptionOps<T> for RefCell<Option<T>> {
    fn set_if_empty_or_warn(&self, val: T) {
        if let Some(ref current) = *self.borrow() {
            WARNING!(
                "Trying to set value that was already set (current: {current:?}; new: {val:?})."
            )
        }
        *self.borrow_mut() = Some(val);
    }
}

// ===============
// === HasItem ===
// ===============

/// Type family for structures containing items.
pub trait HasItem {
    type Item;
}

pub trait ItemClone = HasItem where <Self as HasItem>::Item: Clone;

impl<T> HasItem for Option<T> {
    type Item = T;
}
impl<T> HasItem for Cell<T> {
    type Item = T;
}
impl<T> HasItem for RefCell<T> {
    type Item = T;
}

// ===============================
// === CellGetter / CellSetter ===
// ===============================

/// Generalization of the [`Cell::get`] mechanism. Can be used for anything similar to [`Cell`].
pub trait CellGetter: HasItem {
    fn get(&self) -> Self::Item;
}

/// Generalization of the [`Cell::set`] mechanism. Can be used for anything similar to [`Cell`].
pub trait CellSetter: HasItem {
    fn set(&self, value: Self::Item);
}

/// Generalization of modify utilities for structures similar to [`Cell`].
pub trait CellProperty: CellGetter + CellSetter + ItemClone {
    /// Update the contained value using the provided function and return the new value.
    fn update<F>(&self, f: F) -> Self::Item
    where F: FnOnce(Self::Item) -> Self::Item {
        let new_val = f(self.get());
        self.set(new_val.clone());
        new_val
    }

    /// Modify the contained value using the provided function and return the new value.
    fn modify<F>(&self, f: F) -> Self::Item
    where F: FnOnce(&mut Self::Item) {
        let mut new_val = self.get();
        f(&mut new_val);
        self.set(new_val.clone());
        new_val
    }

    /// Update the contained value using the provided function without returning the new value.
    fn update_<F>(&self, f: F)
    where F: FnOnce(Self::Item) -> Self::Item {
        self.update(f);
    }

    /// Modify the contained value using the provided function without returning the new value.
    fn modify_<F>(&self, f: F)
    where F: FnOnce(&mut Self::Item) {
        self.modify(f);
    }
}

impl<T: CellGetter + CellSetter + ItemClone> CellProperty for T {}

// === Impls ===

impl<T: Copy> CellGetter for Cell<T> {
    fn get(&self) -> Self::Item {
        self.get()
    }
}
impl<T: Copy> CellSetter for Cell<T> {
    fn set(&self, value: Self::Item) {
        self.set(value)
    }
}

// ================================
// === Strong / Weak References ===
// ================================

/// Abstraction for a strong reference like `Rc` or newtypes over it.
pub trait StrongRef: CloneRef {
    /// Downgraded reference type.
    type WeakRef: WeakRef<StrongRef = Self>;
    /// Creates a new weak reference of this allocation.
    fn downgrade(&self) -> Self::WeakRef;
}

/// Abstraction for a weak reference like `Weak` or newtypes over it.
pub trait WeakRef: CloneRef {
    /// Upgraded reference type.
    type StrongRef: StrongRef<WeakRef = Self>;
    /// Attempts to upgrade the weak referenc to a strong one, delaying dropping of the inner value
    /// if successful.
    fn upgrade(&self) -> Option<Self::StrongRef>;
}

impl<T: ?Sized> StrongRef for Rc<T> {
    type WeakRef = Weak<T>;
    fn downgrade(&self) -> Self::WeakRef {
        Rc::downgrade(self)
    }
}

impl<T: ?Sized> WeakRef for Weak<T> {
    type StrongRef = Rc<T>;
    fn upgrade(&self) -> Option<Self::StrongRef> {
        Weak::upgrade(self)
    }
}



// ======================
// === ImplementsDrop ===
// ======================

/// Check whether the structure implements custom drop behavior. Used mainly by the
/// [`NoCloneBecauseOfCustomDrop`] macro.
#[allow(drop_bounds)]
pub trait ImplementsDrop: Drop {}
