//! Display object abstraction and related utilities.

use crate::prelude::*;

use super::scene::layer::ForEachSublayer;


// ==============
// === Export ===
// ==============

pub mod class;
pub mod transform;

pub use class::Any;
pub use class::*;



// ==============
// === Traits ===
// ==============

/// Common traits.
pub mod traits {
    // Read the Rust Style Guide to learn more about the used naming.
    pub use super::Object as TRAIT_Object;
    pub use super::ObjectOps as TRAIT_ObjectOps;
}



// =============================
// === InstanceWithSublayers ===
// =============================

/// A wrapper around [`Instance`] with attached sublayers. It is used for
/// dynamic creation and managing of additional on-demand sublayers needed for various UI
/// components. Sublayers are layers attached to other layers by [`Layer::add_sublayer`] method
/// and used for shapes ordering and masking. See [`Layer`] documentation for more info about
/// sublayers.
///
/// See [`crate::display::scene::layer::MaskingSublayers`] docs for one of the use cases.
///
/// When the [`Instance`] is added to another layer, [`Sublayers::for_each_sublayer`] method of the
/// `sublayers` field will be used to reattach sublayers to this new layer as well. Thus the
/// sublayers are following the [`Instance`] at all times.
#[derive(Debug, Clone, CloneRef, Deref)]
#[clone_ref(bound = "S:CloneRef")]
#[allow(missing_docs)]
pub struct InstanceWithSublayers<S> {
    #[deref]
    instance:      Instance,
    pub sublayers: S,
}

impl<S: CloneRef + ForEachSublayer + 'static> InstanceWithSublayers<S> {
    /// Constructor. Sets a `on_scene_layers_changed` callback for `instance`.
    pub fn new(instance: Instance, sublayers: S) -> Self {
        instance.set_on_scene_layer_changed(f!((_, source, destination) {
            sublayers.for_each_sublayer(|sublayer| {
                for layer in source {
                    layer.remove_sublayer(sublayer);
                }
                for layer in destination {
                    layer.add_sublayer(sublayer);
                }
            });
        }));
        Self { instance, sublayers }
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;

    use crate::application::Application;
    use crate::display::scene::layer::MaskingSublayers;

    #[test]
    fn test_that_sublayers_are_dropped() {
        let app = Application::new("root");
        let logger = &app.logger;
        let camera = &app.display.default_scene.layers.main.camera();
        let display_object = Instance::new(&logger);
        let sublayers = MaskingSublayers::new(logger, camera);
        let display_object = InstanceWithSublayers::new(display_object, sublayers);
        let content_layer = display_object.sublayers.content.downgrade();
        assert!(content_layer.upgrade().is_some());
        drop(display_object);
        assert!(content_layer.upgrade().is_none());
    }
}
