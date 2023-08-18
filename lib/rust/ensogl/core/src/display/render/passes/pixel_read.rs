//! Pass reading pixels from a previously created framebuffer.

use crate::prelude::*;
use crate::system::gpu::*;
use crate::system::js::*;

use crate::display::render::pass;
use crate::display::scene::UpdateStatus;
use crate::system::gpu::context::ContextLost;
use crate::system::gpu::data::texture::TextureOps;

use web_sys::WebGlBuffer;
use web_sys::WebGlFramebuffer;
use web_sys::WebGlSync;


// =========================
// === PixelReadPassData ===
// =========================

/// Internal state for the `PixelReadPass`.
#[derive(Clone, Debug)]
pub struct PixelReadPassData<T: JsTypedArrayItem> {
    buffer:      WebGlBuffer,
    framebuffer: WebGlFramebuffer,
    format:      texture::AnyFormat,
    item_type:   texture::AnyItemType,
    js_array:    JsTypedArray<T>,
}

impl<T: JsTypedArrayItem> PixelReadPassData<T> {
    /// Constructor.
    pub fn new(
        buffer: WebGlBuffer,
        framebuffer: WebGlFramebuffer,
        format: texture::AnyFormat,
        item_type: texture::AnyItemType,
        js_array: JsTypedArray<T>,
    ) -> Self {
        Self { buffer, framebuffer, format, item_type, js_array }
    }
}



// =====================
// === PixelReadPass ===
// =====================

/// Reads the pixel color and stores it in the 'pass_pixel_color' variable.
#[derive(Derivative, Clone)]
#[derivative(Debug)]
pub struct PixelReadPass<T: JsTypedArrayItem> {
    data:            Option<PixelReadPassData<T>>,
    sync:            Option<WebGlSync>,
    position:        Uniform<Vector2<i32>>,
    threshold:       Rc<Cell<usize>>,
    since_last_read: usize,
    #[derivative(Debug = "ignore")]
    callback:        Option<Rc<dyn Fn(Vec<T>)>>,
    #[derivative(Debug = "ignore")]
    sync_callback:   Option<Rc<dyn Fn()>>,
}

impl<T: JsTypedArrayItem> PixelReadPass<T> {
    /// Constructor.
    pub fn new(position: &Uniform<Vector2<i32>>) -> Self {
        let data = default();
        let sync = default();
        let position = position.clone_ref();
        let callback = default();
        let sync_callback = default();
        let threshold = default();
        let since_last_read = 0;
        Self { data, sync, position, threshold, since_last_read, callback, sync_callback }
    }

