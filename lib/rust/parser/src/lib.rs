//! This library contains the implementation of the Enso parser.


// ==============
// === Export ===
// ==============

pub mod macros;
pub mod operator;
pub mod parser;

pub use crate::parser::*;



/// The prelude for the parser.
pub mod prelude {
    pub use enso_logger::AnyLogger;
    pub use enso_prelude::*;

    /// The Enso logging library.
    pub mod logger {
        pub use enso_logger::Logger;
        pub use enso_logger::*;
    }

    /// The lexer types.
    pub mod lexer {
        pub use ::lexer::*;

        /// The lexer tokens.
        pub mod token {
            pub use lexer::library::token::*;
        }
    }
}
