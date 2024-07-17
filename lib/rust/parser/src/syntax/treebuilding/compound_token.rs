use enso_prelude::*;

use crate::syntax;
use crate::syntax::consumer::Finish;
use crate::syntax::consumer::TokenConsumer;
use crate::syntax::consumer::TreeConsumer;
use crate::syntax::maybe_with_error;
use crate::syntax::token;
use crate::syntax::GroupHierarchyConsumer;
use crate::syntax::Token;
use crate::syntax::Tree;



// ================================
// === Compound token assembler ===
// ================================

/// Recognizes lexical tokens that are indivisible, and assembles them into trees.
#[derive(Default, Debug)]
pub struct CompoundTokens<'s, Inner> {
    compounding: Option<CompoundToken<'s>>,
    inner:       Inner,
}

impl<'s, Inner: TreeConsumer<'s> + TokenConsumer<'s>> CompoundTokens<'s, Inner> {
    fn try_start(&mut self, token: Token<'s>) {
        match CompoundToken::start(token) {
            StartStep::Start(compounding) => self.compounding = Some(compounding),
            StartStep::RejectButStart(compounding, token) => {
                self.inner.push_token(token);
                self.compounding = Some(compounding)
            }
            StartStep::Reject(token) => self.inner.push_token(token),
        }
    }
}

impl<'s, Inner: TreeConsumer<'s> + TokenConsumer<'s>> TokenConsumer<'s>
    for CompoundTokens<'s, Inner>
{
    fn push_token(&mut self, token: Token<'s>) {
        if let Some(compounding) = self.compounding.take() {
            match compounding.step(token) {
                Step::Complete(tree) => self.inner.push_tree(tree),
                Step::Accept(compounding) => self.compounding = Some(compounding),
                Step::Reject(tree, token) => {
                    self.inner.push_tree(tree);
                    self.try_start(token);
                }
                Step::Return(token) => self.inner.push_token(token),
            }
        } else {
            self.try_start(token);
        }
    }
}

impl<'s, Inner: TreeConsumer<'s>> TreeConsumer<'s> for CompoundTokens<'s, Inner> {
    fn push_tree(&mut self, mut tree: Tree<'s>) {
        match (&mut self.compounding, &mut tree.variant) {
            (
                Some(CompoundToken::TextLiteral(TextLiteralBuilder { elements, .. })),
                syntax::tree::Variant::TextLiteral(box syntax::tree::TextLiteral {
                    open: None,
                    newline: None,
                    elements: rhs_elements,
                    close: None,
                }),
            ) => {
                match rhs_elements.first_mut() {
                    Some(syntax::tree::TextElement::Splice { open, .. }) =>
                        open.left_offset += tree.span.left_offset,
                    _ => unreachable!(),
                }
                elements.append(rhs_elements);
            }
            _ => {
                self.flush();
                self.inner.push_tree(tree);
            }
        }
    }
}

impl<'s, Inner: TreeConsumer<'s>> CompoundTokens<'s, Inner> {
    fn flush(&mut self) {
        if let Some(tree) = self.compounding.take().and_then(|builder| builder.flush()) {
            self.inner.push_tree(tree);
        }
    }
}

impl<'s, Inner: TreeConsumer<'s> + Finish> Finish for CompoundTokens<'s, Inner> {
    type Result = Inner::Result;

    fn finish(&mut self) -> Self::Result {
        self.flush();
        self.inner.finish()
    }
}

impl<'s, Inner> GroupHierarchyConsumer<'s> for CompoundTokens<'s, Inner>
where Inner: TreeConsumer<'s> + GroupHierarchyConsumer<'s>
{
    fn start_group(&mut self, open: token::OpenSymbol<'s>) {
        self.flush();
        self.inner.start_group(open);
    }

    fn end_group(&mut self, close: token::CloseSymbol<'s>) {
        self.flush();
        self.inner.end_group(close);
    }
}


// ==============================
// === Compound token builder ===
// ==============================

trait CompoundTokenBuilder<'s>: Sized {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>>;
    fn step(self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>>;
    fn flush(self) -> Option<Tree<'s>>;
}

enum StartStep<State, Input> {
    Start(State),
    RejectButStart(State, Input),
    Reject(Input),
}

enum Step<State, Input, Output> {
    Accept(State),
    Reject(Output, Input),
    Complete(Output),
    Return(Input),
}

