import path from 'node:path'
import fs from 'node:fs/promises'
import {CliOptions, Configuration} from 'electron-builder'
import builder from 'electron-builder'

import { require_env } from '../../utils.js'
import { project_manager_bundle } from './paths.js'
import build from '../../build.json' assert { type: 'json' }

const dist = require_env('ENSO_BUILD_IDE')
const gui = require_env('ENSO_BUILD_GUI')
const icons = require_env('ENSO_BUILD_ICONS')
const project_manager = require_env('ENSO_BUILD_PROJECT_MANAGER')

const config: Configuration = {
    appId: 'org.enso',
    productName: 'Enso',
    extraMetadata: {
        version: build.version,
    },
    copyright: 'Copyright © 2022 ${author}.',
    artifactName: 'enso-${os}-${version}.${ext}',
    mac: {
        // We do not use compression as the build time is huge and file size saving is almost zero.
        target: ['dmg'],
        icon: `${icons}/icon.icns`,
        category: 'public.app-category.developer-tools',
        darkModeSupport: true,
        type: 'distribution',
        // The following settings are required for macOS signing and notarisation.
        // The hardened runtime is required to be able to notarise the application.
        hardenedRuntime: true,
        // This is a custom check that is not working correctly, so we disable it. See for more
        // details https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
        gatekeeperAssess: false,
        // Location of the entitlements files with the entitlements we need to run our application
        // in the hardened runtime.
        entitlements: './entitlements.mac.plist',
        entitlementsInherit: './entitlements.mac.plist',
    },
    win: {
        // We do not use compression as the build time is huge and file size saving is almost zero.
        target: [process.env['ENSO_BUILD_IDE_TARGET'] ?? 'nsis'],
        icon: `${icons}/icon.ico`,
        certificateFile: 'C:\\Users\\mwurb\\Downloads\\New Byte Order Sp. z o.o._cert_49517.p12',
        certificatePassword: '#BJfe2pUeLgEQ9&#',
    },
    linux: {
        // We do not use compression as the build time is huge and file size saving is almost zero.
        target: ['AppImage'],
        icon: `${icons}/png`,
        category: 'Development',
    },
    files: [
        '!**/node_modules/**/*',
        { from: `${gui}/`, to: '.' },
        { from: `${dist}/client`, to: '.' },
    ],
    extraResources: [
        {
            from: `${project_manager}/`,
            to: project_manager_bundle,
            filter: ['!**.tar.gz', '!**.zip'],
        },
    ],
    fileAssociations: [
        {
            ext: 'enso',
            name: 'Enso Source File',
            role: 'Editor',
        },
    ],
    directories: {
        output: `${dist}`,
    },
    nsis: {
        // Disables "block map" generation during electron building. Block maps
        // can be used for incremental package update on client-side. However,
        // their generation can take long time (even 30 mins), so we removed it
        // for now. Moreover, we may probably never need them, as our updates
        // are handled by us. More info:
        // https://github.com/electron-userland/electron-builder/issues/2851
        // https://github.com/electron-userland/electron-builder/issues/2900
        differentialPackage: false,
    },
    dmg: {
        // Disables "block map" generation during electron building. Block maps
        // can be used for incremental package update on client-side. However,
        // their generation can take long time (even 30 mins), so we removed it
        // for now. Moreover, we may probably never need them, as our updates
        // are handled by us. More info:
        // https://github.com/electron-userland/electron-builder/issues/2851
        // https://github.com/electron-userland/electron-builder/issues/2900
        writeUpdateInfo: false,
        // Disable code signing of the final dmg as this triggers an issue
        // with Apple’s Gatekeeper. Since the DMG contains a signed and
        // notarised application it will still be detected as trusted.
        // For more details see step (4) at
        // https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
        sign: false,
    },
    afterAllArtifactBuild: path.join('tasks', 'computeHashes.cjs'),

    // TODO [mwu]: Temporarily disabled, signing should be revised.
    //             In particular, engine should handle signing of its artifacts.
    // afterPack: 'tasks/prepareToSign.js',

    publish: null,

}

// `electron-builder` checks for presence of `node_modules` directory. If it is not present, it will
// install dependencies with `--production` flag (erasing all dev-only dependencies). This does not
// work sensibly with NPM workspaces. We have our `node_modules` in the root directory, not here.
//
// Without this workaround, `electron-builder` will end up erasing its own dependencies and failing
// because of that.
await fs.mkdir('node_modules', { recursive: true })

let cli_opts: CliOptions = {
    config: config,
    targets: builder.Platform.current().createTarget()
}

const result = await builder.build(cli_opts)
console.log("Result:", result)
