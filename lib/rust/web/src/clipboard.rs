//! Clipboard management utilities.

use crate::prelude::*;

use js_sys::Uint8Array;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::prelude::Closure;



// =============
// === Types ===
// =============

pub type MimeType = String;
pub type BinaryData<'a> = &'a [u8];
type ReadTextClosure = Closure<dyn Fn(String)>;
type ReadClosure = Closure<dyn Fn(Vec<u8>)>;



// ===================
// === JS Bindings ===
// ===================

#[wasm_bindgen(module = "/js/clipboard.js")]
extern "C" {
    #[allow(unsafe_code)]
    fn writeText(text: String);

    #[allow(unsafe_code)]
    fn readText(closure: &ReadTextClosure);

    #[allow(unsafe_code)]
    fn writeCustom(mime_type: String, data: Uint8Array);

    #[allow(unsafe_code)]
    fn readCustom(
        expected_mime_type: String,
        when_expected: &ReadClosure,
        plain_text_fallback: &ReadTextClosure,
    );
}

pub fn write(data: BinaryData<'_>, mime_type: MimeType) {
    let data = Uint8Array::from(data);
    writeCustom(mime_type, data);
}

pub fn read(
    expected_mime_type: MimeType,
    when_expected: impl Fn(Vec<u8>) + 'static,
    plain_text_fallback: impl Fn(String) + 'static,
) {
    let when_expected_handler: Rc<RefCell<Option<ReadClosure>>> = default();
    let handler_clone = when_expected_handler.clone_ref();
    let when_expected: ReadClosure = Closure::new(move |result| {
        *handler_clone.borrow_mut() = None;
        when_expected(result);
    });
    *when_expected_handler.borrow_mut() = Some(when_expected);
    let fallback_handler: Rc<RefCell<Option<ReadTextClosure>>> = default();
    let handler_clone = fallback_handler.clone_ref();
    let plain_text_fallback: ReadTextClosure = Closure::new(move |result| {
        *handler_clone.borrow_mut() = None;
        plain_text_fallback(result);
    });
    *fallback_handler.borrow_mut() = Some(plain_text_fallback);
    readCustom(
        expected_mime_type,
        when_expected_handler.borrow().as_ref().unwrap(),
        fallback_handler.borrow().as_ref().unwrap(),
    );
}

/// Write the provided text to the clipboard. Please note that:
/// - It uses the [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
///   under the hood.
/// - This is an asynchronous function. The results will not appear in the clipboard immediately.
///   The delay may be caused for example by waiting for permission from the user.
/// - This will probably display a permission prompt to the user for the first time it is used.
/// - The website has to be served over HTTPS for this function to work correctly.
/// - This function needs to be called from within user-initiated event callbacks, like mouse or key
///   press. Otherwise it will not work.
///
/// Moreover, in case something fails, this function implements a fallback mechanism which tries
/// to create a hidden text field, fill it with the text and use the obsolete
/// [Document.execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
/// function.
///
/// To learn more, see this [StackOverflow question](https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript).
pub fn write_text(text: impl Into<String>) {
    let text = text.into();
    writeText(text)
}

/// Read the text from the clipboard. Please note that:
/// - It uses the [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
///   under the hood.
/// - This is an asynchronous function. The callback with the text will be called when the text will
///   be ready. The delay may be caused for example by waiting for permissions from the user.
/// - This will probably display a permission prompt to the user for the first time it is used.
/// - The website has to be served over HTTPS for this function to work correctly.
/// - This function needs to be called from within user-initiated event callbacks, like mouse or key
///   press. Otherwise it will not work.
///
/// Moreover, this function works in a very strange way in Firefox.
/// [Firefox only supports reading the clipboard in browser extensions](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText).
/// In such case this function fallbacks to the `paste` event. Whenever it is triggered, it
/// remembers its value and passes it to the callback. This means, that in Firefox this function
/// will work correctly only when called as a direct action to the `cmd + v` shortcut.
///
/// To learn more, see this [StackOverflow question](https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript).
pub fn read_text(callback: impl Fn(String) + 'static) {
    let handler: Rc<RefCell<Option<ReadTextClosure>>> = default();
    let handler_clone = handler.clone_ref();
    let closure: ReadTextClosure = Closure::new(move |result| {
        *handler_clone.borrow_mut() = None;
        callback(result);
    });
    *handler.borrow_mut() = Some(closure);
    readText(handler.borrow().as_ref().unwrap());
}
