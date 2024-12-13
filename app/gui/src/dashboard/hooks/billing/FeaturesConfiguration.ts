/** @file Paywall configuration for different plans. */
import { Plan } from '@common/services/Backend'
import type { TextId } from '@common/text'

/** Registered paywall features. */
export const PAYWALL_FEATURES = {
  userGroups: 'userGroups',
  userGroupsFull: 'userGroupsFull',
  inviteUser: 'inviteUser',
  inviteUserFull: 'inviteUserFull',
  share: 'share',
  shareFull: 'shareFull',
  uploadToCloud: 'uploadToCloud',
} as const

/** Paywall features. */
export type PaywallFeatureName = keyof typeof PAYWALL_FEATURES

/** Paywall level names */
export type PaywallLevelName = Plan | 'free'

/**
 * Paywall level values.
 * Used to define the paywall levels and their corresponding labels.
 * The value is a number that represents the level of the paywall.
 * Because the paywall levels are ordered and inclusive, the value is used to compare the levels.
 */
export type PaywallLevelValue =
  | (0 & { readonly name: PaywallLevelName; readonly label: TextId })
  | (1 & { readonly name: PaywallLevelName; readonly label: TextId })
  | (2 & { readonly name: PaywallLevelName; readonly label: TextId })
  | (3 & { readonly name: PaywallLevelName; readonly label: TextId })

/** Paywall levels configuration. */
export const PAYWALL_LEVELS: Record<PaywallLevelName, PaywallLevelValue> = {
  free: Object.assign(0, { name: 'free', label: 'freePlanName' } as const),
  [Plan.solo]: Object.assign(1, {
    name: Plan.solo,
    label: 'soloPlanName',
  } as const),
  [Plan.team]: Object.assign(2, {
    name: Plan.team,
    label: 'teamPlanName',
  } as const),
  [Plan.enterprise]: Object.assign(3, {
    name: Plan.enterprise,
    label: 'enterprisePlanName',
  } as const),
}

/** Possible paywall unlock states for a user account. */
export type PaywallLevel = (typeof PAYWALL_LEVELS)[keyof typeof PAYWALL_LEVELS]

/** Paywall feature labels. */
const PAYWALL_FEATURES_LABELS: Record<PaywallFeatureName, TextId> = {
  userGroups: 'userGroupsFeatureLabel',
  userGroupsFull: 'userGroupsFullFeatureLabel',
  inviteUser: 'inviteUserFeatureLabel',
  inviteUserFull: 'inviteUserFullFeatureLabel',
  share: 'shareFeatureLabel',
  shareFull: 'shareFullFeatureLabel',
  uploadToCloud: 'uploadToCloudFeatureLabel',
} satisfies { [K in PaywallFeatureName]: `${K}FeatureLabel` }

const PAYWALL_FEATURE_META = {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  inviteUser: { maxSeats: 10 },
  inviteUserFull: undefined,
  userGroups: { maxGroups: 1 },
  userGroupsFull: undefined,
  share: undefined,
  shareFull: undefined,
  uploadToCloud: undefined,
} satisfies { [K in PaywallFeatureName]: unknown }

/** Basic feature configuration. */
interface BasicFeatureConfiguration {
  readonly level: PaywallLevel
  readonly bulletPointsTextId: `${PaywallFeatureName}FeatureBulletPoints`
  readonly descriptionTextId: `${PaywallFeatureName}FeatureDescription`
}

/** Feature configuration. */
export type FeatureConfiguration<Key extends PaywallFeatureName = PaywallFeatureName> =
  BasicFeatureConfiguration & {
    readonly name: Key
    readonly label: (typeof PAYWALL_FEATURES_LABELS)[Key]
    readonly meta: (typeof PAYWALL_FEATURE_META)[Key]
  }

const PAYWALL_CONFIGURATION: Record<PaywallFeatureName, BasicFeatureConfiguration> = {
  uploadToCloud: {
    level: PAYWALL_LEVELS.solo,
    bulletPointsTextId: 'uploadToCloudFeatureBulletPoints',
    descriptionTextId: 'uploadToCloudFeatureDescription',
  },
  userGroups: {
    level: PAYWALL_LEVELS.team,
    bulletPointsTextId: 'userGroupsFeatureBulletPoints',
    descriptionTextId: 'userGroupsFeatureDescription',
  },
  userGroupsFull: {
    level: PAYWALL_LEVELS.enterprise,
    bulletPointsTextId: 'userGroupsFullFeatureBulletPoints',
    descriptionTextId: 'userGroupsFullFeatureDescription',
  },
  inviteUser: {
    level: PAYWALL_LEVELS.team,
    bulletPointsTextId: 'inviteUserFeatureBulletPoints',
    descriptionTextId: 'inviteUserFeatureDescription',
  },
  inviteUserFull: {
    level: PAYWALL_LEVELS.enterprise,
    bulletPointsTextId: 'inviteUserFullFeatureBulletPoints',
    descriptionTextId: 'inviteUserFullFeatureDescription',
  },
  share: {
    level: PAYWALL_LEVELS.team,
    bulletPointsTextId: 'shareFeatureBulletPoints',
    descriptionTextId: 'shareFeatureDescription',
  },
  shareFull: {
    level: PAYWALL_LEVELS.enterprise,
    bulletPointsTextId: 'shareFullFeatureBulletPoints',
    descriptionTextId: 'shareFullFeatureDescription',
  },
}

/** Map a plan to a paywall level. */
export function mapPlanOnPaywall(plan: Plan | undefined): PaywallLevel {
  return plan != null ? PAYWALL_LEVELS[plan] : PAYWALL_LEVELS.free
}

/** Check if a given string is a valid feature name. */
export function isFeatureName(name: string): name is PaywallFeatureName {
  return name in PAYWALL_FEATURES
}

/** Get the configuration for a given feature. */
export function getFeatureConfiguration<Key extends PaywallFeatureName>(
  feature: Key,
): FeatureConfiguration<Key> {
  const configuration = PAYWALL_CONFIGURATION[feature]

  return {
    ...configuration,
    name: feature,
    label: PAYWALL_FEATURES_LABELS[feature],
    meta: PAYWALL_FEATURE_META[feature],
  }
}
