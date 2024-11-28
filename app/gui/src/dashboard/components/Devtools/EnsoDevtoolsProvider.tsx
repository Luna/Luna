/**
 * @file
 * This file provides a zustand store that contains the state of the Enso devtools.
 */
import type { PaywallFeatureName } from '#/hooks/billing'
import * as zustand from '#/utilities/zustand'
import { IS_DEV_MODE } from 'enso-common/src/detect'
import { MotionGlobalConfig } from 'framer-motion'

/** Configuration for a paywall feature. */
export interface PaywallDevtoolsFeatureConfiguration {
  readonly isForceEnabled: boolean | null
}

// =========================
// === EnsoDevtoolsStore ===
// =========================

/** The state of this zustand store. */
interface EnsoDevtoolsStore {
  readonly showDevtools: boolean
  readonly setShowDevtools: (showDevtools: boolean) => void
  readonly toggleDevtools: () => void
  readonly showVersionChecker: boolean | null
  readonly paywallFeatures: Record<PaywallFeatureName, PaywallDevtoolsFeatureConfiguration>
  readonly setPaywallFeature: (feature: PaywallFeatureName, isForceEnabled: boolean | null) => void
  readonly setEnableVersionChecker: (showVersionChecker: boolean | null) => void
  readonly animationsDisabled: boolean
  readonly setAnimationsDisabled: (animationsDisabled: boolean) => void
}

export const ensoDevtoolsStore = zustand.createStore<EnsoDevtoolsStore>((set) => ({
  showDevtools: IS_DEV_MODE,
  setShowDevtools: (showDevtools) => {
    set({ showDevtools })
  },
  toggleDevtools: () => {
    set(({ showDevtools }) => ({ showDevtools: !showDevtools }))
  },
  showVersionChecker: false,
  paywallFeatures: {
    share: { isForceEnabled: null },
    shareFull: { isForceEnabled: null },
    userGroups: { isForceEnabled: null },
    userGroupsFull: { isForceEnabled: null },
    inviteUser: { isForceEnabled: null },
    inviteUserFull: { isForceEnabled: null },
  },
  setPaywallFeature: (feature, isForceEnabled) => {
    set((state) => ({
      paywallFeatures: { ...state.paywallFeatures, [feature]: { isForceEnabled } },
    }))
  },
  setEnableVersionChecker: (showVersionChecker) => {
    set({ showVersionChecker })
  },
  animationsDisabled: localStorage.getItem('disableAnimations') === 'true',
  setAnimationsDisabled: (animationsDisabled) => {
    if (animationsDisabled) {
      localStorage.setItem('disableAnimations', 'true')
      MotionGlobalConfig.skipAnimations = true
      document.documentElement.classList.add('disable-animations')
    } else {
      localStorage.setItem('disableAnimations', 'false')
      MotionGlobalConfig.skipAnimations = false
      document.documentElement.classList.remove('disable-animations')
    }

    set({ animationsDisabled })
  },
}))

// ===============================
// === useEnableVersionChecker ===
// ===============================

/** A function to set whether the version checker is forcibly shown/hidden. */
export function useEnableVersionChecker() {
  return zustand.useStore(ensoDevtoolsStore, (state) => state.showVersionChecker, {
    unsafeEnableTransition: true,
  })
}

// ==================================
// === useSetEnableVersionChecker ===
// ==================================

/** A function to set whether the version checker is forcibly shown/hidden. */
export function useSetEnableVersionChecker() {
  return zustand.useStore(ensoDevtoolsStore, (state) => state.setEnableVersionChecker, {
    unsafeEnableTransition: true,
  })
}

/** A function to get whether animations are disabled. */
export function useAnimationsDisabled() {
  return zustand.useStore(ensoDevtoolsStore, (state) => state.animationsDisabled, {
    unsafeEnableTransition: true,
  })
}

/** A function to set whether animations are disabled. */
export function useSetAnimationsDisabled() {
  return zustand.useStore(ensoDevtoolsStore, (state) => state.setAnimationsDisabled, {
    unsafeEnableTransition: true,
  })
}

/** A hook that provides access to the paywall devtools. */
export function usePaywallDevtools() {
  return zustand.useStore(
    ensoDevtoolsStore,
    (state) => ({
      features: state.paywallFeatures,
      setFeature: state.setPaywallFeature,
    }),
    { unsafeEnableTransition: true },
  )
}

/** A hook that provides access to the show devtools state. */
export function useShowDevtools() {
  return zustand.useStore(ensoDevtoolsStore, (state) => state.showDevtools, {
    unsafeEnableTransition: true,
  })
}

if (typeof window !== 'undefined') {
  window.toggleDevtools = ensoDevtoolsStore.getState().toggleDevtools
}
