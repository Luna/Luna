/** @file Display the result of an operation. */
import * as React from 'react'

import Success from 'enso-assets/check_mark.svg'
import Error from 'enso-assets/cross.svg'

import * as aria from '#/components/aria'
import SvgMask from '#/components/SvgMask'

import * as tailwindMerge from '#/utilities/tailwindMerge'

// =================
// === Constants ===
// =================

const STATUS_ICON_MAP: Readonly<Record<Status, StatusIcon>> = {
  error: { icon: Error, colorClassName: 'text-red-500', bgClassName: 'bg-red-500' },
  success: { icon: Success, colorClassName: 'text-green-500', bgClassName: 'bg-green' },
}

// ==============
// === Status ===
// ==============

/** Possible statuses for a result. */
export type Status = 'error' | 'success'

// ==================
// === StatusIcon ===
// ==================

/** The corresponding icon and color for each status. */
interface StatusIcon {
  readonly icon: string
  readonly colorClassName: string
  readonly bgClassName: string
}

// ==============
// === Result ===
// ==============

/** Props for a {@link Result}. */
export interface ResultProps extends React.PropsWithChildren {
  readonly className?: string
  readonly title?: React.JSX.Element | string
  readonly subtitle?: React.JSX.Element | string
  /** The status of the result.
   * @default 'success' */
  readonly status?: React.ReactElement | Status
  readonly icon?: string | false
  readonly testId?: string
}

/** Display the result of an operation. */
export function Result(props: ResultProps) {
  const {
    title,
    children,
    status = 'success',
    subtitle,
    className,
    icon,
    testId = 'Result',
  } = props

  const statusIcon = typeof status === 'string' ? STATUS_ICON_MAP[status] : null
  const showIcon = icon !== false

  return (
    <section
      className={tailwindMerge.twMerge(
        'm-auto flex flex-col items-center justify-center px-6 py-4 text-center',
        className
      )}
      data-testid={testId}
    >
      {showIcon ? (
        <>
          {statusIcon != null ? (
            <div
              className={tailwindMerge.twMerge(
                'mb-4 flex rounded-full bg-opacity-25 p-1 text-green',
                statusIcon.bgClassName
              )}
            >
              <SvgMask
                src={icon ?? statusIcon.icon}
                className={tailwindMerge.twMerge('h-16 w-16 flex-none', statusIcon.colorClassName)}
              />
            </div>
          ) : (
            status
          )}
        </>
      ) : null}

      {typeof title === 'string' ? (
        <aria.Heading level={2} className="mb-2 text-2xl leading-10 text-primary/60">
          {title}
        </aria.Heading>
      ) : (
        title
      )}

      <aria.Text
        elementType="p"
        className="max-w-[750px] text-balance text-lg leading-6 text-primary/60"
      >
        {subtitle}
      </aria.Text>

      <div className="mt-6 w-full">{children}</div>
    </section>
  )
}
