//! FRP data definition.

use crate::prelude::*;

use crate::data::watch;



// ============
// === Data ===
// ============

/// Data that flows trough the FRP network.
pub trait Data = 'static + Clone + Debug + Default;


// =================
// === HasOutput ===
// =================

/// Implementors of this trait has to know their output type.
#[allow(missing_docs)]
pub trait HasOutput {
    type Output: Data;
}

/// A static version of `HasOutput`.
pub trait HasOutputStatic = 'static + HasOutput;


/// Accessor of the accosiated `Output` type.
pub type Output<T> = <T as HasOutput>::Output;



// ==========
// === Id ===
// ==========

enso_data_structures::define_id!{
    /// Identifier of FRP node. Used mainly for debug purposes.
    #[derive(CloneRef)]
    pub struct Id($);
}

/// Implementors of this trait has to be assigned with an unique Id. All FRP nodes implement it.
#[allow(missing_docs)]
pub trait HasId {
    fn id(&self) -> Id;
}

impl<T: HasId> HasId for watch::Ref<T> {
    fn id(&self) -> Id {
        self.target.id()
    }
}


// =============
// === Label ===
// =============

/// FRP node label. USed mainly for debugging purposes.
pub type Label = &'static str;

/// Implementors of this trait has to be assigned with a label. Each FRP node implements it.
#[allow(missing_docs)]
pub trait HasLabel {
    fn label(&self) -> Label;
}
