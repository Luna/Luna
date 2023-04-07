/** @file An esbuild plugin to copy and watch directories. */
import * as fs from 'node:fs/promises'
import * as pathModule from 'node:path'

import * as chokidar from 'chokidar'

// =================
// === Constants ===
// =================

/** The plugin name. */
const NAME = 'copy-directories'
/** The esbuild namespace that the directories that will be copied are given. */
const NAMESPACE = NAME

// This function is required. If narrowing is used instead,
// TypeScript thinks `outputDir` may be `undefined` in functions.
/** @param {string} message - The message with which to throw the `Error`.
 * @returns {never} Always throws an error.
 * @throws {Error} Always. */
function error(message) {
    throw new Error(message)
}

/** An esbuild plugin to copy and watch directories.
 * @param {import('./index').Options} [options] - options.
 * @returns {import('esbuild').Plugin} The esbuild plugin. */
export default function esbuildPluginCopyDirectories(options) {
    const { directoryFilter = /[/\\][^./\\]+$/, log = console.log } = options ?? {}
    return {
        name: NAME,
        setup: build => {
            /** @type {Record<string, true>} */
            const watchingPath = {}
            const outputDir =
                build.initialOptions.outdir ?? error('Output directory must be given.')
            /** @param {string} root - Path to the directory to watch. */
            function continuouslySync(root) {
                const watcher = chokidar.watch(root, { cwd: root })
                /** @param {string} path - Path to the file to be copied. */
                function copy(path) {
                    void (async () => {
                        const source = pathModule.resolve(root, path)
                        const destination = pathModule.join(outputDir, path)
                        log?.(`Copying file '${source}' to '${destination}'.`)
                        await fs.cp(source, destination)
                        log?.(`Copied file '${source}' to '${destination}'.`)
                    })()
                }
                watcher.on('add', copy)
                watcher.on('change', copy)
                watcher.on('unlink', path => {
                    void (async () => {
                        const destination = pathModule.join(outputDir, path)
                        log?.(`Deleting file '${destination}'.`)
                        try {
                            await fs.unlink(destination)
                            log?.(`Deleted file '${destination}'.`)
                        } catch {
                            log?.(`Error deleting file '${destination}'.`)
                        }
                    })()
                })
            }
            build.onResolve({ filter: directoryFilter }, async ({ path, kind }) => {
                if (kind === 'entry-point') {
                    if (!watchingPath[path]) {
                        watchingPath[path] = true
                        const destination = pathModule.join(outputDir, pathModule.basename(path))
                        log?.(`Copying directory '${path}' to '${destination}'.`)
                        await fs.cp(path, destination, {
                            recursive: true,
                            force: true,
                            dereference: true,
                        })
                        log?.(`Copied directory '${path}' to '${destination}'.`)
                        continuouslySync(path)
                    }
                    return { path: '/', namespace: NAMESPACE }
                } else {
                    return null
                }
            })
            build.onLoad({ filter: /(?:)/, namespace: NAMESPACE }, () => ({ contents: '' }))
        },
    }
}
