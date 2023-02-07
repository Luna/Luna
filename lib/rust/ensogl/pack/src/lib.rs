//! EnsoGL Pack compiles Rust sources, precompile shaders of EnsoGL app, and outputs JS WASM loader,
//! additional JS runtime utilities, and a set of optimized shaders. It is a wrapper for `wasm-pack`
//! tool.
//!
//! # Compilation process.
//! When run, the following file tree will be created/used. The files/directories marked with '*'
//! are required to be included with your final application code. The files marked with '**' are
//! recommended to be included.
//!
//! ```text
//! workspace                            | The main workspace directory (repo root).
//! ├─ ... / this_crate                  | This crate's directory.
//! │  ╰─ js                             | This crate's JS sources.
//! │     ├─ runner                      | Runner of WASM app. Compiles to `dist/index.cjs`.
//! │     ├─ runtime-libs                | Additional libs bundled with app. E.g. SpectorJS.
//! │     ├─ shader-extractor            | App to extract shaders from WASM.
//! │     ╰─ wasm-pack-bundle            | Glue for `wasm-pack` artifacts.
//! │        ╰─ index.ts                 | Copied to `target/ensogl-pack/wasm-pack/index.ts`.
//! ╰─ target                            | Directory where Rust and wasm-pack store build artifacts.
//!    ╰─ ensogl-pack                    | Directory where ensogl-pack stores its build artifacts.
//!       ├─ wasm-pack                   | Wasm-pack artifacts, re-created on every run.
//!       │  ├─ pkg.js                   | Wasm-pack JS file to load WASM and glue it with snippets.
//!       │  ├─ pkg_bg.wasm              | Wasm-pack WASM bundle.
//!       │  ├─ index.ts                 | Main file, copied from `this_crate/js/wasm-pack-bundle`.
//!       │  ├─ runtime-libs.js          | Bundled `this_crate/js/runtime-libs`.
//!       │  ╰─ snippets                 | Rust-extracted JS snippets.
//!       │     ╰─ <name>.js             | A single Rust-extracted JS snippet.
//!       ├─ shaders                     | Not optimized shaders sources extracted from WASM bundle.
//!       │  ├─ list.txt                 | List of extracted not optimized shaders (no extensions).
//!       │  ├─ <name>.<stage>.glsl      | A single not optimized shader. (Stage = vertex|fragment).
//!       │  ╰─ ...                    
//!       ├─ shaders-hash                | Not optimized shader hashes. Used to detect changes.
//!       │  ├─ <name>.<stage>.hash      | A single not optimized shader hash.
//!       │  ╰─ ...                    
//!       ├─ runtime-libs
//!       │  ╰─ runtime-libs.js
//!       ╰─ dist                        | Final build artifacts of ensogl-pack.
//!        * ├─ index.cjs                | The main JS bundle to load WASM and JS wasm-pack bundles.
//!          ├─ index.cjs.map            | The sourcemap mapping to sources in TypeScript.
//!       ** ├─ index.d.ts               | TypeScript types interface file.
//!          ├─ shader-extractor.cjs     | Node program to extract non optimized shaders from WASM.
//!          ├─ shader-extractor.cjs.map | The sourcemap mapping to sources in TypeScript.
//!          ├─ shader-extractor.d.ts    | TypeScript types interface file.
//!        * ├─ pkg.js                   | The `pks.js` artifact of wasm-pack WITH bundled snippets.
//!          ├─ pkg.js.map               | The sourcemap mapping to `pkg.js` generated by wasm-pack.
//!        * ├─ pkg.wasm                 | The `pks_bg.wasm` artifact of wasm-pack.
//!        * ╰─ shaders                  | Optimized shaders that contain main function code only.
//!             ├─ list.txt              | List of optimized shaders (no extensions).
//!             ├─ <name>.<stage>.glsl   | A single optimized shader. (Stage = vertex|fragment).
//!             ╰─ ...
//! ```
//!
//! The high-level app compilation process is summarized below:
//!
//! 1. If the `dist/index.cjs` file does not exist, or its modification date is older than
//! `this_crate/js` sources:
//!
//!    1. `npm run install` is run in the `this_crate/js` directory.
//!
//!    2. The `this_crate/js/runner` is compiled to `target/ensogl-pack/dist/index.cjs`. This is the
//!    main file which is capable of loading WASM file, displaying a loading screen, running
//!    before-main entry points, and running the main entry point of the application.
//!
//!    3. The `this_crate/js/shader-extractor` is compiled to
//!    `target/ensogl-pack/dist/shader-extractor.cjs`. This is a node program that extracts
//!    non-optimized shaders from the WASM file.
//!
//!    4. The `this_crate/js/runtime-libs` is compiled to
//!    `target/ensogl-pack/runtime-libs/runtime-libs.js`. This is a bundle containing additional JS
//!    libs, such as SpectorJS.
//!
//! 2. The rust sources are build with `wasm-pack`, which produces the following artifacts:
//! `target/ensogl-pack/wasm-pack/{pkg.js, pkg_bg.wasm, snippets}`. The file `pkg_bg.wasm` is copied
//! to `target/ensogl-pack/dist/pkg.wasm`.
//!
//! 3. The file `this_crate/js/wasm-pack-bundle/index.ts` is copied to
//! `target/ensogl-pack/wasm-pack/index.ts`. This is the main file which when compiled glues
//! `pkg.js`, `snippets`, and `runtime-libs.js` into a single bundle.
//!
//! 4. The program `target/ensogl-pack/dist/shader-extractor.cjs` is run. It loads
//! `target/dist/pkg.wasm` and writes non-optimized shader code to `target/ensogl-pack/shaders`.
//!
//! 5. For each shader, the hash of its code is computed and compared to the hash stored in
//! `target/ensogl-pack/shaders-hash`. If the hash did not exist or is different, the shader is
//! optimized by using `glslc`, spirv-opt`, and `spirv-cross`, and the result is written to
//! `dist/shaders`.
//!
//! 6. The `target/ensogl-pack/wasm-pack/index.ts` is compiled to
//! `target/ensogl-pack/dis/index.cjs`. It is then compiled to `target/ensogl-pack/dist/index.cjs`.
//!
//!
//!
//! # Runtime process.
//! When `target/dist/index.cjs` is run:
//!
//! 1. The following files are downloaded from a server: `target/dist/{pkg.js, pkg.wasm, shaders}`.
//! 2. The code from `pkg.js` is run to compile the WASM file.
//! 3. All before-main entry points are run.
//! 4. Optimized shaders are uploaded to the EnsoGL application.
//! 5. The main entry point is run.

