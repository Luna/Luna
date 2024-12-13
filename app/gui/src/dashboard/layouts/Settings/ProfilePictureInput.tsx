/** @file The input for viewing and changing the user's profile picture. */
import type { ChangeEvent } from 'react'

import { useMutation } from '@tanstack/react-query'

import type { Backend } from '@common/services/Backend'

import DefaultUserIcon from '#/assets/default_user.svg'
import { Input, Label, Text } from '#/components/aria'
import FocusRing from '#/components/styled/FocusRing'
import { backendMutationOptions, useBackendQuery } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useText } from '#/providers/TextProvider'

/** Props for a {@link ProfilePictureInput}. */
export interface ProfilePictureInputProps {
  readonly backend: Backend
}

/** The input for viewing and changing the user's profile picture. */
export default function ProfilePictureInput(props: ProfilePictureInputProps) {
  const { backend } = props
  const toastAndLog = useToastAndLog()
  const { data: user } = useBackendQuery(backend, 'usersMe', [])
  const { getText } = useText()

  const uploadUserPicture = useMutation(backendMutationOptions(backend, 'uploadUserPicture')).mutate

  const doUploadUserPicture = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0]
    if (image == null) {
      toastAndLog('noNewProfilePictureError')
    } else {
      uploadUserPicture([{ fileName: image.name }, image])
    }
    // Reset selected files, otherwise the file input will do nothing if the same file is
    // selected again. While technically not undesired behavior, it is unintuitive for the user.
    event.target.value = ''
  }

  return (
    <>
      <FocusRing within>
        <Label
          data-testid="user-profile-picture-input"
          className="flex h-profile-picture-large w-profile-picture-large cursor-pointer items-center overflow-clip rounded-full transition-colors hover:bg-frame"
        >
          <img
            src={user?.profilePicture ?? DefaultUserIcon}
            className="pointer-events-none h-full w-full"
          />
          <Input
            type="file"
            className="focus-child w-0"
            accept="image/*"
            onChange={doUploadUserPicture}
          />
        </Label>
      </FocusRing>
      <Text className="w-profile-picture-caption py-profile-picture-caption-y">
        {getText('profilePictureWarning')}
      </Text>
    </>
  )
}
