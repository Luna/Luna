/** @file A styled checkbox. */
import * as React from 'react'

import CheckMarkIcon from '#/assets/check_mark.svg'

import * as aria from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'
import SvgMask from '#/components/SvgMask'

// ================
// === Checkbox ===
// ================

/** Props for a {@link Checkbox}. */
export interface CheckboxProps extends Omit<Readonly<aria.CheckboxProps>, 'className'> {}

/** A styled checkbox. */
export default function Checkbox(props: CheckboxProps) {
  return (
    <FocusRing>
      <aria.Checkbox
        className="group flex size-3 cursor-pointer overflow-clip rounded-sm text-invite outline outline-1 outline-primary checkbox"
        {...props}
      >
        <SvgMask
          invert
          src={CheckMarkIcon}
          className="-m-0.5 size-4 opacity-0 transition-all duration-75 group-selected:opacity-100"
        />
      </aria.Checkbox>
    </FocusRing>
  )
}
