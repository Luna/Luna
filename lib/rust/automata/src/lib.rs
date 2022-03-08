//! Implementation of Finite State Automata in both Nondeterministic and Deterministic forms,
//! together with a set of conversions, processing, analysis, and visualization utilities.

// === Linter configuration ===
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unsafe_code)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]
#![warn(missing_docs)]

// === Features ===
#![feature(test)]


// ==============
// === Export ===
// ==============

pub mod alphabet;
pub mod data;
pub mod dfa;
pub mod nfa;
pub mod pattern;
pub mod state;
pub mod symbol;

pub use pattern::*;
pub use symbol::*;
pub use dfa::Dfa;
pub use nfa::Nfa;
pub use enso_prelude as prelude;



