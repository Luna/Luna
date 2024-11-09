import Enso from '#/assets/enso_logo.svg'
import { Text } from '#/components/AriaComponents'
import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { Button, type ButtonProps } from './Button'

/**
 *
 */
type Story = StoryObj<ButtonProps>

export default {
  title: 'Components/AriaComponents/Button',
  component: Button,
} satisfies Meta<ButtonProps>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Text.Heading>Variants</Text.Heading>
      <div className="grid grid-cols-4 place-content-start place-items-start gap-3">
        <Button>Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="delete">Delete</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="ghost-fading">Ghost Fading</Button>
        <Button variant="link">Link</Button>
        <Button variant="submit">Submit</Button>
        <Button variant="outline">Outline</Button>
      </div>

      <Text.Heading>Sizes</Text.Heading>
      <div className="grid grid-cols-4 place-content-center place-items-start gap-3">
        <Button size="hero">Hero</Button>
        <Button size="large">Large</Button>
        <Button size="medium">Medium</Button>
        <Button size="small">Small</Button>
        <Button size="xsmall">XSmall</Button>
        <Button size="xxsmall">XXSmall</Button>
      </div>

      <Text.Heading>Icons</Text.Heading>
      <div className="grid grid-cols-4 place-content-center place-items-start gap-3">
        <Button icon={Enso}>Icon start</Button>
        <Button icon={Enso} iconPosition="end">
          Icon end
        </Button>
        <Button icon={Enso} aria-label="Only icon" />
      </div>

      <Text.Heading>States</Text.Heading>
      <div className="grid grid-cols-4 place-content-center place-items-start gap-3">
        <Button isDisabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button loaderPosition="icon" loading>
          Loading
        </Button>
        <Button isActive>Active</Button>
      </div>
    </div>
  ),
}

export const Tooltips: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Text.Heading>Tooltip</Text.Heading>
      <div className="grid grid-cols-4 place-content-center place-items-start gap-3">
        <Button tooltip="This is a tooltip">Tooltip</Button>
        <Button
          aria-label="Tooltip uses aria-label for icon buttons"
          icon={Enso}
          testId="icon-button"
        />
        <Button icon={Enso} tooltip={false} testId="icon-button-no-tooltip" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { getByTestId, getByRole, queryByRole, findByRole } = within(canvasElement)

    const button = getByRole('button', { name: 'Tooltip' })
    await userEvent.hover(button)
    await expect(await findByRole('tooltip')).toBeInTheDocument()
    await userEvent.unhover(button)

    const iconButton = getByTestId('icon-button')
    await userEvent.hover(iconButton)
    await expect(await findByRole('tooltip')).toBeInTheDocument()
    await userEvent.unhover(iconButton)

    const iconButtonNoTooltip = getByTestId('icon-button-no-tooltip')
    await userEvent.hover(iconButtonNoTooltip)
    // we expect the previous tooltip to be gone after some delay, so we wait for it to disappear
    await waitFor(() => expect(queryByRole('tooltip')).not.toBeInTheDocument())
    await userEvent.unhover(iconButtonNoTooltip)
  },
}

export const LoadingOnPress: Story = {
  render: () => {
    return (
      <Button
        onPress={() => {
          return new Promise((resolve) => setTimeout(resolve, 1000))
        }}
      >
        Click me to trigger loading
      </Button>
    )
  },
  play: async ({ canvasElement }) => {
    const { getByRole, findByTestId } = within(canvasElement)
    const button = getByRole('button', { name: 'Click me to trigger loading' })
    await userEvent.click(button)
    await expect(button).toHaveAttribute('disabled')
    // then the spinner appears after some delay
    await expect(await findByTestId('spinner')).toBeInTheDocument()
  },
}