impl<State, Input, Output> Step<State, Input, Output> {
    fn map_state<State2>(self, f: impl FnOnce(State) -> State2) -> Step<State2, Input, Output> {
        match self {
            Step::Accept(state) => Step::Accept(f(state)),
            Step::Reject(input, output) => Step::Reject(input, output),
            Step::Complete(output) => Step::Complete(output),
            Step::Return(input) => Step::Return(input),
        }
    }
}

#[derive(Debug)]
enum CompoundToken<'s> {
    TextLiteral(TextLiteralBuilder<'s>),
    OperatorIdentifier(OperatorIdentifierBuilder),
    Annotation(AnnotationBuilder<'s>),
    Autoscope(AutoscopeBuilder<'s>),
}

impl<State, Input> StartStep<State, Input> {
    fn map_state<State1>(self, f: impl FnOnce(State) -> State1) -> StartStep<State1, Input> {
        match self {
            StartStep::Start(state) => StartStep::Start(f(state)),
            StartStep::RejectButStart(state, input) => StartStep::RejectButStart(f(state), input),
            StartStep::Reject(input) => StartStep::Reject(input),
        }
    }

    fn or_else(self, f: impl FnOnce(Input) -> StartStep<State, Input>) -> StartStep<State, Input> {
        match self {
            StartStep::Start(state) => StartStep::Start(state),
            StartStep::RejectButStart(state, input) => StartStep::RejectButStart(state, input),
            StartStep::Reject(input) => f(input),
        }
    }
}

impl<'s> CompoundTokenBuilder<'s> for CompoundToken<'s> {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>> {
        use CompoundToken::*;
        StartStep::Reject(token)
            .or_else(|token| TextLiteralBuilder::start(token).map_state(TextLiteral))
            .or_else(|token| OperatorIdentifierBuilder::start(token).map_state(OperatorIdentifier))
            .or_else(|token| AnnotationBuilder::start(token).map_state(Annotation))
            .or_else(|token| AutoscopeBuilder::start(token).map_state(Autoscope))
    }

    fn step(self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>> {
        use CompoundToken::*;
        match self {
            TextLiteral(builder) => builder.step(token).map_state(TextLiteral),
            OperatorIdentifier(builder) => builder.step(token).map_state(OperatorIdentifier),
            Annotation(builder) => builder.step(token).map_state(Annotation),
            Autoscope(builder) => builder.step(token).map_state(Autoscope),
        }
    }

    fn flush(self) -> Option<Tree<'s>> {
        use CompoundToken::*;
        match self {
            TextLiteral(builder) => builder.flush(),
            OperatorIdentifier(builder) => builder.flush(),
            Annotation(builder) => builder.flush(),
            Autoscope(builder) => builder.flush(),
        }
    }
}


// =====================
// === Text literals ===
// =====================

#[derive(Debug)]
struct TextLiteralBuilder<'s> {
    open:     token::TextStart<'s>,
    newline:  Option<token::Newline<'s>>,
    elements: Vec<syntax::tree::TextElement<'s>>,
}

impl<'s> CompoundTokenBuilder<'s> for TextLiteralBuilder<'s> {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>> {
        match token.variant {
            token::Variant::TextStart(variant) => {
                let token = token.with_variant(variant);
                StartStep::Start(Self { open: token, newline: default(), elements: default() })
            }
            _ => StartStep::Reject(token),
        }
    }

    fn step(mut self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>> {
        match token.variant {
            token::Variant::TextInitialNewline(_) => {
                let token = token::newline(token.left_offset, token.code);
                self.newline = Some(token);
                Step::Accept(self)
            }
            token::Variant::TextSection(variant) => {
                let token = token.with_variant(variant);
                let element = syntax::tree::TextElement::Section { text: token };
                self.elements.push(element);
                Step::Accept(self)
            }
            token::Variant::TextEscape(variant) => {
                let token = token.with_variant(variant);
                let element = syntax::tree::TextElement::Escape { token };
                self.elements.push(element);
                Step::Accept(self)
            }
            token::Variant::TextNewline(_) => {
                let token = token::newline(token.left_offset, token.code);
                let element = syntax::tree::TextElement::Newline { newline: token };
                self.elements.push(element);
                Step::Accept(self)
            }
            token::Variant::TextEnd(variant) => {
                let close = token.with_variant(variant);
                Step::Complete(self.finish(close))
            }
            _ => unreachable!(),
        }
    }

    fn flush(self) -> Option<Tree<'s>> {
        let Self { open, newline, elements } = self;
        Some(Tree::text_literal(Some(open), newline, elements, None))
    }
}

