//! This module implements `World`, the main object responsible for handling what you see on the
//! screen.

pub use crate::display::symbol::types::*;

use crate::prelude::*;

use crate::animation;
use crate::control::callback;
use crate::data::dirty;
use crate::data::dirty::traits::*;
use crate::debug;
use crate::debug::stats::Stats;
use crate::debug::stats::StatsData;
use crate::display;
use crate::display::render;
use crate::display::render::passes::SymbolsRenderPass;
use crate::display::render::*;
use crate::display::scene::DomPath;
use crate::display::scene::Scene;
use crate::system::web;
use crate::system::web::traits::*;

use web::prelude::Closure;
use web::JsCast;
use web::JsValue;



// ================
// === Uniforms ===
// ================

/// Uniforms managed by world.
#[derive(Clone, CloneRef, Debug)]
pub struct Uniforms {
    time:         Uniform<f32>,
    display_mode: Uniform<i32>,
}

impl Uniforms {
    /// Constructor.
    pub fn new(scope: &UniformScope) -> Self {
        let time = scope.add_or_panic("time", 0.0);
        let display_mode = scope.add_or_panic("display_mode", 0);
        Self { time, display_mode }
    }
}



// =============
// === World ===
// =============

/// The root object for EnsoGL scenes.
#[derive(Clone, CloneRef, Debug, Default)]
pub struct World {
    rc: Rc<WorldDataWithLoop>,
}

impl World {
    /// Constructor.
    pub fn new() -> Self {
        Self::default()
    }

    /// Constructor modifier. Displays the default scene in the provided path.
    pub fn displayed_in(self, dom: impl DomPath) -> Self {
        self.default_scene.display_in(dom);
        self
    }

    /// Keeps the world alive even when all references are dropped. Use only if you want to keep one
    /// instance of the world forever.
    pub fn keep_alive_forever(&self) {
        mem::forget(self.clone_ref())
    }
}

impl Deref for World {
    type Target = WorldDataWithLoop;
    fn deref(&self) -> &Self::Target {
        &*self.rc
    }
}

impl display::Object for World {
    fn display_object(&self) -> &display::object::Instance {
        self.default_scene.display_object()
    }
}

impl<'t> From<&'t World> for &'t Scene {
    fn from(world: &'t World) -> Self {
        &world.default_scene
    }
}



// =========================
// === WorldDataWithLoop ===
// =========================

/// World data with a main loop implementation.
///
/// # Main Loop Performance
/// Any code repeated on each iteration of the Main Loop (each "frame") must be written with a high
/// care for performance. Any changes that has a chance of negatively impacting the constant
/// overhead of the main loop needs *explicit* explanation, review, and acceptance *at the design
/// stage* of the proposed new implementation, from performance perspective, with an
/// explicit note of the fact of Main Loop impact.
///
/// Rationale: the "Main Loop" contains the code comprising a GUI rendering "frame" (term
/// originating from a "still frame" term in filmmaking). The speed at which the Main Loop executes
/// directly translates to the perceived performance of the GUI, and the FPS (frames per second)
/// metric, impacting Users' experience with the application.
#[derive(Debug)]
pub struct WorldDataWithLoop {
    main_loop:        animation::DynamicLoop,
    main_loop_handle: callback::Handle,
    data:             WorldData,
}

impl WorldDataWithLoop {
    /// Constructor.
    pub fn new() -> Self {
        let data = WorldData::new();
        let main_loop = animation::DynamicLoop::new();
        let main_loop_handle = main_loop.on_frame(f!([data](t:animation::TimeInfo) {
            let previous_frame_stats = data.stats.begin_frame();
            if let Some(stats) = previous_frame_stats {
                data.on.prev_frame_stats.run_all(&stats);
            }
            data.on.before_frame.run_all(t);
            data.uniforms.time.set(t.local);
            data.scene_dirty.unset_all();
            data.default_scene.update(t);
            data.default_scene.render();
            data.on.after_frame.run_all(t);
            data.stats.end_frame();
        }));
        Self { main_loop, main_loop_handle, data }
    }
}

impl Default for WorldDataWithLoop {
    fn default() -> Self {
        Self::new()
    }
}

impl Deref for WorldDataWithLoop {
    type Target = WorldData;
    fn deref(&self) -> &Self::Target {
        &self.data
    }
}



// =================
// === Callbacks ===
// =================

