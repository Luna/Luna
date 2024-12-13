/** @file Hooks for paywall-related functionality. */
import type { Plan } from 'enso-common/src/services/Backend'

import { usePaywallDevtools } from '#/components/Devtools'
import { useEventCallback } from '#/hooks/eventCallbackHooks'
import { mapPlanOnPaywall, type PaywallFeatureName } from './FeaturesConfiguration'
import { usePaywallFeatures } from './paywallFeaturesHooks'

/** Props for the {@link usePaywall} hook. */
export interface UsePaywallProps {
  readonly plan?: Plan | undefined
}

/** A hook that provides paywall-related functionality. */
export function usePaywall(props: UsePaywallProps) {
  const { plan } = props

  const { getFeature } = usePaywallFeatures()
  const { features } = usePaywallDevtools()
  const paywallLevel = mapPlanOnPaywall(plan)

  const getPaywallLevel = useEventCallback((specifiedPlan: Plan | undefined) =>
    mapPlanOnPaywall(specifiedPlan),
  )

  const isFeatureUnderPaywall = useEventCallback((feature: PaywallFeatureName) => {
    const featureConfig = getFeature(feature)
    const { isForceEnabled } = features[feature]
    const { level } = featureConfig

    if (isForceEnabled == null) {
      return level > paywallLevel
    } else {
      return !isForceEnabled
    }
  })

  return {
    paywallLevel,
    isFeatureUnderPaywall,
    getPaywallLevel,
    getFeature,
  } as const
}
