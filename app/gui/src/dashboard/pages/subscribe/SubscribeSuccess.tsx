/** @file A page to show when a user successfully subscribes to a plan. */
import { Navigate } from 'react-router'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Plan, isPlan } from '@common/services/Backend'

import { DASHBOARD_PATH } from '#/appUtils'

import { useText } from '#/providers/TextProvider'

import { Button, ButtonGroup } from '#/components/AriaComponents'
import { Result } from '#/components/Result'

import { PLAN_TO_TEXT_ID } from '#/modules/payments'

/** A page to show when a user successfully subscribes to a plan. */
export function SubscribeSuccess() {
  const { getText } = useText()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const plan = searchParams.get('plan') ?? Plan.solo

  if (!isPlan(plan)) {
    return <Navigate to={DASHBOARD_PATH} replace />
  } else {
    return (
      <Result
        className="h-full"
        title={getText('subscribeSuccessTitle')}
        subtitle={getText('subscribeSuccessSubtitle', getText(PLAN_TO_TEXT_ID[plan]))}
        status="success"
      >
        <ButtonGroup align="center">
          <Button
            variant="submit"
            size="large"
            onPress={() => {
              navigate(DASHBOARD_PATH)
            }}
          >
            {getText('subscribeSuccessSubmit')}
          </Button>
        </ButtonGroup>
      </Result>
    )
  }
}
