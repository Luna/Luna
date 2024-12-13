/** @file A color picker to select from a predetermined list of colors. */
import type { ForwardedRef, ReactNode } from 'react'

import {
  COLOR_STRING_TO_COLOR,
  COLORS,
  lChColorToCssColor,
  type LChColor,
} from '@common/services/Backend'

import { Radio, type RadioGroupProps } from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'
import RadioGroup from '#/components/styled/RadioGroup'
import { useHandleFocusMove } from '#/hooks/focusHooks'
import { useFocusClasses } from '#/providers/FocusClassProvider'
import { useFocusDirection } from '#/providers/FocusDirectionProvider'
import { forwardRef } from '#/utilities/react'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for a {@link ColorPickerItem}. */
export interface InternalColorPickerItemProps {
  readonly color: LChColor
}

/** An input in a {@link ColorPicker}. */
function ColorPickerItem(props: InternalColorPickerItemProps) {
  const { color } = props
  const { focusChildClass } = useFocusClasses()
  const focusDirection = useFocusDirection()
  const handleFocusMove = useHandleFocusMove(focusDirection)
  const cssColor = lChColorToCssColor(color)

  return (
    <FocusRing within>
      <Radio
        ref={(element) => {
          element?.querySelector('input')?.classList.add(focusChildClass)
        }}
        value={cssColor}
        className="group flex size-radio-button cursor-pointer rounded-full p-radio-button-dot"
        style={{ backgroundColor: cssColor }}
        onKeyDown={handleFocusMove}
      >
        <div className="hidden size-radio-button-dot rounded-full bg-selected-frame group-selected:block" />
      </Radio>
    </FocusRing>
  )
}

// ===================
// === ColorPicker ===
// ===================

/** Props for a {@link ColorPicker}. */
export interface ColorPickerProps extends Readonly<Omit<RadioGroupProps, 'className'>> {
  readonly children?: ReactNode
  readonly className?: string
  readonly pickerClassName?: string
  readonly setColor: (color: LChColor) => void
}

/** A color picker to select from a predetermined list of colors. */
export default forwardRef(ColorPicker)

/** A color picker to select from a predetermined list of colors. */
function ColorPicker(props: ColorPickerProps, ref: ForwardedRef<HTMLDivElement>) {
  const { className, pickerClassName = '', children, setColor, ...radioGroupProps } = props
  return (
    <RadioGroup
      ref={ref}
      {...radioGroupProps}
      orientation="horizontal"
      className={twMerge('flex flex-col', className)}
      onChange={(value) => {
        const color = COLOR_STRING_TO_COLOR.get(value)
        if (color != null) {
          setColor(color)
        }
      }}
    >
      {children}
      <div className={twMerge('flex items-center justify-between gap-colors', pickerClassName)}>
        {COLORS.map((currentColor, i) => (
          <ColorPickerItem key={i} color={currentColor} />
        ))}
      </div>
    </RadioGroup>
  )
}