// === Features ===
#![feature(async_closure)]
// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]
#![allow(clippy::bool_to_int_with_if)]
#![allow(clippy::let_and_return)]

use ide_ci::prelude::*;

use enso_prelude::calculate_hash;
use ide_ci::program::EMPTY_ARGS;
use ide_ci::programs::shaderc::Glslc;
use ide_ci::programs::shaderc::SpirvOpt;
use ide_ci::programs::spirv_cross::SpirvCross;
use ide_ci::programs::wasm_pack::WasmPackCommand;
use manifest_dir_macros::path;
use std::env;
use std::path::Path;
use std::path::PathBuf;
use walkdir::WalkDir;


// ==============
// === Export ===
// ==============

pub use ide_ci::prelude;



// =================
// === Hot Fixes ===
// =================

/// A hot-fix for a bug on macOS, where `std::fs::copy` causes cargo-watch to loop infinitely.
/// See: https://github.com/watchexec/cargo-watch/issues/242
pub fn copy(source_file: impl AsRef<Path>, destination_file: impl AsRef<Path>) -> Result {
    if env::consts::OS == "macos" {
        Command::new("cp").arg(source_file.as_ref()).arg(destination_file.as_ref()).spawn()?;
        Ok(())
    } else {
        ide_ci::fs::copy(source_file, destination_file)
    }
}



// =============
// === Paths ===
// =============

/// Paths of the directories and files used by `ensogl-pack`. This struct maps to variables the
/// directory layout described in the docs of this module.
#[derive(Debug, Default)]
#[allow(missing_docs)]
pub struct Paths {
    pub workspace:  PathBuf,
    pub this_crate: paths::ThisCrate,
    pub target:     paths::Target,
}

