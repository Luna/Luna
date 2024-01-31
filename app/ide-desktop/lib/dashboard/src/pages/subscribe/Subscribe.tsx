/** @file A page in which the currently active payment plan can be changed. */
import * as React from 'react'

import type * as stripe from '@stripe/stripe-js'
import * as stripeReact from '@stripe/react-stripe-js'

import * as backendModule from '#/services/backend'
import * as backendProvider from '#/providers/BackendProvider'
import * as config from '#/utilities/config'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'
import * as load from '#/utilities/load'

import Modal from '#/components/Modal'

// =================
// === Constants ===
// =================

let stripePromise: Promise<stripe.Stripe | null> | null = null

// =================
// === Subscribe ===
// =================

/** A page in which the currently active payment plan can be changed.
 *
 * This page can be in one of several states:
 *
 * 1. Initial (i.e., plan = null, clientSecret = '', sessionStatus = null),
 * 2. Plan selected (e.g., plan = 'solo', clientSecret = '', sessionStatus = null),
 * 3. Session created (e.g., plan = 'solo', clientSecret = 'cs_foo',
 *    sessionStatus.status = { status: 'open' || 'complete' || 'expired',
 *    paymentStatus: 'no_payment_required' || 'paid' || 'unpaid' }),
 * 4. Session complete (e.g., plan = 'solo', clientSecret = 'cs_foo',
 *    sessionStatus.status = { status: 'complete',
 *    paymentStatus: 'no_payment_required' || 'paid' || 'unpaid' }). */
export default function Subscribe() {
    const stripeKey = config.ACTIVE_CONFIG.stripeKey
    // Plan that the user has currently selected, if any (e.g., 'solo', 'team', etc.).
    const [plan, setPlan] = React.useState(() => {
        const initialPlan = new URLSearchParams(location.search).get('plan')
        return backendModule.isPlan(initialPlan) ? initialPlan : null
    })
    // A client secret used to access details about a Checkout Session on the Stripe API. A Checkout
    // Session represents a customer's session as they are in the process of paying for a
    // subscription. The client secret is provided by Stripe when the Checkout Session is created.
    const [clientSecret, setClientSecret] = React.useState('')
    // The ID of a Checkout Session on the Stripe API. This is the same as the client secret, minus
    // the secret part. Without the secret part, the session ID can be safely stored in the URL
    // query.
    const [sessionId, setSessionId] = React.useState<backendModule.CheckoutSessionId | null>(null)
    // The status of a Checkout Session on the Stripe API. This stores whether or not the Checkout
    // Session is complete (i.e., the user has provided payment information), and if so, whether
    // payment has been confirmed.
    const [sessionStatus, setSessionStatus] = React.useState<backendModule.CheckoutSessionStatus | null>(null)
    const { backend } = backendProvider.useBackend()
    const toastAndLog = toastAndLogHooks.useToastAndLog()

    if (stripePromise == null) {
        stripePromise = load.loadScript('https://js.stripe.com/v3/').then(script => {
            script.remove()
            return import('@stripe/stripe-js').then(stripe =>
                stripe.loadStripe(stripeKey)
            )
        })
    }

    React.useEffect(() => {
        if (plan != null && sessionId == null) {
            void (async () => {
                try {
                    // FIXME [NP]: Store the client secret and session ID in the localStorage (the
                    // session ID can maybe go in the URL query?) so that if the checkout session
                    // does not enter the "complete" state immediately (i.e., it remains in the
                    // "open" state), then the EmbeddedCheckout component can be remounted so that
                    // the user can complete the checkout process.
                    const checkoutSession = await backend.createCheckoutSession(plan)
                    setClientSecret(checkoutSession.clientSecret)
                    setSessionId(checkoutSession.id)
                } catch (error) {
                    toastAndLog(null, error)
                }
            })()
        } else if (sessionId != null) {
            void (async () => {
                try {
                    setSessionStatus((await backend.getCheckoutSession(sessionId)))
                } catch (error) {
                    toastAndLog(null, error)
                }
            })()
        }
    }, [
        backend,
        /* should never change */ plan,
        /* should never change */ sessionId,
        /* should never change */ toastAndLog
    ])

    return (
        <Modal centered className="bg-black/10 text-primary text-xs">
            <div
                data-testid="subscribe-modal"
                className="flex flex-col gap-2 bg-frame-selected backdrop-blur-3xl rounded-2xl p-8 w-full max-w-md"
                onClick={event => { event.stopPropagation() }}
            >
                {stripeKey == null ? (
                    <div>Error: Unable to display subscription page.</div>
                ) : (sessionStatus == null || sessionStatus.status !== 'complete') ? (<>
                    <div className="self-center text-xl">{plan != null ? `Upgrade to ${capitalize(plan)}` : 'Upgrade'}</div>
                    <div className="flex items-stretch rounded-full bg-gray-500/30 text-base h-8">
                        {backendModule.PLANS.map(newPlan => (
                            <button
                                key={newPlan}
                                disabled={plan === newPlan}
                                type="button"
                                className="flex-1 grow rounded-full disabled:bg-frame"
                                onClick={event => {
                                    event.stopPropagation()
                                    setPlan(newPlan)
                                }}
                            >
                                {capitalize(newPlan)}
                            </button>
                        ))}
                    </div>
                    {sessionId && clientSecret && (
                        <stripeReact.EmbeddedCheckoutProvider
                            stripe={stripePromise}
                            options={{
                                clientSecret,
                                // Above, `sessionId` is updated when the `checkoutSession` is
                                // created. This triggers a fetch of the session's `status`. The
                                // `status` is not going to be `complete` at that point (unless the
                                // user completes the checkout process before the fetch is
                                // complete).  So the `status` needs to be fetched again when the
                                // `checkoutSession` is updated. This is done by passing a function
                                // to `onComplete`.
                                onComplete: () => {
                                    void (async () => {
                                        try {
                                            setSessionStatus((await backend.getCheckoutSession(sessionId)))
                                        } catch (error) {
                                            toastAndLog(null, error)
                                        }
                                    })()
                                }
                            }}
                        >
                            <stripeReact.EmbeddedCheckout />
                        </stripeReact.EmbeddedCheckoutProvider>
                    )}
                </>) : (
                    <div>Successfully upgraded your plan!</div>
                )}
            </div>
        </Modal>
    )
}

function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
