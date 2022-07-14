/** Script that bundles JS client code. */

import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import {NodeModulesPolyfillPlugin} from '@esbuild-plugins/node-modules-polyfill'
import {require_env, require_env_resolved_path} from '../../utils.js'

/////////////////////////////////////////////////
// Constants provided through the environment. //
/////////////////////////////////////////////////

/** Output directory for bundled client files. */
const outdir = path.join(require_env_resolved_path('ENSO_BUILD_IDE'), 'client')

/** Path to the project manager executable relative to the PM bundle root. */
const projectManagerInBundlePath = require_env('ENSO_BUILD_PROJECT_MANAGER_IN_BUNDLE_PATH')

/** Version of the Engine (backend) that is bundled along with this client build. */
const bundledEngineVersion = require_env('ENSO_BUILD_IDE_BUNDLED_ENGINE_VERSION')



////////////////
// Bundling. //
////////////////

const bundlerOptions: esbuild.BuildOptions = {
    bundle: true,
    outdir,
    entryPoints: ['src/index.js', 'src/preload.cjs'],
    outbase: 'src',
    platform: 'node',
    plugins: [
        NodeModulesPolyfillPlugin(),
    ],
    define: {
        BUNDLED_ENGINE_VERSION: JSON.stringify(bundledEngineVersion),
        PROJECT_MANAGER_IN_BUNDLE_PATH: JSON.stringify(projectManagerInBundlePath),
    },
    external: ['emitter'], // Conditionally required dependency only for non-node environment by `batch` package.
}

await esbuild.build(bundlerOptions)
