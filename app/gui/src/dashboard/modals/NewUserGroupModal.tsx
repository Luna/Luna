/** @file A modal to create a user group. */
import { useMemo, useState, type MouseEvent } from 'react'

import { useMutation } from '@tanstack/react-query'

import { type Backend } from '@common/services/Backend'
import { normalizeName } from '@common/utilities/data/string'

import { FieldError, Heading, Input, Label, TextField } from '#/components/aria'
import { Button, ButtonGroup } from '#/components/AriaComponents'
import Modal from '#/components/Modal'
import { backendMutationOptions, useBackendQuery } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import { useSetModal } from '#/providers/ModalProvider'
import { useText } from '#/providers/TextProvider'
import { twMerge } from '#/utilities/tailwindMerge'

/**
 * Search for an ancestor `form` element and try to submit it.
 * @deprecated
 */
function submitForm(event: { readonly target: Element }) {
  const closestForm = event.target.closest('form')
  if (closestForm != null) {
    closestForm.requestSubmit()
  }
}

/** Props for a {@link NewUserGroupModal}. */
export interface NewUserGroupModalProps {
  readonly backend: Backend
  readonly event?: Pick<MouseEvent, 'pageX' | 'pageY'>
}

/** A modal to create a user group. */
export default function NewUserGroupModal(props: NewUserGroupModalProps) {
  const { backend, event: positionEvent } = props
  const { unsetModal } = useSetModal()
  const { getText } = useText()
  const toastAndLog = useToastAndLog()
  const [name, setName] = useState('')
  const listUserGroupsQuery = useBackendQuery(backend, 'listUserGroups', [])
  const userGroups = listUserGroupsQuery.data ?? null
  const userGroupNames = useMemo(
    () =>
      userGroups == null ? null : (
        new Set(userGroups.map((group) => normalizeName(group.groupName)))
      ),
    [userGroups],
  )
  const nameError =
    userGroupNames != null && userGroupNames.has(normalizeName(name)) ?
      getText('duplicateUserGroupError')
    : null
  const createUserGroup = useMutation(
    backendMutationOptions(backend, 'createUserGroup'),
  ).mutateAsync
  const canSubmit = nameError == null && name !== '' && userGroupNames != null

  const onSubmit = async () => {
    if (canSubmit) {
      unsetModal()
      try {
        await createUserGroup([{ name }])
      } catch (error) {
        toastAndLog(null, error)
      }
    }
  }

  return (
    <Modal
      centered={positionEvent == null}
      className={twMerge('bg-dim', positionEvent != null && 'absolute size-full overflow-hidden')}
    >
      <form
        tabIndex={-1}
        className="pointer-events-auto relative flex w-new-label-modal flex-col gap-modal rounded-default p-modal-wide pb-3 pt-modal before:absolute before:inset before:h-full before:w-full before:rounded-default before:bg-selected-frame before:backdrop-blur-default"
        style={positionEvent == null ? {} : { left: positionEvent.pageX, top: positionEvent.pageY }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') {
            event.stopPropagation()
          }
        }}
        onClick={(event) => {
          event.stopPropagation()
        }}
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
      >
        <Heading className="relative text-sm font-semibold">{getText('newUserGroup')}</Heading>
        <TextField
          className="relative flex flex-col"
          value={name}
          onChange={setName}
          isInvalid={nameError != null}
        >
          <div className="flex items-center">
            <Label className="text w-modal-label">{getText('name')}</Label>
            <Input
              autoFocus
              size={1}
              placeholder={getText('userGroupNamePlaceholder')}
              className="text grow rounded-full border border-primary/10 bg-transparent px-input-x invalid:border-red-700/60"
            />
          </div>
          <FieldError className="text-red-700/90">{nameError}</FieldError>
        </TextField>
        <ButtonGroup className="relative">
          <Button variant="submit" isDisabled={!canSubmit} onPress={submitForm}>
            {getText('create')}
          </Button>
          <Button variant="outline" onPress={unsetModal}>
            {getText('cancel')}
          </Button>
        </ButtonGroup>
      </form>
    </Modal>
  )
}