/// Callbacks that are run during rendering of the frame.
#[derive(Clone, CloneRef, Debug, Default)]
#[allow(missing_docs)]
pub struct Callbacks {
    pub prev_frame_stats: callback::SharedRegistryMut1<StatsData>,
    pub before_frame:     callback::XSharedRegistryMut<(animation::TimeInfo,)>,
    pub after_frame:      callback::XSharedRegistryMut<(animation::TimeInfo,)>,
}



// =================
// === WorldData ===
// =================

/// The data kept by the [`World`].
#[derive(Debug, Clone, CloneRef)]
#[allow(missing_docs)]
pub struct WorldData {
    logger:               Logger,
    pub default_scene:    Scene,
    scene_dirty:          dirty::SharedBool,
    uniforms:             Uniforms,
    stats:                Stats,
    stats_monitor:        debug::monitor::Monitor,
    stats_draw_handle:    callback::Handle,
    pub on:               Callbacks,
    debug_hotkeys_handle: Rc<RefCell<Option<web::EventListenerHandle>>>,
}

impl WorldData {
    /// Create and initialize new world instance.
    pub fn new() -> Self {
        let logger = Logger::new("world");
        let stats = debug::stats::Stats::new(web::window.performance_or_panic());
        let stats_monitor = debug::monitor::Monitor::new();
        let on = Callbacks::default();
        let scene_dirty = dirty::SharedBool::new(Logger::new_sub(&logger, "scene_dirty"), ());
        let on_change = enclose!((scene_dirty) move || scene_dirty.set());
        let default_scene = Scene::new(&logger, &stats, on_change);
        let uniforms = Uniforms::new(&default_scene.variables);
        let debug_hotkeys_handle = default();

        let stats_draw_handle = on.prev_frame_stats.add(f!([stats_monitor] (stats: &StatsData) {
            stats_monitor.sample_and_draw(stats);
        }));

        Self {
            logger,
            default_scene,
            scene_dirty,
            uniforms,
            stats,
            on,
            debug_hotkeys_handle,
            stats_monitor,
            stats_draw_handle,
        }
        .init()
    }

    fn init(self) -> Self {
        self.init_environment();
        self.init_composer();
        self.init_debug_hotkeys();
        self
    }

    fn init_environment(&self) {
        web::forward_panic_hook_to_console();
        web::set_stack_trace_limit();
    }

    fn init_debug_hotkeys(&self) {
        let stats_monitor = self.stats_monitor.clone_ref();
        let display_mode = self.uniforms.display_mode.clone_ref();
        let closure: Closure<dyn Fn(JsValue)> = Closure::wrap(Box::new(move |val| {
            let event = val.unchecked_into::<web::KeyboardEvent>();
            if event.alt_key() && event.ctrl_key() {
                let key = event.code();
                if key == "Backquote" {
                    stats_monitor.toggle()
                } else if key == "Digit0" {
                    display_mode.set(0)
                } else if key == "Digit1" {
                    display_mode.set(1)
                } else if key == "Digit2" {
                    display_mode.set(2)
                }
            }
        }));
        let handle = web::add_event_listener_with_bool(&web::window, "keydown", closure, true);
        *self.debug_hotkeys_handle.borrow_mut() = Some(handle);
    }

    fn init_composer(&self) {
        let mouse_hover_ids = self.default_scene.mouse.hover_ids.clone_ref();
        let mut pixel_read_pass = PixelReadPass::<u8>::new(&self.default_scene.mouse.position);
        pixel_read_pass.set_callback(move |v| {
            mouse_hover_ids.set(Vector4::from_iterator(v.iter().map(|value| *value as u32)))
        });
        // TODO: We may want to enable it on weak hardware.
        // pixel_read_pass.set_threshold(1);
        let logger = Logger::new("renderer");
        let pipeline = render::Pipeline::new()
            .add(SymbolsRenderPass::new(
                &logger,
                &self.default_scene,
                self.default_scene.symbols(),
                &self.default_scene.layers,
            ))
            .add(ScreenRenderPass::new(&self.default_scene))
            .add(pixel_read_pass);
        self.default_scene.set_render_pipeline(pipeline);
    }
}

impl Default for WorldData {
    fn default() -> Self {
        Self::new()
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_compilation_in_test_mode() {
        let _world = World::new().displayed_in("root");
        let _scene = &_world.default_scene;
        assert_eq!(1, 1);
    }
}
