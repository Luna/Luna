/** @file A re-export of `build.json` to avoid breakage when moving the path of this module. */

import BUILD_INFO from '../../../build.json' with { type: 'json' }
export default BUILD_INFO
