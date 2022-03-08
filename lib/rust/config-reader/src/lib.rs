//! Build Configuration Reader
//!
//! This crate contains an utility for build.rs scripts: the [`generate_config_module_from_yaml`]
//! function, which creates a rust module in OUT_DIR with a set of constants based on given
//! configuration file in YAML format.
//!
//! Keeping configuration in yaml can be useful when the project consists of many parts in different
//! languages.
//!
//! # Example
//!
//! Let assume there is a `config.yaml` file in the parent directory of some crate:
//!
//! ```yaml
//! foo: "bar"
//! bar: "buz"
//! ```
//!
//! To generate a module with configuration, the build script should look as follows:
//! ```no_run
//! use config_reader::generate_config_module_from_yaml;
//!
//! const CONFIG_PATH: &str = "../config.yaml";
//!
//! fn main() {
//!     println!("cargo:rerun-if-changed={}", CONFIG_PATH);
//!     println!("cargo:rerun-if-changed=build.rs");
//!     generate_config_module_from_yaml(CONFIG_PATH);
//! }
//! ```
//!
//! This will generate the following config.rs in the `OUT_DIR`:
//! ```no_run
//! // THIS IS AN AUTOGENERATED FILE BASED ON THE '../config.yaml' CONFIG FILE. DO NOT MODIFY IT.
//! // Generated by the build script in <path-to-crate>
//! pub mod generated {
//!     #[derive(Copy, Clone, Debug)]
//!     pub struct Config {
//!         pub foo: &'static str,
//!         pub bar: &'static str,
//!     }
//!
//!     pub const CONFIG: Config = Config { foo: "bar", bar: "buz" };
//!
//!     #[allow(non_upper_case_globals)]
//!     pub const foo: &str = "bar";
//!     #[allow(non_upper_case_globals)]
//!     pub const bar: &str = "buz";
//! }
//! ```
//!
//! which can be then included in your crate:
//! ```ignore
//! include!(concat!(env!("OUT_DIR"), "/config.rs"));
//!
//! fn main() {
//!     println!("Foo parameter: {}", generated::CONFIG.foo);
//! }

// === Standard Linter Configuration ===
#![deny(unconditional_recursion)]
#![warn(missing_copy_implementations)]
#![warn(missing_debug_implementations)]
#![warn(missing_docs)]
#![warn(trivial_casts)]
#![warn(trivial_numeric_casts)]
#![warn(unsafe_code)]
#![warn(unused_import_braces)]
#![warn(unused_qualifications)]

// === Non-Standard Linter Configuration ===



// === Non-Standard Linter Configuration ===



// === Non-Standard Linter Configuration ===



// === Non-Standard Linter Configuration ===



// === Non-Standard Linter Configuration ===



//
// === Non-Standard Linter Configuration ===



// === Non-Standard Linter Configuration ===



// === Non-standard linter configuration ===



// === Standard linter configuration ===
#![warn(missing_copy_implementations)]#![warn(missing_debug_implementations)]#![warn(missing_docs)]#![warn(trivial_casts)]#![warn(trivial_numeric_casts)]#![warn(unsafe_code)]#![warn(unused_import_braces)]#![warn(unused_qualifications)]
// === Non-standard linter configuration ===

use inflector::*;

use serde_yaml::Value;
use std::fs;



/// Generate module with constants read from given configuration file in YAML format.
///
/// For examples, see the [`crate`] documentation.
///
/// # Panics
///
/// The function may panic when:
/// - `CARGO_MANIFEST_DIR` or `OUT_DIR` env variable is missing.
/// - The provided config file is not in the YAML format.
pub fn generate_config_module_from_yaml(config_path: impl AsRef<std::path::Path>) {
    let f = std::fs::File::open(config_path.as_ref()).unwrap();
    let value: Value = serde_yaml::from_reader(f).unwrap();
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("missing environment variable CARGO_MANIFEST_DIR:");

    let indent = " ".repeat(4);
    let mut def = "".to_string();
    let mut inst = "".to_string();
    let mut vars = "".to_string();
    match value {
        Value::Mapping(mapping) =>
            for (key, value) in mapping {
                let key = key.as_str().unwrap().to_snake_case();
                let value = value.as_str().unwrap();
                def.push_str(&format!("{}pub {}: &'static str,\n", indent, key));
                inst.push_str(&format!("{}{}: \"{}\",\n", indent, key, value));
                vars.push_str(&format!(
                    "#[allow(non_upper_case_globals)]\npub const {}: &str = \"{}\";\n",
                    key, value
                ));
            },
        _ => panic!("Unexpected config format."),
    }

    def = def.trim_end().to_string();
    inst = inst.trim_end().to_string();

    let file = format!(
        r#"// THIS IS AN AUTOGENERATED FILE BASED ON THE '{config_path}' CONFIG FILE. DO NOT MODIFY IT.
// Generated by the build script in {my_path}.

pub mod generated {{

#[derive(Copy, Clone, Debug)]
pub struct Config {{
{def}
}}

pub const CONFIG: Config = Config {{
{inst}
}};

{vars}
}}"#,
        my_path = manifest_dir,
        config_path = config_path.as_ref().display(),
        def = def,
        inst = inst,
        vars = vars
    );
    let out_dir = std::env::var("OUT_DIR").expect("Missing environment variable OUT_DIR.");
    fs::write(out_dir + "/config.rs", file).ok();
}
