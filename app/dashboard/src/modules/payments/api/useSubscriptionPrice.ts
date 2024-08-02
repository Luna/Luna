/**
 * @file
 *
 * This file contains the `useSubscriptionPrice` hook that is used to fetch the subscription price based on the provided parameters.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import type { Plan } from '#/services/Backend'

import { DISCOUNT_MULTIPLIER_BY_DURATION, PRICE_BY_PLAN } from '../constants'

/**
 *
 */
export interface SubscriptionPriceQueryParams {
  readonly plan: Plan
  readonly seats: number
  readonly period: number
}

/**
 * Creates a query to fetch the subscription price based on the provided parameters.
 */
export function createSubscriptionPriceQuery(params: SubscriptionPriceQueryParams) {
  return queryOptions({
    queryKey: ['getPrice', params] as const,
    queryFn: ({ queryKey }) => {
      const [, { seats, period, plan }] = queryKey

      const discountMultiplier = DISCOUNT_MULTIPLIER_BY_DURATION[params.period] ?? 1
      const fullPrice = PRICE_BY_PLAN[plan]
      const price = fullPrice * discountMultiplier
      const discount = fullPrice - price

      return Promise.resolve({
        monthlyPrice: price * seats,
        billingPeriod: period,
        fullPrice: fullPrice * seats * period,
        discount: discount * seats * period,
        totalPrice: price * seats * period,
      })
    },
  })
}

/**
 * Fetches the subscription price based on the provided parameters.
 */
export function useSubscriptionPrice(params: SubscriptionPriceQueryParams) {
  return useQuery(createSubscriptionPriceQuery(params))
}
