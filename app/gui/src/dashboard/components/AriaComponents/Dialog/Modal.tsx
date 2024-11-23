/**
 *
 */
export interface ModalProps {}

/**
 *
 */
export function Modal() {
  return (
    <>
      <aria.Modal
        className={({ isEntering, isExiting }) => MODAL_STYLES({ type, isEntering, isExiting })}
        isDismissable={isDismissable}
        isKeyboardDismissDisabled={isKeyboardDismissDisabled}
        UNSTABLE_portalContainer={root}
        onOpenChange={onOpenChange}
        shouldCloseOnInteractOutside={() => false}
        {...modalProps}
      >
        <dialogStackProvider.DialogStackRegistrar id={dialogId} type={TYPE_TO_DIALOG_TYPE[type]}>
          <MotionDialog
            layout
            // animate={dialogHeight != null ? { height: dialogHeight } : {}}
            style={dialogHeight != null ? { height: dialogHeight } : {}}
            id={dialogId}
            ref={mergeRefs.mergeRefs(dialogRef, (element) => {
              if (element) {
                // This is a workaround for the `data-testid` attribute not being
                // supported by the 'react-aria-components' library.
                // We need to set the `data-testid` attribute on the dialog element
                // so that we can use it in our tests.
                // This is a temporary solution until we refactor the Dialog component
                // to use `useDialog` hook from the 'react-aria-components' library.
                // this will allow us to set the `data-testid` attribute on the dialog
                element.dataset.testId = testId
              }
            })}
            className={styles.base()}
            aria-labelledby={titleId}
            {...ariaDialogProps}
          >
            {(opts) => (
              <dialogProvider.DialogProvider value={{ close: opts.close, dialogId }}>
                {(closeButton !== 'none' || title != null) && (
                  <aria.Header
                    ref={headerDimensionsRef}
                    className={styles.header({ scrolledToTop: isScrolledToTop })}
                  >
                    {closeButton !== 'none' && (
                      <ariaComponents.CloseButton
                        className={styles.closeButton()}
                        onPress={opts.close}
                      />
                    )}

                    {title != null && (
                      <ariaComponents.Text.Heading
                        id={titleId}
                        level={2}
                        className={styles.heading()}
                        weight="semibold"
                      >
                        {title}
                      </ariaComponents.Text.Heading>
                    )}
                  </aria.Header>
                )}

                <motion.div
                  layout="size"
                  ref={(ref) => {
                    if (ref) {
                      handleScroll(ref.scrollTop)
                    }
                  }}
                  className={styles.content()}
                  onScroll={(event) => {
                    handleScroll(event.currentTarget.scrollTop)
                  }}
                >
                  <errorBoundary.ErrorBoundary>
                    <suspense.Suspense
                      loaderProps={{ minHeight: type === 'fullscreen' ? 'full' : 'h32' }}
                    >
                      <div className="h-full w-full">
                        <div className="inline-grid h-fit w-full grid-rows-[auto]">
                          {/**
                           * This div is used to measure the content dimensions.
                           * It's takes the same grid area as the content, thus
                           * resizes together with the content.
                           *
                           * I use grid + grid-area to avoid setting `position: relative`
                           * on the element, which would interfere with the layout.
                           *
                           * It's set to `pointer-events-none` so that it doesn't
                           * interfere with the layout.
                           */}
                          <div
                            ref={contentDimensionsRef}
                            className="pointer-events-none inline-block"
                            style={{ gridArea: '1/1' }}
                          />

                          <motion.div
                            layout="size"
                            className="inline-block h-fit max-h-fit min-h-fit p-4"
                            style={{ gridArea: '1/1' }}
                          >
                            {typeof children === 'function' ? children(opts) : children}
                          </motion.div>
                        </div>
                      </div>
                    </suspense.Suspense>
                  </errorBoundary.ErrorBoundary>
                </motion.div>
              </dialogProvider.DialogProvider>
            )}
          </MotionDialog>
        </dialogStackProvider.DialogStackRegistrar>
      </aria.Modal>
    </>
  )
}
