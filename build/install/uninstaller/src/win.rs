use enso_install::prelude::*;

use enso_install::sanitized_electron_builder_config;



pub const FAILED_TO_ACQUIRE_LOCK: &str =
    "Failed to acquire file lock. Is another instance of the installer or uninstaller running?";


/// The parent directory of this (uninstaller) executable.
///
/// This is a good candidate for the install directory of Enso.
fn parent_directory() -> Result<PathBuf> {
    let exe_path = ide_ci::env::current_exe()?;
    exe_path.try_parent().map(Into::into)
}

/// Delete the uninstaller executable.
///
/// This uses the [`self_replace`] crate to delete the executable on Windows. Running executable
/// cannot be deleted on Windows using the ordinary means.
///
/// This must be invoked before deleting the install directory, if the uninstaller is located in the
/// install directory. Otherwise, the executable makes the directory non-deletable.
fn self_delete(parent_path: &Path) -> Result {
    self_replace::self_delete_outside_path(parent_path).with_context(|| {
        format!(
            "Failed to delete the Enso executable. \
            Please delete the file manually: {}",
            parent_path.display()
        )
    })
}

fn handle_error<T>(errors: &mut Vec<anyhow::Error>, result: Result<T>) -> Option<T> {
    match result {
        Err(error) => {
            error!("Encountered an error: {error}.");
            errors.push(error);
            None
        }
        Ok(value) => Some(value),
    }
}

#[tokio::main]
pub async fn main() -> Result {
    let mut errors = vec![];

    handle_error(&mut errors, setup_logging());
    let lock = enso_install::lock().context(FAILED_TO_ACQUIRE_LOCK)?;
    let _guard = lock.lock().context(FAILED_TO_ACQUIRE_LOCK)?;

    let install_dir = parent_directory().unwrap();

    // Make sure that Enso.exe is in the same directory as this installer.
    let executable_filename = enso_install::executable_filename();
    let expected_executable = install_dir.join(&executable_filename);
    let shortcut_name = enso_install::shortcut_name();

    ensure!(
        expected_executable.exists(),
        "{} not found in the presumed install directory: {}",
        executable_filename.display(),
        install_dir.display()
    );

    info!("Remove Add/Remove Programs entry.");
    handle_error(
        &mut errors,
        enso_install::win::uninstall::remove_from_registry(enso_install::uninstall_key()),
    );

    info!("Removing self (uninstaller) executable.");
    handle_error(&mut errors, self_delete(&install_dir));

    info!("Removing install directory.");
    handle_error(&mut errors, ide_ci::fs::remove_dir_if_exists(&install_dir));

    // Remove prog id but leave file extensions - see https://learn.microsoft.com/en-us/windows/win32/shell/fa-file-types#deleting-registry-information-during-uninstallation
    for file_association in &sanitized_electron_builder_config().file_associations {
        let prog_id = &file_association.prog_id;
        info!("Removing ProgID `{prog_id}`.");
        handle_error(&mut errors, enso_install::win::prog_id::delete(prog_id));
    }

    info!("Removing Start Menu entry.");
    handle_error(
        &mut errors,
        enso_install::win::shortcut::Location::Menu.remove_shortcut(shortcut_name),
    );

    info!("Removing Desktop shortcut.");
    handle_error(
        &mut errors,
        enso_install::win::shortcut::Location::Desktop.remove_shortcut(shortcut_name),
    );

    if !errors.is_empty() {
        error!("Encountered {} errors.", errors.len());
        for error in errors {
            error!(" *** {error:?}");
        }
        error!("Uninstallation failed. Some files or registry entries may have been left behind.");
        bail!("Uninstallation failed.");
    } else {
        Ok(())
    }
}