macro_rules! define_paths {
    ($(
        $name:ident {
            $($field:ident : $field_ty:ty),* $(,)?
        }
    )*) => {$(
        #[derive(Debug, Default)]
        #[allow(missing_docs)]
        pub struct $name {
            pub root: PathBuf,
            $( pub $field: $field_ty ),*
        }

        impl Deref for $name {
            type Target = PathBuf;
            fn deref(&self) -> &Self::Target {
                &self.root
            }
        }

        impl AsRef<std::path::Path> for $name {
            fn as_ref(&self) -> &std::path::Path {
                &self.root
            }
        }

        impl AsRef<OsStr> for $name {
            fn as_ref(&self) -> &OsStr {
                self.root.as_ref()
            }
        }
    )*};
}

pub mod paths {
    use super::*;
    define_paths! {
        ThisCrate {
            js: ThisCrateJs,
        }

        ThisCrateJs {
            wasm_pack_bundle: ThisCrateJsWasmPackBundle,
        }

        ThisCrateJsWasmPackBundle {
            index: PathBuf
        }

        Target {
            ensogl_pack: TargetEnsoglPack,
        }

        TargetEnsoglPack {
            wasm_pack:    TargetEnsoglPackWasmPack,
            shaders:      TargetEnsoglPackShaders,
            shaders_hash: PathBuf,
            runtime_libs: TargetEnsoglPackRuntimeLibs,
            dist:         TargetEnsoglPackDist,
        }

        TargetEnsoglPackShaders {
            list: PathBuf,
        }

        TargetEnsoglPackRuntimeLibs {
            runtime_libs: PathBuf,
        }

        TargetEnsoglPackWasmPack {
            index: PathBuf,
            pkg_bg: PathBuf,
            pkg_js: PathBuf,
            runtime_libs: PathBuf,
        }

        TargetEnsoglPackDist {
            app:              PathBuf,
            shader_extractor: PathBuf,
            pkg_js:          PathBuf,
            main_wasm:        PathBuf,
            shaders:          TargetEnsoglPackDistShaders,
        }

        TargetEnsoglPackDistShaders {
            list: PathBuf,
        }
    }
}

const WASM_PACK_OUT_NAME: &str = "pkg";

impl Paths {
    pub async fn new() -> Result<Self> {
        let mut p = Paths::default();
        let current_cargo_path = Path::new(path!("Cargo.toml"));
        p.this_crate.root = current_cargo_path.try_parent()?.into();
        p.this_crate.js.root = p.this_crate.join("js");
        p.this_crate.js.wasm_pack_bundle.root =
            p.this_crate.js.root.join("src").join("wasm-pack-bundle");
        p.this_crate.js.wasm_pack_bundle.index = p.this_crate.js.wasm_pack_bundle.join("index.ts");
        p.workspace = workspace_dir().await?;
        p.target.root = p.workspace.join("target");
        p.target.ensogl_pack.root = p.target.join("ensogl-pack");
        p.target.ensogl_pack.wasm_pack.root = p.target.ensogl_pack.join("wasm-pack");
        let pkg_wasm = format!("{WASM_PACK_OUT_NAME}_bg.wasm");
        let pkg_js = format!("{WASM_PACK_OUT_NAME}.js");
        p.target.ensogl_pack.wasm_pack.index = p.target.ensogl_pack.wasm_pack.join("index.ts");
        p.target.ensogl_pack.wasm_pack.pkg_bg = p.target.ensogl_pack.wasm_pack.join(pkg_wasm);
        p.target.ensogl_pack.wasm_pack.pkg_js = p.target.ensogl_pack.wasm_pack.join(pkg_js);
        p.target.ensogl_pack.wasm_pack.runtime_libs =
            p.target.ensogl_pack.wasm_pack.join("runtime-libs.js");
        p.target.ensogl_pack.shaders.root = p.target.ensogl_pack.join("shaders");
        p.target.ensogl_pack.shaders.list = p.target.ensogl_pack.shaders.join("list.txt");
        p.target.ensogl_pack.shaders_hash = p.target.ensogl_pack.join("shaders-hash");
        p.target.ensogl_pack.runtime_libs.root = p.target.ensogl_pack.join("runtime-libs");
        p.target.ensogl_pack.runtime_libs.runtime_libs =
            p.target.ensogl_pack.runtime_libs.join("runtime-libs.js");
        p.target.ensogl_pack.dist.root = p.target.ensogl_pack.join("dist");
        p.target.ensogl_pack.dist.app = p.target.ensogl_pack.dist.join("index.cjs");
        p.target.ensogl_pack.dist.shader_extractor =
            p.target.ensogl_pack.dist.join("shader-extractor.cjs");
        p.target.ensogl_pack.dist.pkg_js = p.target.ensogl_pack.dist.join("pkg.js");
        p.target.ensogl_pack.dist.main_wasm = p.target.ensogl_pack.dist.join("pkg.wasm");
        p.target.ensogl_pack.dist.shaders.root = p.target.ensogl_pack.dist.join("shaders");
        p.target.ensogl_pack.dist.shaders.list = p.target.ensogl_pack.dist.shaders.join("list.txt");
        Ok(p)
    }
}

