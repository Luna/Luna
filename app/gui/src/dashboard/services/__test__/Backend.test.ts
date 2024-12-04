import { describe, expect, it } from 'vitest'
import { Rfc3339DateTime } from '../../utilities/dateTime'
import { AssetType, compareAssets, type AnyAsset } from '../Backend'

describe('Backend', () => {
  it('sorts assets by modified date descending', () => {
    const assets = [
      {
        type: AssetType.file,
        modifiedAt: Rfc3339DateTime('2024-01-01'),
        title: 'a',
      },
      {
        type: AssetType.file,
        modifiedAt: Rfc3339DateTime('2024-01-02'),
        title: 'b',
      },
      {
        type: AssetType.file,
        modifiedAt: Rfc3339DateTime('2024-01-03'),
        title: 'c',
      },
    ] as AnyAsset[]

    const sorted = assets.sort(compareAssets)
    expect(sorted).toMatchObject([
      { modifiedAt: '2024-01-03' },
      { modifiedAt: '2024-01-02' },
      { modifiedAt: '2024-01-01' },
    ])
  })

  it('sorts assets by type first', () => {
    const assets = [
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'a' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'b' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'c' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'd' },
      { type: AssetType.project, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'e' },
      { type: AssetType.datalink, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'f' },
    ] as AnyAsset[]

    const sorted = assets.sort(compareAssets)
    expect(sorted).toMatchObject([
      { type: AssetType.directory, modifiedAt: '2024-01-01' },
      { type: AssetType.directory, modifiedAt: '2024-01-01' },
      { type: AssetType.project, modifiedAt: '2024-01-01' },
      { type: AssetType.file, modifiedAt: '2024-01-01' },
      { type: AssetType.file, modifiedAt: '2024-01-01' },
      { type: AssetType.datalink, modifiedAt: '2024-01-01' },
    ])
  })

  it('sorts assets by title if modified dates are equal', () => {
    const assets = [
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'a' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'g' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'b' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'c' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'd' },
      { type: AssetType.project, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'e' },
      { type: AssetType.datalink, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'f' },
      { type: AssetType.datalink, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'a' },
    ] as AnyAsset[]

    const sorted = assets.sort(compareAssets)
    expect(sorted).toMatchObject([
      { type: AssetType.directory, modifiedAt: '2024-01-01', title: 'b' },
      { type: AssetType.directory, modifiedAt: '2024-01-01', title: 'd' },
      { type: AssetType.project, modifiedAt: '2024-01-01', title: 'e' },
      { type: AssetType.file, modifiedAt: '2024-01-01', title: 'a' },
      { type: AssetType.file, modifiedAt: '2024-01-01', title: 'c' },
      { type: AssetType.file, modifiedAt: '2024-01-01', title: 'g' },
      { type: AssetType.datalink, modifiedAt: '2024-01-01', title: 'a' },
      { type: AssetType.datalink, modifiedAt: '2024-01-01', title: 'f' },
    ])
  })

  it('sorts by type, then by modified date, then by title', () => {
    const assets = [
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'd' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2021-01-01'), title: 'b' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2023-01-01'), title: 'c' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2020-01-01'), title: 'd' },
      { type: AssetType.directory, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'e' },
      { type: AssetType.project, modifiedAt: Rfc3339DateTime('2021-01-01'), title: 'f' },
      { type: AssetType.datalink, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'g' },
      { type: AssetType.file, modifiedAt: Rfc3339DateTime('2024-01-01'), title: 'a' },
    ] as AnyAsset[]

    const sorted = assets.sort(compareAssets)
    expect(sorted).toMatchObject([
      { type: AssetType.directory, modifiedAt: '2024-01-01', title: 'e' },
      { type: AssetType.directory, modifiedAt: '2020-01-01', title: 'd' },
      { type: AssetType.project, modifiedAt: '2021-01-01', title: 'f' },
      { type: AssetType.file, modifiedAt: '2024-01-01', title: 'a' },
      { type: AssetType.file, modifiedAt: '2024-01-01', title: 'd' },
      { type: AssetType.file, modifiedAt: '2023-01-01', title: 'c' },
      { type: AssetType.file, modifiedAt: '2021-01-01', title: 'b' },
      { type: AssetType.datalink, modifiedAt: '2024-01-01', title: 'g' },
    ])
  })
})
