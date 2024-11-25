/** @file A modal for creating a Datalink. */
import type { FormInstance } from '#/components/AriaComponents'
import {
  ButtonGroup,
  Dialog,
  DialogDismiss,
  Form,
  Input,
  Popover,
} from '#/components/AriaComponents'
import { DatalinkFormInput } from '#/components/dashboard/DatalinkInput'
import SCHEMA from '#/data/datalinkSchema.json' with { type: 'json' }
import { validateDatalink } from '#/data/datalinkValidator'
import { useText } from '#/providers/TextProvider'
import { constantValueOfSchema } from '#/utilities/jsonSchema'

const DEFS: Record<string, object> = SCHEMA.$defs
const INITIAL_DATALINK_VALUE = constantValueOfSchema(DEFS, SCHEMA.$defs.DataLink, true)[0] ?? null

/** Props for a {@link UpsertDatalinkModal}. */
export interface UpsertDatalinkModalProps extends UpsertDatalinkFormProps {
  readonly asPopover?: boolean | undefined
}

/** A modal for creating a Datalink. */
export default function UpsertDatalinkModal(props: UpsertDatalinkModalProps) {
  const { doCreate, form, asPopover = false } = props

  const { getText } = useText()

  const formInstance = useDatalinkForm({ doCreate, form })
  const { isDirty } = Form.useFormState({ form: formInstance })

  if (asPopover) {
    return (
      <Popover isDismissable={!isDirty}>
        <UpsertDatalinkForm doCreate={doCreate} form={formInstance} />
      </Popover>
    )
  }

  return (
    <Dialog title={getText('createDatalink')} isDismissable={!isDirty}>
      <UpsertDatalinkForm doCreate={doCreate} form={formInstance} />
    </Dialog>
  )
}

/**
 * Create a schema for a datalink form.
 */
export function createDatalinkFormSchema() {
  return Form.createSchema((z) =>
    z.object({
      name: z.string().min(1),
      value: z.unknown().refine(validateDatalink),
    }),
  )
}

/**
 * A form for creating or editing a secret.
 */
type DatalinkFormType = FormInstance<ReturnType<typeof createDatalinkFormSchema>>

/**
 *
 */
export interface UseDatalinkFormProps {
  readonly form?: DatalinkFormType | undefined
  readonly doCreate: (name: string, datalink: unknown) => Promise<void> | void
}

/**
 * Create a form for a datalink.
 */
export function useDatalinkForm(props: UseDatalinkFormProps) {
  const { doCreate, form: parentForm } = props

  return Form.useForm(
    parentForm ?? {
      schema: createDatalinkFormSchema(),
      defaultValues: { value: INITIAL_DATALINK_VALUE },
      onSubmit: ({ name, value }) => doCreate(name, value),
    },
  )
}

/** Props for a {@link UpsertDatalinkForm}. */
export interface UpsertDatalinkFormProps extends UseDatalinkFormProps {}

/** A form for creating a Datalink. */
export function UpsertDatalinkForm(props: UpsertDatalinkFormProps) {
  const { doCreate, form } = props
  const { getText } = useText()

  const formInstance = useDatalinkForm({ doCreate, form })

  return (
    <Form method="dialog" form={formInstance}>
      <Input
        name="name"
        autoFocus
        label={getText('name')}
        placeholder={getText('datalinkNamePlaceholder')}
      />

      <div className="relative w-full">
        <DatalinkFormInput name="value" dropdownTitle={getText('type')} />
      </div>

      <ButtonGroup>
        <Form.Submit>{getText('create')}</Form.Submit>
        <DialogDismiss />
      </ButtonGroup>

      <Form.FormError />
    </Form>
  )
}