pub async fn workspace_dir() -> Result<PathBuf> {
    use ide_ci::programs::cargo;
    use ide_ci::programs::Cargo;
    let output = Cargo
        .cmd()?
        .apply(&cargo::Command::LocateProject)
        .apply(&cargo::LocateProjectOption::Workspace)
        .apply(&cargo::LocateProjectOption::MessageFormat(cargo::MessageFormat::Plain))
        .output_ok()
        .await?
        .into_stdout_string()?;
    let cargo_path = Path::new(output.trim());
    Ok(cargo_path.try_parent()?.to_owned())
}


// =============
// === Build ===
// =============

/// The arguments to `wasm-pack build` that `ensogl-pack` wants to customize.
pub struct WasmPackOutputs {
    /// Value to passed as `--out-dir` to `wasm-pack`.
    pub out_dir:  PathBuf,
    /// Value to passed as `--out-name` to `wasm-pack`.
    pub out_name: String,
}

/// Check the modification time of all files in this crate's `js` directory and compare them with
/// the modification time of dist artifacts, if any. Do not traverse `node_modules` directory.
fn check_if_ts_needs_rebuild(paths: &Paths) -> Result<bool> {
    let walk = WalkDir::new(&paths.this_crate.js).into_iter();
    let walk_no_node_modules = walk.filter_entry(|e| e.file_name() != "node_modules");
    let mut newest_mod_time: Option<std::time::SystemTime> = None;
    for opt_entry in walk_no_node_modules {
        let entry = opt_entry?;
        if entry.file_type().is_file() {
            let metadata = entry.metadata()?;
            let mod_time = metadata.modified()?;
            newest_mod_time = Some(newest_mod_time.map_or(mod_time, |t| t.max(mod_time)));
        }
    }
    if let Ok(app_js_metadata) = std::fs::metadata(&paths.target.ensogl_pack.dist.app) {
        let app_js_mod_time = app_js_metadata.modified()?;
        Ok(newest_mod_time.map_or(true, |t| t > app_js_mod_time))
    } else {
        Ok(true)
    }
}

/// Compile TypeScript sources of this crate in case they were not compiled yet.
async fn compile_this_crate_ts_sources(paths: &Paths) -> Result<()> {
    println!("compile_this_crate_ts_sources");
    if check_if_ts_needs_rebuild(paths)? {
        info!("EnsoGL Pack TypeScript sources changed, recompiling.");
        ide_ci::programs::Npm.cmd()?.install().current_dir(&paths.this_crate.js).run_ok().await?;
        let run_script = async move |script_name, script_args: &[&str]| {
            ide_ci::programs::Npm
                .cmd()?
                .run(script_name, script_args)
                .current_dir(&paths.this_crate.js)
                .run_ok()
                .await
        };

        info!("Linting TypeScript sources.");
        run_script("lint", &EMPTY_ARGS).await?;

        info!("Building TypeScript sources.");
        let args = ["--", &format!("--out-dir={}", paths.target.ensogl_pack.dist.display())];
        run_script("build", &args).await?;
        let args = ["--", &format!("--out-dir={}", paths.target.ensogl_pack.dist.display())];
        run_script("build-shader-extractor", &args).await?;
        println!("BUILD build-runtime-libs");
        let args = ["--", &format!("--outdir={}", paths.target.ensogl_pack.runtime_libs.display())];
        run_script("build-runtime-libs", &args).await?;
    } else {
        println!("NO BUILD");
    }
    Ok(())
}

