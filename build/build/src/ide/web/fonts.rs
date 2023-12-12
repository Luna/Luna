use crate::prelude::*;

use enso_font::NonVariableDefinition;
use enso_font::NonVariableFaceHeader;
use ide_ci::archive::archive::ExtractFiles;
use ide_ci::cache::Cache;



// =========================
// === HTML Font Support ===
// =========================

pub async fn install_html_fonts(
    cache: &Cache,
    octocrab: &Octocrab,
    output_path: impl AsRef<Path>,
) -> Result {
    let output_path = output_path.as_ref();
    crate::ide::web::google_font::install(cache, octocrab, "mplus1", output_path).await?;
    crate::ide::web::enso_font::install_for_html(cache, octocrab, output_path).await?;
    Ok(())
}

pub async fn generate_css_file(
    basepath: &str,
    family: &str,
    definitions: &NonVariableDefinition,
    fonts: impl Iterator<Item = &NonVariableFaceHeader>,
) -> Result<String> {
    let mut css = String::new();
    for header in fonts {
        use std::fmt::Write;
        let def = definitions.get(*header);
        let def = def.ok_or_else(|| {
            anyhow!(
                "Required font not found in {family} Font package. \
                    Expected a font matching: {header:?}."
            )
        })?;
        let file = def.file;
        let weight = def.header.weight.to_number();
        writeln!(&mut css, "@font-face {{")?;
        writeln!(&mut css, "  font-family: '{family}';")?;
        writeln!(&mut css, "  src: url('{basepath}/{file}');")?;
        writeln!(&mut css, "  font-weight: {weight};")?;
        writeln!(&mut css, "  font-style: normal;")?;
        writeln!(&mut css, "}}")?;
        writeln!(&mut css)?;
    }
    Ok(css)
}



// ===================
// === Filter Font ===
// ===================

pub fn filter_font(
    font: &NonVariableDefinition,
    faces: &[NonVariableFaceHeader],
) -> NonVariableDefinition {
    font.variations().filter(|v| faces.contains(&v.header)).collect()
}



// =====================
// === Install Fonts ===
// =====================

pub async fn make_css_file(
    font_family: &str,
    font: &NonVariableDefinition,
    faces: &[NonVariableFaceHeader],
    css_output_info: Option<(&str, impl AsRef<Path>)>,
) -> Result {
    if let Some((css_basepath, css_output_path)) = css_output_info {
        let contents = generate_css_file(css_basepath, font_family, &font, faces.iter()).await?;
        ide_ci::fs::tokio::write(css_output_path, contents).await?;
        Ok(())
    } else {
        Ok(())
    }
}



// =====================
// === Make CSS File ===
// =====================



// =====================
// === Extract Fonts ===
// =====================

/// Extract the fonts from the given archive file, and write them in the given directory.
#[context("Failed to extract fonts from archive {}", package.as_ref().display())]
pub async fn extract_fonts(
    archive: impl ExtractFiles,
    fonts: &NonVariableDefinition,
    package: impl AsRef<Path>,
    out_dir: impl AsRef<Path>,
    normalize_path: &mut impl FnMut(&Path) -> Box<str>,
) -> Result {
    ide_ci::fs::tokio::create_dir_if_missing(out_dir.as_ref()).await?;
    let mut files_expected: HashSet<_> = fonts.files().collect();
    archive
        .extract_files(|path_in_archive| {
            let stripped_path = normalize_path(path_in_archive);
            if files_expected.remove(stripped_path.as_ref()) {
                Some(out_dir.as_ref().join(stripped_path.as_ref()))
            } else {
                None
            }
        })
        .await?;
    ensure!(files_expected.is_empty(), "Required fonts not found in archive: {files_expected:?}.");
    Ok(())
}
