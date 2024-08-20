//! Build logic for the GUI project.
//!
//! The GUI is Vue.js-based and located under `app/gui2`.

use crate::prelude::*;

use crate::ide::web::IdeDesktop;
use crate::paths::generated::RepoRootAppGui2Dist;
use crate::paths::generated::RepoRootDistGui2Assets;
use crate::project::Context;
use crate::project::IsArtifact;
use crate::project::IsTarget;
use crate::source::WithDestination;

use ide_ci::ok_ready_boxed;

// ================
// === Artifact ===
// ================

/// The [artifact](IsArtifact) for the new GUI.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Deref)]
pub struct Artifact(pub RepoRootAppGui2Dist);

impl AsRef<Path> for Artifact {
    fn as_ref(&self) -> &Path {
        self.0.as_path()
    }
}

impl IsArtifact for Artifact {}

impl Artifact {
    pub fn new(path: impl AsRef<Path>) -> Self {
        Artifact(RepoRootAppGui2Dist::new_root(path.as_ref()))
    }
}

// ==============
// === Target ===
// ==============

/// The [target](IsTarget) for the new GUI.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Gui;

impl IsTarget for Gui {
    type BuildInput = ();
    type Artifact = Artifact;

    fn artifact_name(&self) -> String {
        "gui".to_owned()
    }

    fn adapt_artifact(self, path: impl AsRef<Path>) -> BoxFuture<'static, Result<Self::Artifact>> {
        ok_ready_boxed(Artifact::new(path))
    }

    fn build_internal(
        &self,
        context: Context,
        job: WithDestination<Self::BuildInput>,
    ) -> BoxFuture<'static, Result<Self::Artifact>> {
        let WithDestination { inner: _, destination } = job;
        async move {
            let repo_root = &context.repo_root;
            crate::ide::web::google_font::install_with_css(
                &context.cache,
                &context.octocrab,
                "mplus1",
                "M PLUS 1",
                "/font-mplus1",
                &repo_root.app.gui_2.public.font_mplus_1,
                &repo_root.app.gui_2.src.assets.font_mplus_1_css,
            )
            .await?;
            crate::ide::web::dejavu_font::install_sans_mono_with_css(
                &context.cache,
                &context.octocrab,
                "/font-dejavu",
                &repo_root.app.gui_2.public.font_dejavu,
                &repo_root.app.gui_2.src.assets.font_dejavu_css,
            )
            .await?;
            crate::ide::web::enso_font::install_with_css(
                &context.cache,
                &context.octocrab,
                "/font-enso",
                &repo_root.app.gui_2.public.font_enso,
                &repo_root.app.gui_2.src.assets.font_enso_css,
            )
            .await?;
            crate::web::install(repo_root).await?;
            crate::web::run_script(repo_root, crate::web::Script::Build).await?;
            ide_ci::fs::mirror_directory(
                &repo_root.app.gui_2.dist,
                &destination.join(RepoRootDistGui2Assets::segment_name()),
            )
            .await?;
            Ok(Artifact::new(destination))
        }
        .boxed()
    }
}

// =================
// === BuildInfo ===
// =================
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildInfo {
    pub commit:         String,
    pub version:        Version,
    pub engine_version: Version,
    pub name:           String,
}

pub fn ide_desktop_from_context(context: &Context) -> IdeDesktop {
    IdeDesktop::new(&context.repo_root, context.octocrab.clone(), context.cache.clone())
}
