export const DEFAULT_ENTRY_POINT = 'ide'

// =============
// === Utils ===
// =============

/** Parses the provided value as boolean. If it was a boolean value, it is left intact. If it was
 * a string 'true' or 'false', it is converted to a boolean value. Otherwise, null is returned. */
// prettier-ignore
function parseBoolean(value: any): boolean | null {
    switch(value) {
        case true: return true
        case false: return false
        case 'true': return true
        case 'false': return false
        default: return null
    }
}

// =============
// === Param ===
// =============

export class Param<T> {
    value: T
    setByUser: boolean = false
    constructor(value: T) {
        this.value = value
    }
}

// ==============
// === Config ===
// ==============

/** The configuration of the EnsoGL application. The options can be overriden by the user. The
 * implementation automatically casts the values to the correct types. For example, if an option
 * override for type boolean was provided as `'true'`, it will be parsed automatically. Moreover,
 * it is possible to extend the provided option list with custom options. See the `extend` method
 * to learn more. */
export class Config {
    /** The URL of the WASM file generated by ensogl-pack. */
    mainWasmUrl: Param<string> = new Param('main.wasm')
    /** The URL of the snippets file generated by ensogl-pack. */
    mainJsUrl: Param<string> = new Param('main.js')
    /** The application entry point. */
    entry: Param<string> = new Param(DEFAULT_ENTRY_POINT)
    /** The EnsoGL theme to be used. */
    theme: Param<string> = new Param('default')
    /** Controls whether the visual loader should be visible on the screen when downloading and
     * compiling WASM sources. By default, the loader is used only if the `entry` is set to
     * `DEFAULT_ENTRY_POINT`. */
    use_loader: Param<boolean> = new Param(true)
    /** The (time needed for WASM download) / (total time including WASM download and WASM app
     * initialization). In case of small WASM apps, this can be set to 1.0. In case of bigger WASM
     * apps, it's desired to show the progress bar growing up to e.g. 70% and leaving the last 30% for WASM app init. */
    loader_download_to_init_ratio: Param<number> = new Param(0.7)
    /** Controls whether the application should be run in the debug mode. In this mode all logs are
     * printed to the console. Otherwise, the logs are hidden unless explicitly shown by calling
     * `showLogs`. */
    debug: Param<boolean> = new Param(false)
    /** The maximum time a before main entry point is allowed to run. After this time, an error will
     * be printed, but the execution will continue. */
    maxBeforeMainEntryPointsTimeMs: number = 3

    constructor(cfg: { overrides: any[] }) {
        for (let override of cfg.overrides) {
            this.updateFromObject(override)
        }
        this.resolve()
    }

    updateFromObject(other: any) {
        if (other) {
            for (let key of Object.keys(this)) {
                let self: any = this
                let otherVal = other[key]
                let selfParam = self[key]
                let selfVal = selfParam.value
                if (otherVal != null) {
                    if (typeof selfVal === 'boolean') {
                        let newVal = parseBoolean(otherVal)
                        if (newVal == null) {
                            this.printValueUpdateError(key, selfVal, otherVal)
                        } else {
                            selfParam.value = newVal
                            selfParam.setByUser = true
                        }
                    } else {
                        selfParam.value = otherVal.toString()
                        selfParam.setByUser = true
                    }
                }
            }
        }
    }

    resolve() {
        if (!this.use_loader.setByUser && this.entry.value !== DEFAULT_ENTRY_POINT) {
            this.use_loader.value = false
        }
    }

    printValueUpdateError(key: string, selfVal: any, otherVal: any) {
        console.error(
            `The provided value for Config.${key} is invalid. Expected boolean, got '${otherVal}'. \
            Using the default value '${selfVal}' instead.`
        )
    }
}