/// Run wasm-pack to build the wasm artifact.
pub async fn run_wasm_pack(
    paths: &Paths,
    provider: impl FnOnce(WasmPackOutputs) -> Result<WasmPackCommand>,
) -> Result<()> {
    info!("Obtaining and running the wasm-pack command.");
    let replaced_args = WasmPackOutputs {
        out_dir:  paths.target.ensogl_pack.wasm_pack.root.clone(),
        out_name: WASM_PACK_OUT_NAME.to_string(),
    };
    let mut command = provider(replaced_args).context("Failed to obtain wasm-pack command.")?;
    command.run_ok().await?;

    copy(&paths.this_crate.js.wasm_pack_bundle.index, &paths.target.ensogl_pack.wasm_pack.index)?;
    copy(
        &paths.target.ensogl_pack.runtime_libs.runtime_libs,
        &paths.target.ensogl_pack.wasm_pack.runtime_libs,
    )?;

    compile_wasm_pack_artifacts(
        &paths.target.ensogl_pack.wasm_pack,
        &paths.target.ensogl_pack.wasm_pack.index,
        &paths.target.ensogl_pack.dist.pkg_js,
    )
    .await?;
    ide_ci::fs::copy(
        &paths.target.ensogl_pack.wasm_pack.pkg_bg,
        &paths.target.ensogl_pack.dist.main_wasm,
    )
}

/// Compile wasm-pack artifacts (JS sources and snippets) to a single bundle.
async fn compile_wasm_pack_artifacts(pwd: &Path, pkg_js: &Path, out: &Path) -> Result {
    info!("Compiling {}.", pkg_js.display());
    ide_ci::programs::Npx
        .cmd()?
        .args([
            "--yes",
            "esbuild",
            pkg_js.display().to_string().as_str(),
            "--format=cjs",
            "--bundle",
            "--sourcemap",
            "--platform=node",
            &format!("--outfile={}", out.display()),
        ])
        .current_dir(pwd)
        .run_ok()
        .await
}

/// Extract non-optimized shaders from the WASM artifact.
async fn extract_shaders(paths: &Paths) -> Result<()> {
    info!("Extracting shaders from generated WASM file.");
    ide_ci::programs::Node
        .cmd()?
        .arg(&paths.target.ensogl_pack.dist.shader_extractor)
        .arg("--out-dir")
        .arg(&paths.target.ensogl_pack.shaders)
        .run_ok()
        .await
}

