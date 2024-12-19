/** @file This file contains the logic to get the component for a given plan. */
import type { ReactNode } from 'react'

import invariant from 'tiny-invariant'

import { Plan } from '@common/services/Backend'
import type { TextId } from '@common/text'

import OpenInNewTabIcon from '#/assets/open.svg'
import { Button } from '#/components/AriaComponents'
import { useText, type GetText } from '#/providers/TextProvider'

import { PLAN_TO_TEXT_ID } from '../../constants'
import { SubscribeButton, type SubscribeButtonProps } from './components'

/** The component for a plan. */
export interface ComponentForPlan {
  readonly pricing: TextId
  readonly features: TextId
  readonly title: TextId
  readonly subtitle: TextId
  readonly learnMore: () => ReactNode
  readonly submitButton: (props: SubscribeButtonProps) => ReactNode
  readonly elevated?: boolean
}

/**
 * Get the component for a given plan.
 * @throws Error if the plan is invalid.
 */
export function getComponentPerPlan(plan: Plan, getText: GetText) {
  const result = COMPONENT_PER_PLAN[plan]

  // We double-check that the plan exists in the map.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  invariant(result != null, `Plan ${plan} not found`)

  return {
    ...result,
    features: getText(result.features).split(';'),
  }
}

const COMPONENT_PER_PLAN: Record<Plan, ComponentForPlan> = {
  free: {
    learnMore: () => null,
    pricing: 'freePlanPricing',
    features: 'freePlanFeatures',
    title: PLAN_TO_TEXT_ID['free'],
    subtitle: 'freePlanSubtitle',
    submitButton: (props) => <SubscribeButton {...props} isDisabled={true} />,
  },
  [Plan.solo]: {
    learnMore: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { getText } = useText()

      return (
        <Button
          variant="link"
          href="https://enso.org/pricing"
          target="_blank"
          icon={OpenInNewTabIcon}
          iconPosition="end"
          size="medium"
        >
          {getText('learnMore')}
        </Button>
      )
    },
    pricing: 'soloPlanPricing',
    submitButton: SubscribeButton,
    features: 'soloPlanFeatures',
    subtitle: 'soloPlanSubtitle',
    title: PLAN_TO_TEXT_ID['solo'],
  },
  [Plan.team]: {
    learnMore: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { getText } = useText()

      return (
        <Button
          variant="link"
          href="https://enso.org/pricing"
          target="_blank"
          icon={OpenInNewTabIcon}
          iconPosition="end"
          size="medium"
        >
          {getText('learnMore')}
        </Button>
      )
    },
    pricing: 'teamPlanPricing',
    features: 'teamPlanFeatures',
    title: PLAN_TO_TEXT_ID['team'],
    subtitle: 'teamPlanSubtitle',
    elevated: true,
    submitButton: SubscribeButton,
  },
  [Plan.enterprise]: {
    learnMore: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { getText } = useText()

      return (
        <Button
          variant="link"
          href="https://enso.org/pricing"
          target="_blank"
          icon={OpenInNewTabIcon}
          iconPosition="end"
          size="medium"
        >
          {getText('learnMore')}
        </Button>
      )
    },
    pricing: 'enterprisePlanPricing',
    features: 'enterprisePlanFeatures',
    title: PLAN_TO_TEXT_ID['enterprise'],
    subtitle: 'enterprisePlanSubtitle',
    submitButton: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { getText } = useText()

      return (
        <Button fullWidth isDisabled variant="outline" size="medium" rounded="full">
          {getText('comingSoon')}
        </Button>
      )
    },
  },
}
