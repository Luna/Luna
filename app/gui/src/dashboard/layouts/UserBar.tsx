/** @file A toolbar containing chat and the user menu. */
import { SUBSCRIBE_PATH } from '#/appUtils'
import ChatIcon from '#/assets/chat.svg'
import DefaultUserIcon from '#/assets/default_user.svg'
import ArrowDownIcon from '#/assets/expand_arrow_down.svg'
import Offline from '#/assets/offline_filled.svg'
import { Button, DialogTrigger, Popover, Text } from '#/components/AriaComponents'
import { PaywallDialogButton } from '#/components/Paywall'
import FocusArea from '#/components/styled/FocusArea'
import { usePaywall } from '#/hooks/billing'
import UserMenu from '#/layouts/UserMenu'
import InviteUsersModal from '#/modals/InviteUsersModal'
import { useFullUserSession } from '#/providers/AuthProvider'
import { useText } from '#/providers/TextProvider'
import { Plan } from '#/services/Backend'
import { AnimatePresence, motion } from 'framer-motion'
import SvgMask from '../components/SvgMask'
import { useOffline } from '../hooks/offlineHooks'

/** Whether the chat button should be visible. Temporarily disabled. */
const SHOULD_SHOW_CHAT_BUTTON: boolean = false

/** Props for a {@link UserBar}. */
export interface UserBarProps {
  /**
   * When `true`, the element occupies space in the layout but is not visible.
   * Defaults to `false`.
   */
  readonly invisible?: boolean
  readonly setIsHelpChatOpen: (isHelpChatOpen: boolean) => void
  readonly goToSettingsPage: () => void
  readonly onSignOut: () => void
  readonly onShareClick?: (() => void) | null | undefined
}

/** A toolbar containing chat and the user menu. */
export default function UserBar(props: UserBarProps) {
  const { invisible = false, setIsHelpChatOpen, onShareClick, goToSettingsPage, onSignOut } = props

  const { user } = useFullUserSession()
  const { getText } = useText()
  const { isFeatureUnderPaywall } = usePaywall({ plan: user.plan })
  const { isOffline } = useOffline()

  const shouldShowUpgradeButton =
    user.isOrganizationAdmin && user.plan !== Plan.enterprise && user.plan !== Plan.team

  const upgradeButtonVariant = user.plan === Plan.free ? 'primary' : 'outline'
  // eslint-disable-next-line no-restricted-syntax
  const shouldShowPaywallButton = (false as boolean) && isFeatureUnderPaywall('inviteUser')
  // FIXME[sb]: Re-enable when they are wanted again.
  // eslint-disable-next-line no-restricted-syntax
  const shouldShowShareButton = (false as boolean) && onShareClick != null
  const shouldShowInviteButton =
    // eslint-disable-next-line no-restricted-syntax
    (false as boolean) && !shouldShowShareButton && !shouldShowPaywallButton

  return (
    <FocusArea active={!invisible} direction="horizontal">
      {(innerProps) => (
        <div className="bg-primary/10 pt-0.5">
          <div
            className="flex h-full shrink-0 cursor-default items-center gap-user-bar pl-icons-x pr-2"
            {...innerProps}
          >
            <AnimatePresence initial={false}>
              {isOffline && (
                <motion.div
                  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                  exit={{ opacity: 0, x: 12 }}
                  className="mr-2 flex items-center gap-2"
                >
                  <SvgMask src={Offline} className="aspect-square w-4 flex-none" />
                  <Text tooltip={getText('offlineToastMessage')} tooltipDisplay="always">
                    {getText('youAreOffline')}
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>

            {SHOULD_SHOW_CHAT_BUTTON && (
              <Button
                variant="icon"
                size="custom"
                className="mr-1"
                icon={ChatIcon}
                aria-label={getText('openHelpChat')}
                onPress={() => {
                  setIsHelpChatOpen(true)
                }}
              />
            )}

            {shouldShowPaywallButton && (
              <PaywallDialogButton feature="inviteUser" size="medium" variant="accent">
                {getText('invite')}
              </PaywallDialogButton>
            )}

            {shouldShowInviteButton && (
              <DialogTrigger>
                <Button size="medium" variant="accent">
                  {getText('invite')}
                </Button>

                <InviteUsersModal />
              </DialogTrigger>
            )}

            <Button.Group gap="small" buttonVariants={{ variant: 'icon' }}>
              <Button
                rel="noreferrer"
                target="_blank"
                href="https://community.ensoanalytics.com/c/what-is-new-in-enso/"
              >
                {getText('whatsNew')}
              </Button>

              <Button.GroupJoin buttonVariants={{ variant: 'icon' }}>
                <Button href="https://community.ensoanalytics.com/">{getText('community')}</Button>

                <Popover.Trigger>
                  <Button icon={ArrowDownIcon} />

                  <Popover size="auto" placement="bottom end">
                    <Button.Group
                      direction="column"
                      gap="small"
                      buttonVariants={{ variant: 'icon' }}
                    >
                      <Button
                        rel="noreferrer"
                        target="_blank"
                        href="https://community.ensoanalytics.com/"
                      >
                        {getText('askAQuestion')}
                      </Button>

                      <Button
                        rel="noreferrer"
                        target="_blank"
                        href="https://community.ensoanalytics.com/c/enso101/"
                      >
                        {getText('enso101')}
                      </Button>

                      <Button
                        rel="noreferrer"
                        target="_blank"
                        href="https://community.ensoanalytics.com/c/enso-component-examples/"
                      >
                        {getText('componentExamples')}
                      </Button>
                    </Button.Group>
                  </Popover>
                </Popover.Trigger>
              </Button.GroupJoin>

              <Button rel="noreferrer" target="_blank" href="https://help.enso.org/">
                {getText('docs')}
              </Button>
            </Button.Group>

            {shouldShowUpgradeButton && (
              <Button variant={upgradeButtonVariant} size="medium" href={SUBSCRIBE_PATH}>
                {getText('upgrade')}
              </Button>
            )}

            {shouldShowShareButton && (
              <Button
                size="medium"
                variant="accent"
                aria-label={getText('shareButtonAltText')}
                onPress={onShareClick}
              >
                {getText('share')}
              </Button>
            )}

            <Popover.Trigger>
              <Button
                size="custom"
                variant="icon"
                isActive
                icon={
                  <img src={user.profilePicture ?? DefaultUserIcon} className="aspect-square" />
                }
                aria-label={getText('userMenuLabel')}
                className="overflow-clip rounded-full opacity-100"
                contentClassName="size-8"
              />
              <UserMenu goToSettingsPage={goToSettingsPage} onSignOut={onSignOut} />
            </Popover.Trigger>

            {/* Required for shortcuts to work. */}
            <div className="hidden">
              <UserMenu hidden goToSettingsPage={goToSettingsPage} onSignOut={onSignOut} />
            </div>
          </div>
        </div>
      )}
    </FocusArea>
  )
}