impl<'s> TextLiteralBuilder<'s> {
    fn finish(self, close: token::TextEnd<'s>) -> Tree<'s> {
        let Self { open, newline, elements } = self;
        if open.code.starts_with('#') {
            assert_eq!(newline, None);
            let doc = syntax::tree::DocComment { open, elements, newlines: default() };
            Tree::documented(doc, default())
        } else {
            let close = if close.code.is_empty() { None } else { Some(close) };
            Tree::text_literal(Some(open), newline, elements, close)
        }
    }
}


// ============================
// === Operator-identifiers ===
// ============================

#[derive(Debug)]
struct OperatorIdentifierBuilder;

impl<'s> CompoundTokenBuilder<'s> for OperatorIdentifierBuilder {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>> {
        match token.variant {
            token::Variant::DotOperator(_) => StartStep::RejectButStart(Self, token),
            _ => StartStep::Reject(token),
        }
    }

    fn step(self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>> {
        match token.variant {
            token::Variant::Operator(_)
            | token::Variant::NegationOperator(_)
            | token::Variant::UnaryOperator(_)
                if token.left_offset.visible.width_in_spaces == 0 =>
                Step::Return(token.with_variant(token::Variant::operator_ident().into())),
            _ => Step::Return(token),
        }
    }

    fn flush(self) -> Option<Tree<'s>> {
        None
    }
}


// ===================
// === Annotations ===
// ===================

#[derive(Debug)]
struct AnnotationBuilder<'s> {
    operator: token::AnnotationOperator<'s>,
}

impl<'s> CompoundTokenBuilder<'s> for AnnotationBuilder<'s> {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>> {
        match token.variant {
            token::Variant::AnnotationOperator(variant) => {
                let operator = token.with_variant(variant);
                StartStep::Start(Self { operator })
            }
            _ => StartStep::Reject(token),
        }
    }

    fn step(self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>> {
        match token.variant {
            token::Variant::Ident(ident) if !token.is_spaced() => {
                let Self { operator } = self;
                let token = token.with_variant(ident);
                Step::Complete(match token.is_type {
                    true => Tree::annotated_builtin(operator, token, vec![], None),
                    false => Tree::annotated(operator, token, None, vec![], None),
                })
            }
            _ => Step::Reject(self.into_error(), token),
        }
    }

    fn flush(self) -> Option<Tree<'s>> {
        Some(self.into_error())
    }
}

impl<'s> AnnotationBuilder<'s> {
    fn into_error(self) -> Tree<'s> {
        let Self { operator } = self;
        token_to_error(operator, "The annotation operator must be applied to an identifier.")
    }
}


// ===================
// === Annotations ===
// ===================

#[derive(Debug)]
struct AutoscopeBuilder<'s> {
    operator: token::AutoscopeOperator<'s>,
}

impl<'s> CompoundTokenBuilder<'s> for AutoscopeBuilder<'s> {
    fn start(token: Token<'s>) -> StartStep<Self, Token<'s>> {
        match token.variant {
            token::Variant::AutoscopeOperator(variant) => {
                let operator = token.with_variant(variant);
                StartStep::Start(Self { operator })
            }
            _ => StartStep::Reject(token),
        }
    }

    fn step(self, token: Token<'s>) -> Step<Self, Token<'s>, Tree<'s>> {
        match token.variant {
            token::Variant::Ident(ident) if !token.is_spaced() => {
                let Self { operator } = self;
                let token = token.with_variant(ident);
                let error = (!token.variant.is_type).then_some(
                    "The auto-scope operator may only be applied to a capitalized identifier.",
                );
                let autoscope_application = Tree::autoscoped_identifier(operator, token);
                Step::Complete(maybe_with_error(autoscope_application, error))
            }
            _ => Step::Reject(self.into_error(), token),
        }
    }

    fn flush(self) -> Option<Tree<'s>> {
        Some(self.into_error())
    }
}

impl<'s> AutoscopeBuilder<'s> {
    fn into_error(self) -> Tree<'s> {
        let Self { operator } = self;
        token_to_error(operator, "The autoscope operator must be applied to an identifier.")
    }
}


// ===============
// === Helpers ===
// ===============

fn token_to_error<'s>(
    token: impl Into<Token<'s>>,
    error: impl Into<Cow<'static, str>>,
) -> Tree<'s> {
    syntax::tree::to_ast(token.into()).with_error(error)
}
