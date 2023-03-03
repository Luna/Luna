//! Pre-seed the cache of MSDF data for fast font rendering.

use enso_prelude::*;
use ensogl_core::system::web::JsCast;
use ensogl_core::system::web::JsValue;
use ensogl_core::system::web::Map;
use ensogl_text::font;
use ensogl_text::font::Font;



// =================
// === Constants ===
// =================

/// The printable characters in the ASCII subset of Unicode. This is the same as the set of keys
/// on a US-ANSI keyboard.
const ASCII_PRINTABLE_CHARS: &str = concat!(
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
);

/// The glyphs to include in the pre-built atlas loaded at application startup.
const PRELOAD_GLYPHS: &[&str] = &[ASCII_PRINTABLE_CHARS];



// =================
// === Interface ===
// =================

/// Build atlas sources, and return as JavaScript data.
pub fn build_atlases() -> JsValue {
    let fonts_to_build = &[font::DEFAULT_FONT_MONO, font::DEFAULT_FONT];
    let fonts = Map::new();
    for font_name in fonts_to_build {
        match build_atlas(font_name) {
            Ok(font) => {
                fonts.set(&font_name.to_string().into(), &font.into());
            }
            Err(e) => error!("Failed to build atlas for font: {e}"),
        }
    }
    fonts.into()
}

/// Load an atlas from JavaScript data.
pub fn set_atlas(font: String, data: HashMap<String, Vec<u8>>) {
    try_set_atlas(font, data).unwrap_or_else(|e| error!("Failed to load font atlas: {e}"));
}

fn try_set_atlas(font: String, mut data: HashMap<String, Vec<u8>>) -> anyhow::Result<()> {
    let atlas = data.remove(ATLAS_FILE).ok_or_else(|| anyhow!("Atlas file not found."))?;
    let metadata = String::from_utf8(
        data.remove(METADATA_FILE).ok_or_else(|| anyhow!("Metadata file not found."))?,
    )?;
    load_atlas(font, atlas, metadata)
}



// ==================
// === Atlas Data ===
// ==================

#[derive(Debug)]
pub struct Atlas {
    atlas:    js_sys::ArrayBuffer,
    metadata: String,
}

const ATLAS_FILE: &str = "atlas.ppm";
const METADATA_FILE: &str = "metadata.json";

impl From<Atlas> for JsValue {
    fn from(value: Atlas) -> Self {
        Map::new()
            .set(&ATLAS_FILE.into(), &value.atlas.into())
            .set(&METADATA_FILE.into(), &value.metadata.into())
            .into()
    }
}

impl TryFrom<JsValue> for Atlas {
    type Error = anyhow::Error;
    fn try_from(value: JsValue) -> anyhow::Result<Self> {
        let map = Map::from(value);
        let atlas = map.get(&ATLAS_FILE.into());
        let metadata = map.get(&METADATA_FILE.into());
        let atlas = atlas.dyn_into().unwrap();
        let metadata = metadata.as_string().unwrap();
        Ok(Self { atlas, metadata })
    }
}



// =======================================
// === Creating Atlases at Build-Time ===
// =======================================

/// Generate MSDF data for a font.
fn build_atlas(name: &str) -> anyhow::Result<Atlas> {
    let fonts = font::Embedded::new();
    let font = fonts.load_font(name.into()).ok_or_else(|| anyhow!("Failed to load font."))?;
    let font = match font {
        Font::NonVariable(font) => font,
        Font::Variable(_) =>
            return Err(anyhow!("Atlas cache pre-seeding for variable fonts is not supported.",)),
    };
    let normal = font::NonVariableFaceHeader::default();
    let mut bold = normal;
    bold.weight = font::Weight::Bold;
    for variation in &[normal, bold] {
        for glyphs in PRELOAD_GLYPHS {
            font.prepare_glyphs(variation, glyphs)
                .unwrap_or_else(|e| error!("Failed to populate cache for font variation: {e}."));
        }
    }
    let cache = font.cache_snapshot();
    let atlas = cache.atlas.encode_ppm();
    let atlas = js_sys::Uint8Array::from(&atlas[..]).buffer();
    let metadata = cache.glyphs;
    Ok(Atlas { atlas, metadata })
}



// =========================================
// === Loading Atlases at Early Run-Time ===
// =========================================

/// Attach the given MSDF data to a font to enable efficient rendering.
fn load_atlas(font: String, atlas: Vec<u8>, glyphs: String) -> anyhow::Result<()> {
    let atlas = enso_bitmap::Image::decode_ppm(&atlas)?;
    let snapshot = Rc::new(font::CacheSnapshot { atlas, glyphs });
    let name = ensogl_text::font::Name::from(font);
    font::PREBUILT_ATLASES.with_borrow_mut(|atlases| atlases.insert(name, snapshot));
    Ok(())
}
