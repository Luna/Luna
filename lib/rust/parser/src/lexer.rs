//! Implementation of lexer, a utility transforming source code into stream of tokens. Read the docs
//! of the main module of this crate to learn more about the parsing process.

use crate::prelude::*;
// use crate::source::traits::*;

use crate::source;
use crate::source::span;
use crate::source::span::VisibleOffset;
use crate::syntax::token;
use crate::syntax::token::Token;

use bumpalo::Bump;
use ouroboros::self_referencing;
use std::str;


// =================
// === Constants ===
// =================

/// An optimization constant. Based on it, the estimated memory is allocated on the beginning of
/// parsing.
pub const AVERAGE_TOKEN_LEN: usize = 5;



// ===============
// === BumpVec ===
// ===============

/// A vector with [`Bump`] allocator.
///
/// This struct owns the allocator, and thus, it is a self-referencing one. It uses [`ouroboros`] to
/// guarantee that the self-referencing pattern is safe.
#[self_referencing]
pub struct BumpVec<T> {
    allocator: Bump,
    #[covariant]
    #[borrows(allocator)]
    pub vec:   Vec<T, &'this Bump>,
}

impl<T> BumpVec<T> {
    /// Constructor.
    #[inline(always)]
    fn new_with_capacity(capacity: usize) -> Self {
        let allocator = Bump::with_capacity(capacity);
        BumpVecBuilder { allocator, vec_builder: |allocator: &Bump| Vec::new_in(allocator) }.build()
    }

    /// Push a new element to this vec.
    #[inline(always)]
    pub fn push(&mut self, t: T) {
        self.with_mut(|fields| fields.vec.push(t))
    }

    /// Get reference to the last element, if any.
    #[inline(always)]
    pub fn last(&self) -> Option<&T> {
        self.borrow_vec().last()
    }

    /// Get the length of this vec.
    #[inline(always)]
    pub fn len(&self) -> usize {
        self.borrow_vec().len()
    }

    /// Iterate over elements of this vec.
    #[inline(always)]
    pub fn iter(&self) -> slice::Iter<'_, T> {
        self.borrow_vec().into_iter()
    }
}

impl<T> Default for BumpVec<T> {
    fn default() -> Self {
        Self::new_with_capacity(0)
    }
}

impl<T: Debug> Debug for BumpVec<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        Debug::fmt(self.borrow_vec(), f)
    }
}



// ===============
// === Pattern ===
// ===============

/// Allows checking if the incoming char matches a predicate. The predicate can be another char
/// (then this is simply check for equality), or a function `FnMut(char) -> bool`. This trait allows
/// defining parsers which can work with both simple and function-based matchers.
pub trait Pattern {
    /// Check whether [`input`] matches this pattern.
    fn match_pattern(&mut self, input: char) -> bool;
}

impl<T: FnMut(char) -> bool> Pattern for T {
    #[inline(always)]
    fn match_pattern(&mut self, input: char) -> bool {
        (self)(input)
    }
}

impl Pattern for char {
    #[inline(always)]
    fn match_pattern(&mut self, input: char) -> bool {
        *self == input
    }
}

macro_rules! pattern_impl_for_char_slice {
    ($($num:tt),* $(,)?) => {$(
        impl Pattern for &[char; $num] {
            #[inline(always)]
            fn match_pattern(&mut self, input: char) -> bool {
                self.contains(&input)
            }
        }
    )*};
}
pattern_impl_for_char_slice!(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);



// =============
// === Lexer ===
// =============

/// Efficient lexer implementation with no backtracking an 1-character lookahead ([`current_char`]
/// contains character that is not consumed yet). The lexer does not use recursion and is
/// implemented as a single-pass input stream consumer.
///
/// Please note, that the lexer is able to parse invalid input, such as invalid operators, like
/// `===`. This is needed for allowing the parser to auto-recover from errors in the code, including
/// syntax errors.
///
/// TODO: Implement token validators - validating if the consumed token was OK and reporting human
///       readable errors.
#[derive(Debug, Deref, DerefMut)]
#[allow(missing_docs)]
pub struct Lexer<'s> {
    #[deref]
    #[deref_mut]
    pub state:    LexerState,
    pub input:    &'s str,
    pub iterator: str::CharIndices<'s>,
    pub output:   BumpVec<Token<'s>>,
}

/// Internal state of the [`Lexer`].
#[derive(Debug, Default)]
#[allow(missing_docs)]
pub struct LexerState {
    pub current_char:                 Option<char>,
    pub current_offset:               Bytes,
    pub last_spaces_offset:           Bytes,
    pub last_spaces_visible_offset:   VisibleOffset,
    pub current_block_indent:         VisibleOffset,
    pub block_indent_stack:           Vec<VisibleOffset>,
    pub current_line_contains_tokens: bool,
}

impl<'s> Lexer<'s> {
    /// Constructor.
    pub fn new(input: &'s str) -> Self {
        let iterator = input.char_indices();
        let capacity = input.len() / AVERAGE_TOKEN_LEN;
        let output = BumpVec::new_with_capacity(capacity);
        let state = default();
        Self { input, iterator, output, state }.init()
    }

