/** @file Constants for the subscribe page. */
import { Plan } from '@common/services/Backend'
import type { TextId } from '../../../../../common/src/text'

/* eslint-disable @typescript-eslint/no-magic-numbers, @typescript-eslint/naming-convention */

/** The text id for the plan name. */
export const PLAN_TO_TEXT_ID: Readonly<Record<Plan, TextId>> = {
  [Plan.free]: 'freePlanName',
  [Plan.solo]: 'soloPlanName',
  [Plan.team]: 'teamPlanName',
  [Plan.enterprise]: 'enterprisePlanName',
} satisfies { [PlanType in Plan]: `${PlanType}PlanName` }
/** The text id for the plan name. */
export const PLAN_TO_UPGRADE_LABEL_ID: Readonly<Record<Plan, TextId>> = {
  [Plan.free]: 'freePlanUpgradeLabel',
  [Plan.solo]: 'soloPlanUpgradeLabel',
  [Plan.team]: 'teamPlanUpgradeLabel',
  [Plan.enterprise]: 'enterprisePlanUpgradeLabel',
} satisfies { [PlanType in Plan]: `${PlanType}PlanUpgradeLabel` }

export const PRICE_CURRENCY = 'USD'
export const PRICE_BY_PLAN: Readonly<Record<Plan, number>> = {
  [Plan.free]: 0,
  [Plan.solo]: 60,
  [Plan.team]: 150,
  [Plan.enterprise]: 250,
} satisfies { [PlanType in Plan]: number }

export const DISCOUNT_MULTIPLIER_BY_DURATION: Record<number, number> = {
  1: 1,
  12: 1,
  36: 0.8,
}

export const TRIAL_DURATION_DAYS = 30

const TEAM_PLAN_MAX_SEATS = 10
export const MAX_SEATS_BY_PLAN: Record<Plan, number> = {
  [Plan.enterprise]: Infinity,
  [Plan.team]: TEAM_PLAN_MAX_SEATS,
  [Plan.solo]: 1,
  [Plan.free]: 1,
}
