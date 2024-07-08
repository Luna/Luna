/** @file Configuration for the esbuild bundler and build/watch commands.
 *
 * The bundler processes each entry point into a single file, each with no external dependencies and
 * minified. This primarily involves resolving all imports, along with some other transformations
 * (like TypeScript compilation).
 *
 * See the bundlers documentation for more information:
 * https://esbuild.github.io/getting-started/#bundling-for-node. */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as url from 'node:url'

import * as esbuildPluginNodeModules from '@esbuild-plugins/node-modules-polyfill'
import type * as esbuild from 'esbuild'
import esbuildPluginInlineImage from 'esbuild-plugin-inline-image'
import esbuildPluginTime from 'esbuild-plugin-time'
import esbuildPluginYaml from 'esbuild-plugin-yaml'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindcssNesting from 'tailwindcss/nesting'

import * as appConfig from 'enso-common/src/appConfig'
import * as buildUtils from 'enso-common/src/buildUtils'

import * as tailwindConfig from './tailwind.config'

// =================
// === Constants ===
// =================

const THIS_PATH = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)))

// ====================
// === Global setup ===
// ====================

await appConfig.readEnvironmentFromFile()

// =============================
// === Environment variables ===
// =============================

/** Mandatory build options. */
export interface Arguments {
  /** Path where bundled files are output. */
  readonly outputPath: string
}

/** Get arguments from the environment. */
export function argumentsFromEnv(): Arguments {
  const outputPath = path.resolve(buildUtils.requireEnv('ENSO_BUILD_GUI'), 'assets')
  return { outputPath }
}

// =======================
// === Esbuild plugins ===
// =======================

/** A plugin to process all CSS files with Tailwind CSS. */
export function esbuildPluginGenerateTailwind(): esbuild.Plugin {
  return {
    name: 'enso-generate-tailwind',
    setup: build => {
      const cssProcessor = postcss(
        tailwindcss({
          ...tailwindConfig.default,
          content: tailwindConfig.default.content.map(glob =>
            glob.replace(/^[.][/]/, THIS_PATH + '/')
          ),
        }),
        tailwindcssNesting()
      )
      build.onLoad({ filter: /tailwind\.css$/ }, async loadArgs => {
        const content = await fs.readFile(loadArgs.path, 'utf8')
        const result = await cssProcessor.process(content, {
          from: loadArgs.path,
        })
        return {
          contents: result.content,
          loader: 'css',
          watchFiles: [loadArgs.path],
        }
      })
    },
  }
}

// ================
// === Bundling ===
// ================

/** Generate the bundler options. */
export function bundlerOptions(args: Arguments) {
  const { outputPath } = args
  // This is required to prevent TypeScript from narrowing `true` to `boolean`.
  // eslint-disable-next-line no-restricted-syntax
  const trueBoolean = true as boolean
  const buildOptions = {
    absWorkingDir: THIS_PATH,
    bundle: trueBoolean,
    entryPoints: [path.resolve(THIS_PATH, 'src', 'tailwind.css')],
    outdir: outputPath,
    outbase: 'src',
    loader: {
      /* eslint-disable @typescript-eslint/naming-convention */
      // The `file` loader copies the file, and replaces the import with the path to the file.
      '.png': 'file',
      '.jpg': 'file',
      /* eslint-enable @typescript-eslint/naming-convention */
    },
    plugins: [
      // The CSS file needs to import a single SVG as a data URL.
      // For `bundle.ts` and `watch.ts`, `index.js` also includes various SVG icons
      // which need to be bundled.
      // Depending on file size, choose between `dataurl` and `file` loaders.
      // The `dataurl` loader replaces the import with the file, as a data URL. Using the
      // `file` loader, which copies the file and replaces the import with the path.
      /* eslint-disable @typescript-eslint/naming-convention */
      esbuildPluginInlineImage({ extensions: ['svg'] }),
      esbuildPluginNodeModules.NodeModulesPolyfillPlugin(),
      esbuildPluginTime(),
      // This is not strictly needed because the cloud frontend does not use
      // the Project Manager, however it is very difficult to conditionally exclude a module.
      esbuildPluginYaml.yamlPlugin({}),
      esbuildPluginGenerateTailwind(),
    ],
    alias: {
      '#': './src',
    },
    define: appConfig.getDefines(),
    pure: ['assert'],
    sourcemap: true,
    metafile: trueBoolean,
    format: 'esm',
    platform: 'browser',
    color: trueBoolean,
  } satisfies esbuild.BuildOptions
  // The narrower type is required to avoid non-null assertions elsewhere.
  // The intersection with `esbuild.BuildOptions` is required to allow adding extra properties.
  const correctlyTypedBuildOptions: esbuild.BuildOptions & typeof buildOptions = buildOptions
  return correctlyTypedBuildOptions
}

/** esbuild options for bundling (one-off build) the package.
 *
 * Relies on the environment variables to be set. */
export function bundleOptions() {
  return bundlerOptions(argumentsFromEnv())
}