    fn init(mut self) -> Self {
        self.next();
        self
    }

    /// Move to the next input character.
    #[inline(always)]
    fn next(&mut self) {
        let next = self.iterator.next();
        if let Some((current_offset, current_char)) = next {
            self.current_offset = Bytes::from(current_offset);
            self.current_char = Some(current_char);
        } else if self.current_char.is_some() {
            self.current_offset = Bytes::from(self.input.len());
            self.current_char = None;
        }
    }

    // /// Get the representation of the provided element. The element has to know its span (start
    // and /// ens position).
    // #[inline(always)]
    // pub fn repr<'t, T: 't>(&'t self, element: T) -> &str
    // where source::With<'s, T>: HasRepr<'s> {
    //     source::With::new(&self.input, element).repr()
    // }

    /// Run the provided function. If it consumed any chars, returns the output of the function and
    /// the span of the consumed tokens. Returns [`None`] otherwise.
    #[inline(always)]
    pub fn token<T>(
        &mut self,
        f: impl FnOnce(&mut Self) -> T,
    ) -> Option<source::With<'s, span::With<T>>> {
        let start = self.current_offset;
        let (elem, len) = self.run_and_check_offset(f);
        (len > Bytes::from(0)).as_some_from(|| {
            let repr = self.input.slice(start..start + len);
            self.token_with_len_and_repr(len, repr, elem)
        })
    }

    /// A zero-length token which is placed before currently consumed spaces, if any.
    #[inline(always)]
    pub fn marker_token<T>(&mut self, elem: T) -> span::With<source::With<'s, T>> {
        let left_offset = Bytes::from(0);
        let left_visible_offset = VisibleOffset::from(0);
        let start = self.current_offset - self.last_spaces_offset;
        let len = Bytes::from(0);
        let repr = self.input.slice(start..start + len);
        let span = span::Span { left_visible_offset, left_offset, len };
        let elem = source::With(repr, elem);
        span::With { span, elem }
    }

    /// Token constructor with explicit start and len values.
    #[inline(always)]
    fn token_with_len_and_repr<T>(
        &mut self,
        len: Bytes,
        repr: &'s str,
        elem: T,
    ) -> source::With<'s, span::With<T>> {
        let left_offset = self.last_spaces_offset;
        let left_visible_offset = self.last_spaces_visible_offset;
        (self.last_spaces_visible_offset, self.last_spaces_offset) = self.spaces();
        let span = span::Span { left_visible_offset, left_offset, len };
        source::With(repr, span::With { span, elem })
    }

    /// Run the provided function and compute how much input it consumed.
    #[inline(always)]
    pub fn run_and_check_offset<T>(&mut self, f: impl FnOnce(&mut Self) -> T) -> (T, Bytes) {
        let start = self.current_offset;
        let out = f(self);
        let len = self.current_offset - start;
        (out, len)
    }

    /// Run the provided function and check if it consumed any input.
    #[inline(always)]
    pub fn try_running(&mut self, f: impl FnOnce(&mut Self)) -> bool {
        let (_, offset) = self.run_and_check_offset(f);
        offset > Bytes::from(0)
    }

    /// Push the [`token`] to the result stream.
    #[inline(always)]
    pub fn submit_token(&mut self, token: Token<'s>) {
        self.output.push(token);
        self.current_line_contains_tokens = true;
    }

    /// Start a new block.
    #[inline(always)]
    pub fn push_block_indent(&mut self, new_indent: VisibleOffset) {
        let current_block_indent = self.current_block_indent;
        self.block_indent_stack.push(current_block_indent);
        self.current_block_indent = new_indent;
    }

    /// Finish the current block.
    #[inline(always)]
    pub fn pop_block_indent(&mut self) -> Option<VisibleOffset> {
        self.block_indent_stack.pop().map(|prev| {
            let out = self.current_block_indent;
            self.current_block_indent = prev;
            out
        })
    }
}



// =====================
// === Basic Parsers ===
// =====================

impl<'s> Lexer<'s> {
    /// Consume the next character, unconditionally.
    #[inline(always)]
    pub fn take_next(&mut self) -> bool {
        let ok = self.current_char.is_some();
        self.next();
        ok
    }

    /// Consume exactly one character if it matches the pattern. Returns [`true`] if it succeeded.
    #[inline(always)]
    pub fn take_1(&mut self, mut pat: impl Pattern) -> bool {
        match self.current_char.map(|t| pat.match_pattern(t)) {
            Some(true) => {
                self.next();
                true
            }
            _ => false,
        }
    }

    /// Consume characters as long as they match the pattern.
    #[inline(always)]
    pub fn take_while(&mut self, mut pat: impl Pattern) {
        while let Some(t) = self.current_char {
            if pat.match_pattern(t) {
                self.next()
            } else {
                break;
            }
        }
    }

    /// Consume characters as long as they match the pattern. Returns [`true`] if at least one
    /// character was consumed.
    #[inline(always)]
    pub fn take_while_1(&mut self, f: impl Copy + Pattern) -> bool {
        let ok = self.take_1(f);
        if ok {
            self.take_while(f);
        }
        ok
    }
}



