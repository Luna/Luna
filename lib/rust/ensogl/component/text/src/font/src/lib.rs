//!

// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
// === Non-Standard Linter Configuration ===
#![allow(clippy::option_map_unit_fn)]
#![allow(clippy::precedence)]
#![allow(dead_code)]
#![deny(unconditional_recursion)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]

/// Commonly used types and functions.
pub mod prelude {
    pub use ensogl_core::prelude::*;
}

use prelude::*;

use ensogl_text_msdf_sys as msdf_sys;
use msdf_sys::Msdf;
use msdf_sys::MsdfParameters;



// ==============
// === Export ===
// ==============

pub mod msdf;



// =======================
// === GlyphRenderInfo ===
// =======================

/// Data used for rendering a single glyph.
///
/// Each distance and transformation values are expressed in normalized coordinates, where
/// (0.0, 0.0) is initial pen position for a character, and `y` = 1.0 is an _ascender_.
///
/// The `offset` and `scale` fields transforms the _base square_ for a character, such the glyph
/// will be rendered correctly with assigned MSDF texture. The _base square_ corners are (0.0, 0.0),
/// (1.0, 1.0).
///
/// For explanation of various font-rendering terms, see the
/// [freetype documentation](https://www.freetype.org/freetype2/docs/glyphs/glyphs-3.html#section-1)
#[derive(Copy, Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GlyphRenderInfo {
    /// An index of glyph in a msdf texture (counted from the top of column). For details, see
    /// msdf::Texture documentation.
    pub msdf_texture_glyph_id: usize,

    /// A required offset of the _base square_. See structure documentation for details.
    pub offset: Vector2<f32>,

    /// A required scale of the _base square_. See structure documentation for details.
    pub scale: Vector2<f32>,

    /// Distance between two successive pen positions for specific glyph.
    pub advance: f32,
}

impl GlyphRenderInfo {
    /// See `MSDF_PARAMS` docs.
    pub const MAX_MSDF_SHRINK_FACTOR: f64 = 4.0;

    /// See `MSDF_PARAMS` docs.
    pub const MAX_MSDF_GLYPH_SCALE: f64 = 2.0;

    /// Parameters used for MSDF generation.
    ///
    /// The range was picked such way, that we avoid fitting range in one rendered pixel.
    /// Otherwise, the antialiasing won't work. I assumed some maximum `shrink factor` (how many
    /// times rendered square will be smaller than MSDF size), and pick an arbitrary maximum glyph
    /// scale up.
    ///
    /// The rest of parameters are the defaults taken from msdfgen library
    pub const MSDF_PARAMS: MsdfParameters = MsdfParameters {
        width: msdf::Texture::WIDTH,
        height: msdf::Texture::ONE_GLYPH_HEIGHT,
        edge_coloring_angle_threshold: 3.0,
        range: Self::MAX_MSDF_SHRINK_FACTOR * Self::MAX_MSDF_GLYPH_SCALE,
        max_scale: Self::MAX_MSDF_GLYPH_SCALE,
        edge_threshold: 1.001,
        overlap_support: true,
    };

    /// Load new [`GlyphRenderInfo`] from msdf_sys font handle. This also extends the atlas with
    /// MSDF generated for this character.
    pub fn load(handle: &msdf_sys::Font, ch: char, atlas: &msdf::Texture) -> Self {
        let unicode = ch as u32;
        let params = Self::MSDF_PARAMS;
        let msdf = Msdf::generate(handle, unicode, &params);
        let inversed_scale = Vector2::new(1.0 / msdf.scale.x, 1.0 / msdf.scale.y);
        let translation = msdf::convert_msdf_translation(&msdf);
        let glyph_id = atlas.rows() / msdf::Texture::ONE_GLYPH_HEIGHT;
        atlas.extend_with_raw_data(msdf.data.iter());
        GlyphRenderInfo {
            msdf_texture_glyph_id: glyph_id,
            offset:                -translation,
            scale:                 Vector2(inversed_scale.x as f32, inversed_scale.y as f32),
            advance:               msdf::x_distance_from_msdf_value(msdf.advance),
        }
    }
}
