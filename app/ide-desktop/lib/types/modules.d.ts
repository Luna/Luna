/** @file Type definitions for modules that currently don't have typings on DefinitelyTyped.
 *
 * This file MUST NOT `export {}` for the modules to be visible to other files. */

// ===========================
// === Module declarations ===
// ===========================

declare module '*/build.json' {
    /** Version metadata for the current build. */
    interface BuildInfo {
        commit: string
        version: string
        engineVersion: string
        name: string
    }

    const BUILD_INFO: BuildInfo
    export default BUILD_INFO
}

declare module '*/ensogl-pack/linked-dist' {
    // eslint-disable-next-line no-restricted-syntax
    export * from '../../../../lib/rust/ensogl/pack/js/src/runner/index'
}

declare module '*/gui/config.yaml' {
    /** Content of the GUI config file. */
    interface Config {
        windowAppScopeName: string
        windowAppScopeConfigName: string
        windowAppScopeThemeName: string
        projectManagerEndpoint: string
        minimumSupportedVersion: string
        engineVersionSupported: string
        languageEditionSupported: string
    }

    const DATA: Config
    export default DATA
}

declare module '@eslint/js' {
    /** A set of configurations. */
    interface Config {
        rules: Record<string, unknown>
    }

    /** Preset configurations defined by ESLint. */
    interface EslintConfigs {
        all: Config
        recommended: Config
    }

    /** The default export of the module. */
    interface Default {
        configs: EslintConfigs
    }

    const DEFAULT: Default
    export default DEFAULT
}

declare module 'eslint-plugin-jsdoc' {
    const DEFAULT: unknown
    export default DEFAULT
}

declare module 'esbuild-plugin-time' {
    import * as esbuild from 'esbuild'

    export default function (name?: string): esbuild.Plugin
}

declare module 'tailwindcss/nesting/index.js' {
    import * as nested from 'postcss-nested'

    const DEFAULT: nested.Nested
    export default DEFAULT
}

declare module 'create-servers' {
    import * as http from 'node:http'

    /** Configuration options for `create-servers`. */
    interface CreateServersOptions {
        http: number
        handler: http.RequestListener<http.IncomingMessage, http.ServerResponse>
    }

    /** An error passed to a callback when a HTTP request fails. */
    interface HttpError {
        http: string
    }

    export default function (
        option: CreateServersOptions,
        // This is a third-party module which we have no control over.
        // eslint-disable-next-line no-restricted-syntax
        errorHandler: (err: HttpError | undefined) => void
    ): unknown
}

declare module 'wasm_rust_glue' {
    const DEFAULT: unknown
    export default DEFAULT
}
