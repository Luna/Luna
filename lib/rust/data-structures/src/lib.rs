//! Library of general data structures.

// === Standard Linter Configuration ===
#![deny(unconditional_recursion)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unsafe_code)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]
// === Features ===
#![feature(associated_type_bounds)]
#![feature(test)]
#![feature(trait_alias)]


// ==============
// === Export ===
// ==============

pub mod dependency_graph;
pub mod diet;
pub mod hash_map_tree;
pub mod index;
pub mod opt_vec;

pub use enso_prelude as prelude;
