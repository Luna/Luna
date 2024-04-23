// === Features ===
#![feature(imported_main)]

use enso_install::prelude::*;


// ==============
// === Export ===
// ==============

#[cfg(windows)]
pub mod win;



#[cfg(windows)]
#[tokio::main]
pub async fn main() -> Result {
    win::main().await
}


#[cfg(not(windows))]
fn main() {
    panic!("Not supported on non-Windows platforms.")
}


#[cfg(test)]
mod tests {
    #[test]
    fn uninstaller_name_matches() {
        // Make sure the uninstaller expected filename matches the package name.
        assert_eq!(enso_install_config::UNINSTALLER_NAME, env!("CARGO_PKG_NAME"));
    }
}
