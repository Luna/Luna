/** @file Modal for confirming delete of any type of asset. */
import type { FormInstance } from '#/components/AriaComponents'
import { ButtonGroup, Dialog, Form, Input, Popover } from '#/components/AriaComponents'
import type { GetText } from '#/providers/TextProvider'
import { useText } from '#/providers/TextProvider'
import type { SecretId } from '#/services/Backend'

/** Props for a {@link UpsertSecretModal}. */
export interface UpsertSecretModalProps extends UseUpsertSecretFormProps, UpsertSecretFormProps {
  /**
   * @deprecated Use {@link UpsertSecretForm} instead.
   */
  readonly noDialog?: boolean
  readonly asPopover?: boolean
  readonly defaultOpen?: boolean
}

/** A modal for creating and editing a secret. */
export default function UpsertSecretModal(props: UpsertSecretModalProps) {
  const {
    noDialog = false,
    id,
    name,
    defaultOpen,
    doCreate,
    form,
    asPopover = false,
    canReset,
  } = props

  const { getText } = useText()

  const isCreatingSecret = id == null

  const formInstance = useUpsertSecretForm({ doCreate, name, form })
  const { isDirty } = Form.useFormState({ form: formInstance })

  if (asPopover) {
    return (
      <Popover {...(defaultOpen == null ? {} : { defaultOpen })} isDismissable={!isDirty}>
        <UpsertSecretForm
          id={id}
          name={name}
          doCreate={doCreate}
          form={formInstance}
          canReset={canReset}
        />
      </Popover>
    )
  }

  return noDialog ?
      <UpsertSecretForm {...props} form={formInstance} />
    : <Dialog
        title={isCreatingSecret ? getText('newSecret') : getText('editSecret')}
        modalProps={defaultOpen == null ? {} : { defaultOpen }}
        isDismissable={!isDirty}
      >
        <UpsertSecretForm {...props} form={formInstance} />
      </Dialog>
}

/**
 * Props for {@link useUpsertSecretForm}.
 */
export interface UseUpsertSecretFormProps {
  readonly name: string | null
  readonly doCreate: (name: string, value: string) => Promise<void> | void
  readonly form?: UpsertSecretFormType | undefined
}

/**
 * Create a schema for a form for creating or editing a secret.
 */
export function createUpsertSecretFormSchema(getText: GetText) {
  return Form.schema.object({
    name: Form.schema.string().min(1, getText('emptyStringError')),
    value: Form.schema.string(),
  })
}

/**
 * A form for creating or editing a secret.
 */
type UpsertSecretFormType = FormInstance<ReturnType<typeof createUpsertSecretFormSchema>>

/**
 * A hook for creating a form for creating or editing a secret.
 */
export function useUpsertSecretForm(props: UseUpsertSecretFormProps) {
  const { name: nameRaw, doCreate, form: parentForm } = props

  const { getText } = useText()

  return Form.useForm(
    parentForm ?? {
      schema: (z) =>
        z.object({ name: z.string().min(1, getText('emptyStringError')), value: z.string() }),
      defaultValues: { name: nameRaw ?? '', value: '' },
      onSubmit: async ({ name, value }) => {
        await doCreate(name, value)
      },
    },
  )
}

/**
 * Props for {@link UpsertSecretForm}.
 */
export interface UpsertSecretFormProps extends UseUpsertSecretFormProps {
  readonly id: SecretId | null
  readonly canReset?: boolean | undefined
}

/**
 * A form for creating or editing a secret.
 */
export function UpsertSecretForm(props: UpsertSecretFormProps) {
  const { id, name, doCreate, form, canReset = false } = props
  const { getText } = useText()

  const isCreatingSecret = id == null
  const isNameEditable = name == null

  const formInstance = useUpsertSecretForm({ doCreate, name, form })
  const { isDirty } = Form.useFormState({ form: formInstance })

  const shouldDisplaySubmit = isCreatingSecret || isDirty
  const shouldDisplayReset = canReset && isDirty

  return (
    <Form form={formInstance} testId="upsert-secret-modal" className="w-full" method="dialog">
      <Input
        name="name"
        rounded="full"
        autoComplete="off"
        isDisabled={!isNameEditable}
        label={getText('name')}
        placeholder={getText('secretNamePlaceholder')}
      />

      <Input
        name="value"
        type="password"
        rounded="full"
        autoComplete="off"
        label={getText('value')}
        placeholder={
          isNameEditable ? getText('secretValuePlaceholder') : getText('secretValueHidden')
        }
      />

      <ButtonGroup>
        {shouldDisplaySubmit && (
          <Form.Submit>{isCreatingSecret ? getText('create') : getText('update')}</Form.Submit>
        )}

        <Dialog.Close hideOutsideOfDialog onClose={formInstance.reset}>
          {getText('close')}
        </Dialog.Close>

        {shouldDisplayReset && <Form.Reset>{getText('cancel')}</Form.Reset>}
      </ButtonGroup>

      <Form.FormError />
    </Form>
  )
}