/// Optimize the extracted shaders by using `glslc`, `spirv-opt` and `spirv-cross`.
async fn optimize_shaders(paths: &Paths) -> Result<()> {
    info!("Optimizing extracted shaders.");
    ide_ci::fs::create_dir_if_missing(&paths.target.ensogl_pack.dist.shaders)?;

    let stages = ["vertex", "fragment"];
    let shaders_list = ide_ci::fs::read_to_string(&paths.target.ensogl_pack.shaders.list)?;
    let shaders_prefixes: Vec<_> = shaders_list.lines().collect();
    for shader_prefix in shaders_prefixes {
        info!("Optimizing '{shader_prefix}'.");
        for stage in stages {
            let base_path = paths.target.ensogl_pack.shaders.join(shader_prefix);
            let base_path = base_path.display();
            let stage_path = format!("{base_path}.{stage}");
            let glsl_path = stage_path.with_appended_extension("glsl");
            let spv_path = stage_path.with_appended_extension("spv");
            let spv_opt_path = stage_path.with_appended_extension("opt.spv");
            let glsl_opt_path = stage_path.with_appended_extension("opt.glsl");
            let glsl_file_name = format!("{shader_prefix}.{stage}.glsl");
            let hash_file_name = format!("{shader_prefix}.{stage}.hash");
            let glsl_opt_dist_path = paths.target.ensogl_pack.dist.shaders.join(&glsl_file_name);
            let hash_path = paths.target.ensogl_pack.shaders_hash.join(&hash_file_name);
            let content = ide_ci::fs::read_to_string(&glsl_path)?;
            let old_hash = ide_ci::fs::read_to_string(&hash_path).ok();
            let hash = calculate_hash(&content).to_string();
            if let Some(old_hash) = old_hash {
                if old_hash == hash {
                    info!("Skipping '{shader_prefix}.{stage}' because it has not changed.");
                    continue;
                }
            }
            ide_ci::fs::write(&hash_path, hash)?;

            let spv_path = spv_path.as_str();
            let glsl_path = glsl_path.as_str();
            let shader_stage = &format!("-fshader-stage={stage}");
            let glslc_args = ["--target-env=opengl", shader_stage, "-o", spv_path, glsl_path];
            let spirv_opt_args = ["-O", "-o", spv_opt_path.as_str(), spv_path.as_str()];
            let spirv_cross_args = ["--output", glsl_opt_path.as_str(), spv_opt_path.as_str()];
            Glslc.cmd()?.args(glslc_args).run_ok().await?;
            SpirvOpt.cmd()?.args(spirv_opt_args).run_ok().await?;
            SpirvCross.cmd()?.args(spirv_cross_args).run_ok().await?;

            let content = ide_ci::fs::read_to_string(&glsl_opt_path)?.replace("\r\n", "\n");
            let extract_err = || format!("Failed to process shader '{}'.", glsl_opt_path.as_str());
            let code = extract_main_shader_code(&content).with_context(extract_err)?;
            ide_ci::fs::write(&glsl_opt_dist_path, code)?;
        }
    }
    ide_ci::fs::write(&paths.target.ensogl_pack.dist.shaders.list, &shaders_list)
}

/// Read the optimized shader code, extract the main function body and preserve all top-level
/// variable declarations.
fn extract_main_shader_code(code: &str) -> Result<String> {
    let main_start_str = "void main()\n{";
    let main_end_str = "}";
    let main_fn_find_err = "Failed to find main function.";
    let main_start = code.find(main_start_str).with_context(|| main_fn_find_err)?;
    let main_end = code.rfind(main_end_str).with_context(|| main_fn_find_err)?;
    let before_main = &code[..main_start];
    let declarations: Vec<&str> = before_main
        .lines()
        .filter_map(|line| {
            let version_def = line.starts_with("#version ");
            let precision_def = line.starts_with("precision ");
            let layout_def = line.starts_with("layout(");
            let def = version_def || precision_def || layout_def;
            (!def).then_some(line)
        })
        .collect();
    let declarations = declarations.join("\n");
    let main_content = &code[main_start + main_start_str.len()..main_end];
    Ok(format!("{declarations}\n{main_content}"))
}

/// Wrapper over `wasm-pack build` command.
///
/// # Arguments
/// * `outputs` - The outputs that'd be usually given to `wasm-pack build` command.
/// * `provider` - Function that generates an invocation of the `wasm-pack build` command that has
///   applied given (customized) output-related arguments.
pub async fn build(
    outputs: WasmPackOutputs,
    provider: impl FnOnce(WasmPackOutputs) -> Result<WasmPackCommand>,
) -> Result {
    // FIXME: [mwu] To be removed, when shader tools are properly handled as a goodie-thingy.
    let _ = ide_ci::env::prepend_to_path(r"C:\varia\install\bin");
    let paths = Paths::new().await?;
    compile_this_crate_ts_sources(&paths).await?;
    run_wasm_pack(&paths, provider).await?;
    extract_shaders(&paths).await?;
    optimize_shaders(&paths).await?;
    let out_dir = Path::new(&outputs.out_dir);
    ide_ci::fs::copy(&paths.target.ensogl_pack.dist, out_dir)
}
