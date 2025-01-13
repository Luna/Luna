/** @file Common types for ARIA components. */

/** Props for adding a test id to a component */
export interface TestIdProps {
  /** @deprecated Use `testId` instead. */
  readonly 'data-testid'?: string | undefined
  /**
   * Test Id for a component.
   * Format should be `any-string-you-want`. All letters should be lowercase, words should be joined by dashes.
   * @example
   * ```tsx
   * <Button testId="my-cool-button" />
   * ```
   */
  readonly testId?: string | undefined
}
