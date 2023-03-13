/**
 * @file Configuration for the esbuild bundler and build/watch commands.
 *
 * The bundler processes each entry point into a single file, each with no external dependencies and
 * minified. This primarily involves resolving all imports, along with some other transformations
 * (like TypeScript compilation).
 *
 * See the bundlers documentation for more information:
 * https://esbuild.github.io/getting-started/#bundling-for-node
 */

import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'

import * as copyPlugin from 'enso-copy-plugin'
import * as esbuild from 'esbuild'
import * as esbuildPluginAlias from 'esbuild-plugin-alias'
import * as esbuildPluginTime from 'esbuild-plugin-time'
import * as esbuildPluginYaml from 'esbuild-plugin-yaml'
import * as nodeGlobalsPolyfill from '@esbuild-plugins/node-globals-polyfill'
import * as nodeModulesPolyfill from '@esbuild-plugins/node-modules-polyfill'

import * as BUILD_INFO from '../../build.json' assert { type: 'json' }
import * as esbuildWatch from '../../esbuild-watch.js'
import * as utils from '../../utils.js'

export const THIS_PATH = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)))

// =============================
// === Environment variables ===
// =============================

export interface Arguments {
    /** List of files to be copied from WASM artifacts. */
    wasmArtifacts: string
    /** Directory with assets. Its contents are to be copied. */
    assetsPath: string
    /** Path where bundled files are output. */
    outputPath: string
    /** The main JS bundle to load WASM and JS wasm-pack bundles. */
    ensoglAppPath: string
}

/**
 * get arguments from env
 */
export function argumentsFromEnv(): Arguments {
    const wasmArtifacts = utils.requireEnv('ENSO_BUILD_GUI_WASM_ARTIFACTS')
    const assetsPath = utils.requireEnv('ENSO_BUILD_GUI_ASSETS')
    const outputPath = path.resolve(utils.requireEnv('ENSO_BUILD_GUI'), 'assets')
    const ensoglAppPath = utils.requireEnv('ENSO_BUILD_GUI_ENSOGL_APP')
    return { wasmArtifacts, assetsPath, outputPath, ensoglAppPath }
}

// ===================
// === Git process ===
// ===================

/**
 * Get output of a git command.
 * @param command - Command line following the `git` program.
 * @returns Output of the command.
 */
function git(command: string): string {
    // TODO [mwu] Eventually this should be removed, data should be provided by the build script through `BUILD_INFO`.
    //            The bundler configuration should not invoke git, it is not its responsibility.
    return childProcess.execSync(`git ${command}`, { encoding: 'utf8' }).trim()
}

// ==============================
// === Files to manually copy ===
// ==============================

/**
 * Static set of files that are always copied to the output directory.
 */
export function alwaysCopiedFiles(wasmArtifacts: string) {
    return [
        path.resolve(THIS_PATH, 'src', 'index.html'),
        path.resolve(THIS_PATH, 'src', 'run.js'),
        path.resolve(THIS_PATH, 'src', 'style.css'),
        path.resolve(THIS_PATH, 'src', 'docsStyle.css'),
        ...wasmArtifacts.split(path.delimiter),
    ]
}

/**
 * Generator that yields all files that should be copied to the output directory.
 * @yields {string} file path
 */
export async function* filesToCopyProvider(wasmArtifacts: string, assetsPath: string) {
    console.log('Preparing a new generator for files to copy.')
    yield* alwaysCopiedFiles(wasmArtifacts)
    for (const file of await fs.promises.readdir(assetsPath)) {
        yield path.resolve(assetsPath, file)
    }
    console.log('Generator for files to copy finished.')
}

// ================
// === Bundling ===
// ================

/**
 * generate the builder options
 */
export function bundlerOptions(args: Arguments): esbuild.BuildOptions {
    const { outputPath, ensoglAppPath, wasmArtifacts, assetsPath } = args
    return {
        absWorkingDir: THIS_PATH,
        bundle: true,
        entryPoints: [path.resolve(THIS_PATH, 'src', 'index.ts')],
        outdir: outputPath,
        outbase: 'src',
        plugins: [
            esbuildPluginYaml.yamlPlugin({}),
            nodeModulesPolyfill.NodeModulesPolyfillPlugin(),
            nodeGlobalsPolyfill.NodeGlobalsPolyfillPlugin({ buffer: true, process: true }),
            esbuildPluginAlias.default({ ensogl_app: ensoglAppPath }),
            esbuildPluginTime.default(),
            copyPlugin.create(() => filesToCopyProvider(wasmArtifacts, assetsPath)),
        ],
        define: {
            // Disabling naming convention because these are third-party options.
            /* eslint-disable @typescript-eslint/naming-convention */
            GIT_HASH: JSON.stringify(git('rev-parse HEAD')),
            GIT_STATUS: JSON.stringify(git('status --short --porcelain')),
            BUILD_INFO: JSON.stringify(BUILD_INFO),
            /* eslint-enable @typescript-eslint/naming-convention */
        },
        sourcemap: true,
        minify: true,
        metafile: true,
        format: 'esm',
        publicPath: '/assets',
        platform: 'browser',
        incremental: true,
        color: true,
        logOverride: {
            /* eslint-disable @typescript-eslint/naming-convention */
            // Happens in ScalaJS-generated parser (scala-parser.js):
            //    6 │   "fileLevelThis": this
            'this-is-undefined-in-esm': 'silent',
            // Happens in ScalaJS-generated parser (scala-parser.js):
            // 1553 │   } else if ((a === (-0))) {
            'equals-negative-zero': 'silent',
            // Happens in Emscripten-generated MSDF (msdfgen_wasm.js):
            //    1 │ ...typeof module!=="undefined"){module["exports"]=Module}process["o...
            'commonjs-variable-in-esm': 'silent',
            // Happens in Emscripten-generated MSDF (msdfgen_wasm.js):
            //    1 │ ...y{table.grow(1)}catch(err){if(!err instanceof RangeError){throw ...
            'suspicious-boolean-not': 'silent',
            /* eslint-enable @typescript-eslint/naming-convention */
        },
    }
}

/** The basic, common settings for the bundler, based on the environment variables.
 *
 * Note that they should be further customized as per the needs of the specific workflow (e.g. watch vs. build).
 **/
export function bundlerOptionsFromEnv(): esbuild.BuildOptions {
    return bundlerOptions(argumentsFromEnv())
}

/** ESBuild options for spawning a watcher, that will continuously rebuild the package. */
export function watchOptions(onRebuild?: () => void, inject?: esbuild.BuildOptions['inject']) {
    return esbuildWatch.toWatchOptions(bundlerOptionsFromEnv(), onRebuild, inject)
}

/** ESBuild options for bundling (one-off build) the package.
 *
 * Relies on the environment variables to be set.
 */
export function bundleOptions() {
    const ret = bundlerOptionsFromEnv()
    ret.watch = false
    ret.incremental = false
    return ret
}

/**
 * Bundles the package.
 */
export async function bundle() {
    try {
        return esbuild.build(bundleOptions())
    } catch (error) {
        console.error(error)
        throw error
    }
}

export default { watchOptions, bundle, bundleOptions }