    /// Sets a callback which will be evaluated after a successful pixel read action.
    ///
    /// Please note that it will not be evaluated after each run of this pass, as the read is
    /// performed in an asynchronous fashion and can take longer than a single frame.
    pub fn set_callback<F: Fn(Vec<T>) + 'static>(&mut self, f: F) {
        self.callback = Some(Rc::new(f));
    }

    /// Sets a callback which will be evaluated after at the beginning of pixel read action.
    ///
    /// It will not be evaluated after each run of this pass as the read is performed in an
    /// asynchronous fashion and can take longer than a single frame.
    pub fn set_sync_callback<F: Fn() + 'static>(&mut self, f: F) {
        self.sync_callback = Some(Rc::new(f));
    }

    /// Returns a reference that can be used to set the threshold of how often the pass should be
    /// run. Threshold of 0 means that it will be run every time. Threshold of N means that it will
    /// be only run every N-th call to the `run` function.
    pub fn get_threshold(&mut self) -> Rc<Cell<usize>> {
        self.threshold.clone()
    }

    /// Initialize the pass data, unless the context is invalid.
    fn try_init(
        &mut self,
        context: &Context,
        variables: &uniform::UniformScopeData,
    ) -> Result<PixelReadPassData<T>, ContextLost> {
        let buffer = context.create_buffer()?;
        let js_array = JsTypedArray::<T>::new_with_length(4);
        let target = Context::PIXEL_PACK_BUFFER;
        let usage = Context::DYNAMIC_READ;
        context.bind_buffer(*target, Some(&buffer));
        context.buffer_data_with_opt_array_buffer(*target, Some(&js_array.buffer()), *usage);
        context.bind_buffer(*target, None);

        let texture = match variables.get("pass_id").unwrap() {
            AnyUniform::Texture(t) => t,
            _ => panic!("Pass internal error. Unmatched types."),
        };
        let format = texture.get_format();
        let item_type = texture.get_item_type();
        let gl_texture = texture.gl_texture(context)?;
        let framebuffer = context.create_framebuffer()?;
        let target = Context::FRAMEBUFFER;
        let texture_target = Context::TEXTURE_2D;
        let attachment_point = Context::COLOR_ATTACHMENT0;
        let gl_texture = Some(&gl_texture);
        let level = 0;
        context.bind_framebuffer(*target, Some(&framebuffer));
        context.framebuffer_texture_2d(
            *target,
            *attachment_point,
            *texture_target,
            gl_texture,
            level,
        );
        context.bind_framebuffer(*target, None);
        let framebuffer_status = context.check_framebuffer_status(*Context::FRAMEBUFFER);
        if framebuffer_status != *Context::FRAMEBUFFER_COMPLETE {
            warn!("Framebuffer incomplete (status: {framebuffer_status}).")
        }
        Ok(PixelReadPassData::new(buffer, framebuffer, format, item_type, js_array))
    }

    #[profile(Detail)]
    fn run_not_synced(&mut self, context: &Context) {
        let data = self.data.as_ref().unwrap();
        let position = self.position.get();
        let width = 1;
        let height = 1;
        let format = data.format.to::<GlEnum>().into();
        let typ = data.item_type.to::<GlEnum>().into();
        let offset = 0;
        context.bind_framebuffer(*Context::FRAMEBUFFER, Some(&data.framebuffer));
        context.bind_buffer(*Context::PIXEL_PACK_BUFFER, Some(&data.buffer));
        context
            .read_pixels_with_i32(position.x, position.y, width, height, format, typ, offset)
            .unwrap();
        context.bind_buffer(*Context::PIXEL_PACK_BUFFER, None);
        let condition = Context::SYNC_GPU_COMMANDS_COMPLETE;
        let flags = 0;
        let sync = context.fence_sync(*condition, flags).unwrap();
        self.sync = Some(sync);
    }

    #[profile(Detail)]
    fn check_and_handle_sync(&mut self, context: &Context, sync: &WebGlSync) {
        let data = self.data.as_ref().unwrap();
        let status = context.get_sync_parameter(sync, *Context::SYNC_STATUS);
        if status == *Context::SIGNALED {
            context.delete_sync(Some(sync));
            self.sync = None;
            let target = Context::PIXEL_PACK_BUFFER;
            let offset = 0;
            let buffer_view = data.js_array.to_object();
            context.bind_buffer(*target, Some(&data.buffer));
            context.get_buffer_sub_data_with_i32_and_array_buffer_view(
                *target,
                offset,
                buffer_view,
            );
            context.bind_buffer(*Context::PIXEL_PACK_BUFFER, None);
            if let Some(f) = &self.callback {
                f(data.js_array.to_vec());
            }
        }
    }
}

impl<T: JsTypedArrayItem> pass::Definition for PixelReadPass<T> {
    fn run(&mut self, instance: &pass::Instance, update_status: UpdateStatus) {
        if self.since_last_read < self.threshold.get() {
            self.since_last_read += 1;
        } else {
            self.since_last_read = 0;
            if self.data.is_none() {
                self.data = self.try_init(&instance.context, &*instance.variables.borrow()).ok();
            }
            if let Some(sync) = self.sync.clone() {
                self.check_and_handle_sync(&instance.context, &sync);
            }
            let need_sync = update_status.scene_was_dirty || update_status.pointer_position_changed;
            if need_sync && self.sync.is_none() {
                self.run_not_synced(&instance.context);
                if let Some(callback) = &self.sync_callback {
                    callback()
                }
            }
        }
    }
}
