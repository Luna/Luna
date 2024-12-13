/** @file AJV instance configured for datalinks. */
import type * as ajv from 'ajv/dist/2020'
import Ajv from 'ajv/dist/2020'

import { assert } from '@common/utilities/error'

import SCHEMA from '#/data/datalinkSchema.json' with { type: 'json' }

export const AJV = new Ajv({
  formats: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'enso-secret': (value) => typeof value === 'string' && value !== '',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'enso-file': true,
  },
})
AJV.addSchema(SCHEMA)

export const validateDatalink = assert<ajv.ValidateFunction>(() =>
  AJV.getSchema('#/$defs/DataLink'),
)