// =============
// === Space ===
// =============

/// Based on https://en.wikipedia.org/wiki/Whitespace_character.
const OTHER_UNICODE_SINGLE_SPACES: &str = "\u{1680}\u{202F}\u{205F}\u{3000}";
const OTHER_UNICODE_SINGLE_SPACES_RANGE: (char, char) = ('\u{2000}', '\u{200A}');
#[cfg(test)]
const UNICODE_ZERO_SPACES: &str = "\u{180E}\u{200B}\u{200C}\u{200D}\u{2060}\u{FEFF}";

/// Checks whether the provided character is a visible space and returns it's visible size. The tab
/// character always returns `4`. It is not made configurable, as described in the Enso Language
/// Specification docs.
#[inline(always)]
fn space_char_visible_size(t: char) -> Option<VisibleOffset> {
    if t == ' ' {
        Some(VisibleOffset::from(1))
    } else if t == '\t' {
        Some(VisibleOffset::from(4))
    } else if t == '\u{00A0}' {
        Some(VisibleOffset::from(1))
    } else if t >= '\u{1680}' {
        if t == '\u{1680}' {
            Some(VisibleOffset::from(1))
        } else if t >= '\u{2000}' {
            if OTHER_UNICODE_SINGLE_SPACES.contains(t) {
                Some(VisibleOffset::from(1))
            } else if t >= OTHER_UNICODE_SINGLE_SPACES_RANGE.0
                && t <= OTHER_UNICODE_SINGLE_SPACES_RANGE.1
            {
                Some(VisibleOffset::from(1))
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    }
}

/// Check whether the provided character is a visible space character.
#[inline(always)]
fn is_space_char(t: char) -> bool {
    space_char_visible_size(t).is_some()
}

impl<'s> Lexer<'s> {
    /// Consume the current character if it was a visible space and return how big the space was.
    #[inline(always)]
    fn space_and_its_visible_offset(&mut self) -> Option<VisibleOffset> {
        let out = self.current_char.and_then(space_char_visible_size);
        if out.is_some() {
            self.next();
        }
        out
    }

    /// Consume all space characters.
    #[inline(always)]
    fn spaces(&mut self) -> (VisibleOffset, Bytes) {
        let mut total_visible_offset = VisibleOffset::from(0);
        let mut total_byte_offset = Bytes::from(0);
        while let Some(visible_offset) = self.space_and_its_visible_offset() {
            total_visible_offset += visible_offset;
            total_byte_offset += Bytes::from(1);
        }
        (total_visible_offset, total_byte_offset)
    }
}



// ================================
// === Basic Character Checkers ===
// ================================

/// Check whether the provided character is a newline character.
#[inline(always)]
pub fn is_newline_char(t: char) -> bool {
    t == '\n' || t == '\r'
}

/// Check whether the provided character is a digit.
#[inline(always)]
fn is_digit(t: char) -> bool {
    t >= '0' && t <= '9'
}



// ========================
// === Ident & Operator ===
// ========================

/// # ASCII char table
/// Based on https://en.wikipedia.org/wiki/ASCII.
///
/// 21  !     3A  :     7B  {
/// 22  "     3B  ;     7C  |
/// 23  #     3C  <     7D  }
/// 24  $     3D  =     7E  ~
/// 25  %     3E  >
/// 26  &     3F  ?
/// 27  '     40  @
/// 28  (     [A-Z]
/// 29  )     
/// 2A  *     5B  [
/// 2B  +     5C  \
/// 2C  ,     5D  ]
/// 2D  -     5E  ^
/// 2E  .     5F  _
/// 2F  /     60  `
/// [0-9]     [a-z]

/// Check whether the provided character is an operator which should split the currently parsed
/// identifier.
#[inline(always)]
fn is_ident_body_split_operator(t: char) -> bool {
    if t <= '\u{7E}' && t >= '\u{21}' {
        (t == '\u{21}')
            || (t >= '\u{21}' && t <= '\u{26}')
            || (t >= '\u{28}' && t <= '\u{2F}')
            || (t >= '\u{3A}' && t <= '\u{40}')
            || (t >= '\u{5B}' && t <= '\u{5E}')
            || (t == '\u{60}')
            || (t >= '\u{7B}' && t <= '\u{7E}')
    } else {
        false
    }
}

/// Check if the provided character should be considered body of an operator name.
#[inline(always)]
fn is_operator_body_char(t: char) -> bool {
    if t <= '\u{7E}' && t >= '\u{21}' {
        (t == '\u{21}')
            || (t >= '\u{24}' && t <= '\u{26}')
            || (t >= '\u{2A}' && t <= '\u{2F}')
            || (t >= '\u{3A}' && t <= '\u{40}')
            || (t == '\u{5C}')
            || (t == '\u{5E}')
            || (t == '\u{7C}')
            || (t == '\u{7E}')
    } else {
        false
    }
}



// =============
// === Ident ===
// =============

/// Check whether the provided character should split currently parsed identifier.
#[inline(always)]
fn is_ident_split_char(t: char) -> bool {
    is_ident_body_split_operator(t) || is_space_char(t) || is_newline_char(t)
}

/// Check whether the provided character should be considered a body of identifier.
#[inline(always)]
fn is_ident_char(t: char) -> bool {
    !is_ident_split_char(t)
}

impl token::Type {
    /// Convert the provided string to ident. It's content will not be validated.
    pub fn to_ident_unchecked<'s>(repr: &'s str) -> token::Type {
        let starts_with_underscore = repr.starts_with('_');
        let lift_level = repr.chars().rev().take_while(|t| *t == '\'').count();
        if starts_with_underscore && repr.len() == 1 + lift_level {
            token::Type::wildcard(lift_level)
        } else {
            let is_free = starts_with_underscore;
            token::Type::ident(is_free, lift_level)
        }
    }
}

impl<'s> Lexer<'s> {
    /// Parse an identifier.
    fn ident(&mut self) {
        if let Some(tok) = self.token(|this| this.take_while_1(is_ident_char)) {
            let repr = tok.code;
            let tok = tok.with_elem(token::Type::to_ident_unchecked(repr));
            self.submit_token(source::With(repr, tok));
        }
    }
}



// ================
// === Operator ===
// ================

impl<'s> Lexer<'s> {
    /// Parse an operator.
    fn operator(&mut self) {
        let tok = self.token(|this| {
            if let Some(current) = this.current_char {
                match current {
                    '.' => this.take_while_1('.'),
                    '=' => this.take_while_1('='),
                    ':' => true,
                    ',' => true,
                    _ => this.take_while_1(is_operator_body_char),
                };
            }
        });
        if let Some(tok) = tok {
            if tok.code == "+-" {
                let (left, right) = tok.split_at(Bytes::from(1));
                let left = left.with(token::Type::operator());
                let right = right.with(token::Type::operator());
                self.submit_token(left);
                self.submit_token(right);
            } else {
                let only_eq = tok.code.chars().all(|t| t == '=');
                let is_mod = tok.code.ends_with('=') && !only_eq;
                let kind = if is_mod { token::Type::modifier() } else { token::Type::operator() };
                let token = tok.with(kind);
                self.submit_token(token);
            }
        }
    }
}
//
//
// // ==============
// // === Symbol ===
// // ==============
//
// impl<'s> Lexer<'s> {
//     /// Parse a symbol.
//     fn symbol(&mut self) {
//         if let Some(tok) = self.token(|this| this.take_1(&['(', ')', '{', '}', '[', ']'])) {
//             self.submit_token(tok.with_elem(token::Type::symbol()));
//         }
//     }
// }
//
//
//
// // ==============
// // === Number ===
// // ==============
//
// impl<'s> Lexer<'s> {
//     /// Parse a number.
//     fn number(&mut self) {
//         let tok = self.token(|this| {
//             if this.take_1(is_digit) {
//                 this.take_while(|t| !is_ident_split_char(t));
//             }
//         });
//         if let Some(tok) = tok {
//             self.submit_token(tok.with_elem(token::Type::number()));
//         }
//     }
// }
//
//
//
// // ============
// // === Text ===
// // ============
//
// fn is_inline_text_body(t: char) -> bool {
//     t != '"' && !is_newline_char(t) && t != '\\'
// }
//
// impl<'s> Lexer<'s> {
//     /// Parse a text literal.
//     fn text(&mut self) {
//         let tok = self.token(|this| this.take_1('"'));
//         if let Some(tok) = tok {
//             self.submit_token(tok.with_elem(token::Type::text_start()));
//             let line_empty = self.current_char.map(|t| is_newline_char(t)).unwrap_or(true);
//             if line_empty {
//                 todo!()
//             } else {
//                 let mut parsed_element;
//                 loop {
//                     parsed_element = false;
//
//                     let section = self.token(|this| this.take_while_1(is_inline_text_body));
//                     if let Some(tok) = section {
//                         parsed_element = true;
//                         self.submit_token(tok.with_elem(token::Type::text_section()));
//                     }
//
//                     let escape = self.token(|this| {
//                         if this.take_1('\\') {
//                             this.take_1('"');
//                         }
//                     });
//                     if let Some(tok) = escape {
//                         parsed_element = true;
//                         self.submit_token(tok.with_elem(token::Type::text_escape()));
//                     }
//
//                     let end = self.token(|this| this.take_1('"'));
//                     if let Some(tok) = end {
//                         self.submit_token(tok.with_elem(token::Type::text_end()));
//                         break;
//                     }
//
//                     if !parsed_element {
//                         break;
//                     }
//                 }
//             }
//         }
//     }
// }
//
//
// // ================
// // === Comments ===
// // ================
//
// impl<'s> Lexer<'s> {
//     #[inline(always)]
//     fn submit_line_as(&mut self, kind: token::Type) {
//         let tok = self.token(|this| this.take_all_newline_chars());
//         if let Some(tok) = tok {
//             self.submit_token(tok.with_elem(kind));
//         }
//     }
//
//     fn comment(&mut self) {
//         if let Some(current) = self.current_char {
//             if current == '#' {
//                 self.submit_line_as(token::Type::comment());
//                 let initial_ident = self.current_block_indent;
//                 let check_ident = |this: &mut Self| this.current_block_indent > initial_ident;
//                 while self.try_running(|this| this.newline()) && check_ident(self) {
//                     self.submit_line_as(token::Type::comment());
//                 }
//             }
//         }
//     }
// }
//
//
//
// // =============
// // === Block ===
// // =============
//
// impl<'s> Lexer<'s> {
//     #[inline(always)]
//     fn take_all_newline_chars(&mut self) {
//         self.take_while(|t| !is_newline_char(t))
//     }
//
//     fn newline(&mut self) {
//         let tok = self.token(|this| {
//             if !this.take_1('\n') {
//                 if this.take_1('\r') {
//                     this.take_1('\n');
//                 }
//             }
//         });
//
//         if let Some(tok) = tok {
//             let block_indent = self.last_spaces_visible_offset;
//             self.submit_token(tok.with_elem(token::Type::newline()));
//             let next_line_empty = self.current_char.map(|t| is_newline_char(t)).unwrap_or(true);
//             if !next_line_empty {
//                 if block_indent > self.current_block_indent {
//                     let block_start = self.marker_token(token::Type::block_start());
//                     self.submit_token(block_start);
//                     self.push_block_indent(block_indent);
//                 } else {
//                     while block_indent < self.current_block_indent {
//                         let err = "Lexer internal error. Inconsistent code block hierarchy.";
//                         let parent_block_indent = self.pop_block_indent().expect(err);
//                         if block_indent > self.current_block_indent {
//                             // The new line indent is smaller than current block but bigger than
// the                             // previous one. We are treating the line as belonging to the
// block. The                             // warning should be reported by parser.
//                             self.push_block_indent(parent_block_indent);
//                             break;
//                         } else {
//                             let block_end = Token::new_no_left_offset_no_len(
//                                 self.current_offset,
//                                 token::Type::block_end(),
//                             );
//                             self.submit_token(block_end);
//                         }
//                     }
//                 }
//             }
//             self.current_line_contains_tokens = false;
//         }
//     }
// }



// ============
// === Glue ===
// ============

/// All defined parsers in order they should be fired. The order is determined by two factors:
/// 1. The most common parsers should be first in order to minimize comparison for each new char.
/// 2. Some parsers could consume input even if it should be qualified as something else. Thus, some
///    parsers should be run first in order to make the token consuming process correct.
const PARSERS: &[for<'r> fn(&'r mut Lexer<'_>)] = &[
    |t| t.ident(),
    |t| t.operator(),
    // |t| t.newline(),
    // |t| t.symbol(),
    // |t| t.comment(),
    // |t| t.number(),
    // |t| t.text(),
];

impl<'s> Lexer<'s> {
    /// Run the lexer. Returns [`true`] if the process succeeded.
    pub fn run(&mut self) -> bool {
        (self.last_spaces_visible_offset, self.last_spaces_offset) = self.spaces();
        let mut any_parser_matched = true;
        while any_parser_matched {
            any_parser_matched = false;
            for f in PARSERS {
                if self.try_running(f) {
                    any_parser_matched = true;
                    break;
                }
            }
        }
        self.current_char == None
    }
}



// =============
// === Tests ===
// =============

// #[cfg(test)]
// fn test_from_repr<T>(repr: &str, elem: T) -> span::With<T> {
//     span::With::new_no_left_offset_no_start(Bytes::from(repr.len()), elem)
// }

#[cfg(test)]
impl<'s> Token<'s> {
    // TODO: Tests only - should be refactored
    // FIXME: shares some code with `to_ident_unchecked` - to be refactored.
    pub fn ident(repr: &'s str) -> Token<'s> {
        let is_free = repr.starts_with('_');
        let lift_level = repr.chars().rev().take_while(|t| *t == '\'').count();
        let span = span::Span {
            left_visible_offset: VisibleOffset::from(0),
            left_offset:         Bytes::from(0),
            len:                 Bytes::from(repr.len()),
        };
        Token { span, elem: source::With::new(repr, token::Type::ident(is_free, lift_level)) }
    }
}


pub fn lexer_main() {
    let mut lexer = Lexer::new("+- foo");
    println!("{:?}", lexer.run());
    println!("{:#?}", lexer.output.iter().collect_vec());
}

#[cfg(test)]
mod tests {
    use super::*;

    // #[test]
    // fn test_case_block() {
    //     test_lexer_many(vec![
    //         ("\n", vec![newline(0, "\n")]),
    //         ("\n  foo\n  bar", vec![
    //             newline(0, "\n"),
    //             block_start(0),
    //             ident(2, "foo"),
    //             newline(0, "\n"),
    //             ident(2, "bar"),
    //         ]),
    //     ]);
    // }


    fn test_lexer_many<'s>(inputs: Vec<(&'s str, Vec<Token<'s>>)>) {
        for (input, output) in inputs {
            test_lexer(input, output)
        }
    }

    macro_rules! lexer_test_ident_stream {
        ($($input:literal)*) => {
            test_lexer_many(vec![ $( ($input, vec![ident(0, $input)]) ),* ])
        };
    }

    fn test_lexer<'s>(input: &'s str, mut expected: Vec<Token<'s>>) {
        let mut lexer = Lexer::new(input);
        // let mut start = Bytes::from(0);
        // for token in &mut expected {
        //     token.span.start = token.span.left_offset + start;
        //     start += token.span.left_offset + token.span.len;
        // }
        // let expected2 = expected.iter().collect_vec();
        let x: &Token<'s> = lexer.output.iter().collect_vec()[0];
        let y: &Token<'s> = &expected[0];

        let x2: &'s str = &x.source;
        let y2: &'s str = &y.source;


        assert_eq!(lexer.run(), true);
        assert_eq!(lexer.output.iter().collect_vec(), expected);
    }

    fn ident<'s>(left_offset: usize, repr: &'s str) -> Token<'s> {
        let is_free = repr.starts_with('_');
        let lift_level = repr.chars().rev().take_while(|t| *t == '\'').count();
        let span = span::Span {
            left_visible_offset: VisibleOffset::from(left_offset),
            left_offset:         Bytes::from(left_offset),
            len:                 Bytes::from(repr.len()),
        };
        let elem = source::With::new(repr, token::Type::ident(is_free, lift_level));
        Token { span, elem }
    }

    fn wildcard<'s>(left_offset: usize, repr: &'s str) -> Token<'s> {
        let lift_level = repr.chars().rev().take_while(|t| *t == '\'').count();
        let span = span::Span {
            left_visible_offset: VisibleOffset::from(left_offset),
            left_offset:         Bytes::from(left_offset),
            len:                 Bytes::from(repr.len()),
        };
        let elem = source::With::new(repr, token::Type::wildcard(lift_level));
        Token { span, elem }
    }

    fn operator<'s>(left_offset: usize, repr: &'s str) -> Token<'s> {
        let span = span::Span {
            left_visible_offset: VisibleOffset::from(left_offset),
            left_offset:         Bytes::from(left_offset),
            len:                 Bytes::from(repr.len()),
        };
        let elem = source::With::new(repr, token::Type::operator());
        Token { span, elem }
    }

    fn newline<'s>(left_offset: usize, repr: &'s str) -> Token<'s> {
        let span = span::Span {
            left_visible_offset: VisibleOffset::from(left_offset),
            left_offset:         Bytes::from(left_offset),
            len:                 Bytes::from(repr.len()),
        };
        let elem = source::With::new(repr, token::Type::newline());
        Token { span, elem }
    }

    // fn block_start<'s>(left_offset: usize) -> Token<'s> {
    //     let span = span::Span {
    //         left_visible_offset: VisibleOffset::from(left_offset),
    //         left_offset:         Bytes::from(left_offset),
    //         start:               Bytes::from(0),
    //         len:                 Bytes::from(0),
    //     };
    //     let elem = source::With::new(repr, token::Type::block_start());
    //     Token { span, elem }
    // }

    #[test]
    fn test_utf_8_idents() {
        test_lexer_many(vec![
            ("", vec![]),
            ("test", vec![ident(0, "test")]),
            ("你好", vec![ident(0, "你好")]),
            ("cześć", vec![ident(0, "cześć")]),
            ("GrüßGott", vec![ident(0, "GrüßGott")]),
            ("Nǐhǎo", vec![ident(0, "Nǐhǎo")]),
            ("hyvääpäivää", vec![ident(0, "hyvääpäivää")]),
            ("Góðandag", vec![ident(0, "Góðandag")]),
            ("Moïen", vec![ident(0, "Moïen")]),
            ("Namastē", vec![ident(0, "Namastē")]),
            ("やあ", vec![ident(0, "やあ")]),
            ("đượchậuđải", vec![ident(0, "đượchậuđải")]),
            ("❤️foo", vec![ident(0, "❤️foo")]),
        ])
    }

    fn iso_idents<'s>(ss: &[&'s str]) -> Vec<(&'s str, Vec<Token<'s>>)> {
        ss.iter().map(|t| iso_ident(t)).collect()
    }

    fn iso_operators<'s>(ss: &[&'s str]) -> Vec<(&'s str, Vec<Token<'s>>)> {
        ss.iter().map(|t| iso_operator(t)).collect()
    }

    fn iso_ident<'s>(s: &'s str) -> (&'s str, Vec<Token<'s>>) {
        (s, vec![ident(0, s)])
    }

    fn iso_operator<'s>(s: &'s str) -> (&'s str, Vec<Token<'s>>) {
        (s, vec![operator(0, s)])
    }

    #[test]
    fn test_case_identifier() {
        test_lexer_many(vec![
            ("", vec![]),
            ("_", vec![wildcard(0, "_")]),
            ("_'", vec![wildcard(0, "_'")]),
            ("_''", vec![wildcard(0, "_''")]),
        ]);
        test_lexer_many(iso_idents(&[
            "a",
            "a'",
            "a''",
            "a'''",
            "_a",
            "_a'",
            "_a''",
            "_a'''",
            "__a",
            "___a",
            "_a_",
            "__a__",
            "_a_b_",
            "Test_Name",
            "Test_Name'",
            "a'b",
            "a'b'",
            "a'b''",
        ]));
        for zero_space in UNICODE_ZERO_SPACES.chars() {
            let var = format!("pre{}post", zero_space);
            test_lexer(&var, vec![ident(0, &var)])
        }
    }

    #[test]
    fn test_case_operator() {
        test_lexer_many(iso_operators(&["+", "-", "=", "==", "==="]));
        test_lexer_many(vec![("+-", vec![operator(0, "+"), operator(0, "-")])]);
    }

    /// Based on https://www.cl.cam.ac.uk/~mgk25/ucs/examples/UTF-8-test.txt.
    /// With additional explanation here:
    /// https://stackoverflow.com/questions/1319022/really-good-bad-utf-8-example-test-data.
    ///
    /// Please note, that there is a comment on StackOverflow:
    /// > I'd warn you his test is based on an outdated definition of UTF-8, when 5 and 6 byte
    /// > sequences were allowed, before planes 17 and above were deleted. And it implies that
    /// > codepoints U+FFFE and U+FFFF are invalid in UTF-8, when per the Unicode consortium
    /// > [they are not](http://www.unicode.org/faq/private_use.html#nonchar8).
    ///
    /// Our test case should check if these codes are correctly parsed as identifiers, so even if
    /// not all cases are covered and some comments in the original document are outdated, these
    /// are still nice test sets.
    #[test]
    fn test_utf8() {
        lexer_test_ident_stream! {
            // === 1. Example correct UTF-8 text. ===

            /* 1.1 The Greek word 'kosme': */ "κόσμε"


            // === 2. Boundary condition test cases. ===

            // 2.1. First possible sequence of a certain length.
            /* 2.1.1. 1 byte  (U-00000000): */  "�"
            /* 2.1.2. 2 bytes (U-00000080): */  ""
            /* 2.1.3. 3 bytes (U-00000800): */  "ࠀ"
            /* 2.1.4. 4 bytes (U-00010000): */  "𐀀"
            /* 2.1.5. 5 bytes (U-00200000): */  "�����"
            /* 2.1.6. 6 bytes (U-04000000): */  "������"

            // 2.2. Last possible sequence of a certain length.
            /* 2.2.1. 1 byte  (U-0000007F): */  ""
            /* 2.2.2. 2 bytes (U-000007FF): */  "߿"
            /* 2.2.3. 3 bytes (U-0000FFFF): */  "￿"
            /* 2.2.4. 4 bytes (U-001FFFFF): */  "����"
            /* 2.2.5. 5 bytes (U-03FFFFFF): */  "�����"
            /* 2.2.6. 6 bytes (U-7FFFFFFF): */  "������"

            // 2.3. Other boundary conditions.
            /* 2.3.1. U-0000D7FF = ed 9f bf = */    "퟿"
            /* 2.3.2. U-0000E000 = ee 80 80 = */    ""
            /* 2.3.3. U-0000FFFD = ef bf bd = */    "�"
            /* 2.3.4. U-0010FFFF = f4 8f bf bf = */ "􏿿"
            /* 2.3.5. U-00110000 = f4 90 80 80 = */ "����"


            // === 3. Malformed sequences ===

            // 3.1. Unexpected continuation bytes.
            /* 3.1.1. First continuation byte 0x80: */ "�"
            /* 3.1.2. Last  continuation byte 0xbf: */ "�"
            /* 3.1.3. 2 continuation bytes:         */ "��"
            /* 3.1.4. 3 continuation bytes:         */ "���"
            /* 3.1.5. 4 continuation bytes:         */ "����"
            /* 3.1.6. 5 continuation bytes:         */ "�����"
            /* 3.1.7. 6 continuation bytes:         */ "������"
            /* 3.1.8. 7 continuation bytes:         */ "�������"
            /* 3.1.9. Sequence of all 64 possible continuation bytes (0x80-0xbf):*/
                "����������������������������������������������������������������"
            // 3.2. Lonely start characters.
            /* 3.2.1. All 32 first bytes of 2-byte sequences (0xc0-0xdf): */
                "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�"
                "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�"
            /* 3.2.2. All 16 first bytes of 3-byte sequences (0xe0-0xef): */
               "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�" "�"
            /* 3.2.3. All 8 first bytes of 4-byte sequences (0xf0-0xf7): */
               "�" "�" "�" "�" "�" "�" "�" "�"
            /* 3.2.4. All 4 first bytes of 5-byte sequences (0xf8-0xfb): */
               "�" "�" "�" "�"
            /* 3.2.5. All 2 first bytes of 6-byte sequences (0xfc-0xfd): */
               "�" "�"

            // 3.3. Sequences with last continuation byte missing.
            /* 3.3.1. 2-byte sequence with last byte missing (U+0000):     */ "�"
            /* 3.3.2. 3-byte sequence with last byte missing (U+0000):     */ "��"
            /* 3.3.3. 4-byte sequence with last byte missing (U+0000):     */ "���"
            /* 3.3.4. 5-byte sequence with last byte missing (U+0000):     */ "����"
            /* 3.3.5. 6-byte sequence with last byte missing (U+0000):     */ "�����"
            /* 3.3.6. 2-byte sequence with last byte missing (U-000007FF): */ "�"
            /* 3.3.7. 3-byte sequence with last byte missing (U-0000FFFF): */ "�"
            /* 3.3.8. 4-byte sequence with last byte missing (U-001FFFFF): */ "���"
            /* 3.3.9. 5-byte sequence with last byte missing (U-03FFFFFF): */ "����"
            /* 3.3.10. 6-byte sequence with last byte missing (U-7FFFFFFF): */ "�����"

            // 3.4. Concatenation of incomplete sequences.
                "�����������������������������"

            // 3.5. Impossible bytes. The following two bytes cannot appear in a correct UTF-8 str:
            /* 3.5.1. fe          = */ "�"
            /* 3.5.2. ff          = */ "�"
            /* 3.5.3. fe fe ff ff = */ "����"


            // === 4. Overlong sequences ===

            // 4.1. Examples of an overlong ASCII character.
            /* 4.1.1. U+002F = c0 af             = */ "��"
            /* 4.1.2. U+002F = e0 80 af          = */ "���"
            /* 4.1.3. U+002F = f0 80 80 af       = */ "����"
            /* 4.1.4. U+002F = f8 80 80 80 af    = */ "�����"
            /* 4.1.5. U+002F = fc 80 80 80 80 af = */ "������"

            // 4.2. Maximum overlong sequences.
            /* 4.2.1  U-0000007F = c1 bf             = */ "��"
            /* 4.2.2  U-000007FF = e0 9f bf          = */ "���"
            /* 4.2.3  U-0000FFFF = f0 8f bf bf       = */ "����"
            /* 4.2.4  U-001FFFFF = f8 87 bf bf bf    = */ "�����"
            /* 4.2.5  U-03FFFFFF = fc 83 bf bf bf bf = */ "������"

            // 4.3. Overlong representation of the NUL character.
            /* 4.3.1  U+0000 = c0 80             = */ "��"
            /* 4.3.2  U+0000 = e0 80 80          = */ "���"
            /* 4.3.3  U+0000 = f0 80 80 80       = */ "����"
            /* 4.3.4  U+0000 = f8 80 80 80 80    = */ "�����"
            /* 4.3.5  U+0000 = fc 80 80 80 80 80 = */ "������"


            // === 5. Illegal code positions ===

            // 5.1. Single UTF-16 surrogates.
            /* 5.1.1  U+D800 = ed a0 80 = */ "���"
            /* 5.1.2  U+DB7F = ed ad bf = */ "���"
            /* 5.1.3  U+DB80 = ed ae 80 = */ "���"
            /* 5.1.4  U+DBFF = ed af bf = */ "���"
            /* 5.1.5  U+DC00 = ed b0 80 = */ "���"
            /* 5.1.6  U+DF80 = ed be 80 = */ "���"
            /* 5.1.7  U+DFFF = ed bf bf = */ "���"

            // 5.2. Paired UTF-16 surrogates.
            /* 5.2.1  U+D800 U+DC00 = ed a0 80 ed b0 80 = */ "������"
            /* 5.2.2  U+D800 U+DFFF = ed a0 80 ed bf bf = */ "������"
            /* 5.2.3  U+DB7F U+DC00 = ed ad bf ed b0 80 = */ "������"
            /* 5.2.4  U+DB7F U+DFFF = ed ad bf ed bf bf = */ "������"
            /* 5.2.5  U+DB80 U+DC00 = ed ae 80 ed b0 80 = */ "������"
            /* 5.2.6  U+DB80 U+DFFF = ed ae 80 ed bf bf = */ "������"
            /* 5.2.7  U+DBFF U+DC00 = ed af bf ed b0 80 = */ "������"
            /* 5.2.8  U+DBFF U+DFFF = ed af bf ed bf bf = */ "������"
        }
    }
}



#[cfg(test)]
mod benches {
    use super::*;
    extern crate test;
    use test::Bencher;

    #[bench]
    fn bench_str_iter(b: &mut Bencher) {
        let reps = 1000_000;
        let str = "test ".repeat(reps);

        b.iter(move || str.chars().for_each(drop));
    }

    #[bench]
    fn bench_str_iter_and_compare(b: &mut Bencher) {
        let reps = 1000_000;
        let str = "test ".repeat(reps);

        b.iter(move || {
            let mut sum = 0;
            str.chars().for_each(|t| {
                if t == 't' {
                    sum += 1;
                }
            })
        });
    }

    /// 12-13x slowdown in comparison to [`bench_str_iter`] and [`bench_str_iter_and_compare`].
    #[bench]
    fn bench_idents(b: &mut Bencher) {
        let reps = 1000_000;
        let str = "test ".repeat(reps);

        b.iter(move || {
            let mut lexer = Lexer::new(&str);
            let ok = lexer.run();
            assert_eq!(ok, true);
            assert_eq!(lexer.output.len(), reps);
        });
    }
}
