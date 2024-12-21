/** @file The input for viewing and changing the user's profile picture. */
import { useMutation } from '@tanstack/react-query'

import type { Backend } from '@common/services/Backend'

import DefaultUserIcon from '#/assets/default_user.svg'
import { Label } from '#/components/aria'
import { Form, HiddenFile, Text } from '#/components/AriaComponents'
import FocusRing from '#/components/styled/FocusRing'
import { backendMutationOptions, useBackendQuery } from '#/hooks/backendHooks'
import { useText } from '#/providers/TextProvider'

/** Props for a {@link ProfilePictureInput}. */
export interface ProfilePictureInputProps {
  readonly backend: Backend
}

/** The input for viewing and changing the user's profile picture. */
export default function ProfilePictureInput(props: ProfilePictureInputProps) {
  const { backend } = props
  const { data: user } = useBackendQuery(backend, 'usersMe', [])
  const { getText } = useText()

  const uploadUserPicture = useMutation(backendMutationOptions(backend, 'uploadUserPicture'))

  const form = Form.useForm({
    schema: (z) => z.object({ picture: z.instanceof(File) }),
    onSubmit: async ({ picture }) => {
      await uploadUserPicture.mutateAsync([{ fileName: picture.name }, picture])
    },
  })

  return (
    <Form form={form}>
      <FocusRing within>
        <Label
          data-testid="user-profile-picture-input"
          className="flex h-profile-picture-large w-profile-picture-large cursor-pointer items-center overflow-clip rounded-full transition-colors hover:bg-frame"
        >
          <img
            src={user?.profilePicture ?? DefaultUserIcon}
            className="pointer-events-none h-full w-full"
          />
          <HiddenFile autoSubmit form={form} name="picture" />
        </Label>
      </FocusRing>
      <Text className="w-profile-picture-caption py-profile-picture-caption-y">
        {getText('profilePictureWarning')}
      </Text>
    </Form>
  )
}
