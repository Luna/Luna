/** @file Mock for `@stripe/stripe-js` */
import type { Stripe } from '@stripe/stripe-js'

// eslint-disable-next-line no-restricted-syntax
export const loadStripe = (): Promise<Stripe> =>
  // eslint-disable-next-line no-restricted-syntax
  Promise.resolve({
    createPaymentMethod: () =>
      Promise.resolve({
        paymentMethod: {
          id: '',
          object: 'payment_method',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          billing_details: {
            address: null,
            email: null,
            name: null,
            phone: null,
          },
          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          created: Number(new Date()) / 1_000,
          customer: null,
          livemode: true,
          metadata: {},
          type: '',
        },
        error: undefined,
      }),
  } satisfies Partial<Stripe> as Partial<Stripe> as Stripe)
