//! A crate consisting all debug scenes.
//!
//! Those scenes are designated to test visual components of our application isolated from the
//! controllers.

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


// ==============
// === Export ===
// ==============

pub use debug_scene_interface as interface;
pub use debug_scene_visualization as visualization;
