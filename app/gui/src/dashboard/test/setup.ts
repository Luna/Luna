/**
 * @file Global setup for dashboard tests.
 */

import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import ResizeObserver from 'resize-observer-polyfill'
import { afterEach, expect, vi } from 'vitest'

vi.stubGlobal('ResizeObserver', ResizeObserver)

MotionGlobalConfig.skipAnimations = true

expect.extend(matchers)

afterEach(() => {
  cleanup()
})
