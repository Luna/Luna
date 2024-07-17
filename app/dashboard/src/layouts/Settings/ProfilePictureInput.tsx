/** @file The input for viewing and changing the user's profile picture. */
import * as React from 'react'

import DefaultUserIcon from '#/assets/default_user.svg'

import * as backendHooks from '#/hooks/backendHooks'
import * as toastAndLogHooks from '#/hooks/toastAndLogHooks'

import * as authProvider from '#/providers/AuthProvider'
import * as textProvider from '#/providers/TextProvider'

import * as aria from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'

import type Backend from '#/services/Backend'

// ===========================
// === ProfilePictureInput ===
// ===========================

/** Props for a {@link ProfilePictureInput}. */
export interface ProfilePictureInputProps {
  readonly backend: Backend
}

/** The input for viewing and changing the user's profile picture. */
export default function ProfilePictureInput(props: ProfilePictureInputProps) {
  const { backend } = props
  const toastAndLog = toastAndLogHooks.useToastAndLog()
  const { setUser } = authProvider.useAuth()
  const user = backendHooks.useBackendUsersMe(backend)
  const { getText } = textProvider.useText()

  const uploadUserPictureMutation = backendHooks.useBackendMutation(backend, 'uploadUserPicture')

  const doUploadUserPicture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0]
    if (image == null) {
      toastAndLog('noNewProfilePictureError')
    } else {
      try {
        const newUser = await uploadUserPictureMutation.mutateAsync([
          { fileName: image.name },
          image,
        ])
        setUser(newUser)
      } catch (error) {
        toastAndLog(null, error)
      }
    }
    // Reset selected files, otherwise the file input will do nothing if the same file is
    // selected again. While technically not undesired behavior, it is unintuitive for the user.
    event.target.value = ''
  }

  return (
    <>
      <FocusRing within>
        <aria.Label className="flex h-profile-picture-large w-profile-picture-large cursor-pointer items-center overflow-clip rounded-full transition-colors hover:bg-frame">
          <img
            src={user?.profilePicture ?? DefaultUserIcon}
            className="pointer-events-none h-full w-full"
          />
          <aria.Input
            type="file"
            className="focus-child w-0"
            accept="image/*"
            onChange={doUploadUserPicture}
          />
        </aria.Label>
      </FocusRing>
      <aria.Text className="w-profile-picture-caption py-profile-picture-caption-y">
        {getText('profilePictureWarning')}
      </aria.Text>
    </>
  )
}
