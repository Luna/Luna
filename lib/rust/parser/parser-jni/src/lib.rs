//! This module exports the implementation of parser for the Enso language.

#![deny(unconditional_recursion)]

// === Linter configuration ===
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unsafe_code)]
#![warn(unused_import_braces)]

// === Features ===
#![feature(test)]



mod jni;

pub use crate::jni::*;

use ast_new::AnyAst;
use ast_new::Ast;



// =======================
// === Parser Rust API ===
// =======================

/// Parse a content of a single source file.
pub fn parse_str(input: String) -> AnyAst {
    Ast::new(ast_new::txt::Text { text: input })
}

/// Parse a single source file.
pub fn parse_file(filename: String) -> AnyAst {
    parse_str(filename)
}


// === Tokens ===

/// Parse a content of single source file.
pub fn lexe_str(input: String) -> AnyAst {
    parse_str(input)
}

/// Parse a single source file.
pub fn lexe_file(filename: String) -> AnyAst {
    parse_str(filename)
}
