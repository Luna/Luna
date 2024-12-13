/** @file The icon and name of a {@link SecretAsset}. */
import { useMutation } from '@tanstack/react-query'

import type { SecretAsset } from '@common/services/Backend'
import { merger } from '@common/utilities/data/object'

import KeyIcon from '#/assets/key.svg'
import { Text } from '#/components/AriaComponents'
import type { AssetColumnProps } from '#/components/dashboard/column'
import SvgMask from '#/components/SvgMask'
import { backendMutationOptions } from '#/hooks/backendHooks'
import { useToastAndLog } from '#/hooks/toastAndLogHooks'
import UpsertSecretModal from '#/modals/UpsertSecretModal'
import { useSetModal } from '#/providers/ModalProvider'
import { isDoubleClick, isSingleClick } from '#/utilities/event'
import { indentClass } from '#/utilities/indent'
import { twMerge } from '#/utilities/tailwindMerge'

/** Props for a {@link SecretNameColumn}. */
export interface SecretNameColumnProps extends AssetColumnProps {
  readonly item: SecretAsset
}

/** The icon and name of a {@link SecretAsset}. */
export default function SecretNameColumn(props: SecretNameColumnProps) {
  const { item, selected, state, rowState, setRowState, isEditable, depth } = props
  const { backend } = state
  const toastAndLog = useToastAndLog()
  const { setModal } = useSetModal()

  const updateSecretMutation = useMutation(backendMutationOptions(backend, 'updateSecret'))

  const setIsEditing = (isEditingName: boolean) => {
    if (isEditable) {
      setRowState(merger({ isEditingName }))
    }
  }

  return (
    <div
      className={twMerge(
        'flex h-table-row w-auto min-w-48 max-w-96 items-center gap-name-column-icon whitespace-nowrap rounded-l-full px-name-column-x py-name-column-y contain-strict rounded-rows-child [contain-intrinsic-size:37px] [content-visibility:auto]',
        indentClass(depth),
      )}
      onKeyDown={(event) => {
        if (rowState.isEditingName && event.key === 'Enter') {
          event.stopPropagation()
        }
      }}
      onClick={(event) => {
        if (isSingleClick(event) && selected) {
          setIsEditing(true)
        } else if (isDoubleClick(event) && isEditable) {
          event.stopPropagation()
          setModal(
            <UpsertSecretModal
              id={item.id}
              name={item.title}
              doCreate={async (_name, value) => {
                try {
                  await updateSecretMutation.mutateAsync([item.id, { value }, item.title])
                } catch (error) {
                  toastAndLog(null, error)
                }
              }}
            />,
          )
        }
      }}
    >
      <SvgMask src={KeyIcon} className="m-name-column-icon size-4" />
      {/* Secrets cannot be renamed. */}
      <Text data-testid="asset-row-name" font="naming" className="grow bg-transparent">
        {item.title}
      </Text>
    </div>
  )
}
