//! Module for managing the web parts of our codebase.

//! This refers to JS/TS components, such as the Vue.js-based GUI, as well as the Electron client
//! application.


use crate::prelude::*;

use ide_ci::programs::Npm;

/// This method invokes `npm install` in the root repository.
///
/// It ensures that at most one such invocation is running at any given time.
/// If an invocation is already running, it waits for it to finish and then
/// shares its result.
///
/// This method relies on the internal global state. It must not be called multiple times
/// with different `repo_root` arguments.
///
/// It is useful, because otherwise the build script might end up invoking `npm install` multiple
/// times, sometimes even in parallel. Unfortunately, in such cases, `npm` might fail with errors.
pub fn install(repo_root: impl AsRef<Path>) -> BoxFuture<'static, Result> {
    static ONCE: tokio::sync::OnceCell<Result> = tokio::sync::OnceCell::const_new();

    let root_path = repo_root.as_ref().to_owned();
    async move {
        let ret = ONCE
            .get_or_init(async || Npm.cmd()?.with_current_dir(&root_path).install().run_ok().await)
            .await;
        ret.as_ref().copied().map_err(|e| anyhow!("Failed to install NPM dependencies: {e}"))
    }
    .boxed()
}

/// The scripts that can be invoked in the root repository's NPM.
///
/// The list should be kept in sync with the `scripts` section of the root repository's
/// `package.json`.
#[allow(missing_docs)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, strum::AsRefStr)]
#[strum(serialize_all = "kebab-case")]
pub enum Script {
    Format,
    Prettier,
    Lint,
    Test,
    Typecheck,
    CiCheck,
}

/// Invoke the given script in the context of the root repository's NPM.
pub fn run_script(repo_root: impl AsRef<Path>, script: Script) -> BoxFuture<'static, Result> {
    let root_path = repo_root.as_ref().to_owned();
    async move { Npm.cmd()?.with_current_dir(&root_path).run(script.as_ref()).run_ok().await }
        .boxed()
}

/// The list of NPM workspaces that are part of the root repository.
#[derive(Debug, Clone, Copy, PartialEq, Eq, strum::AsRefStr)]
pub enum Workspace {
    #[strum(serialize = "app/ide-desktop")]
    IdeDesktop,
    #[strum(serialize = "app/ide-desktop/lib/src/authentication")]
    Authentication,
    #[strum(serialize = "app/gui2")]
    Gui2,
    #[strum(serialize = "lib/rust/ensogl/pack/js")]
    EnsoGlPack,
}
