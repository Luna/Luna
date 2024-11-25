/** @file Local storage keys for the list of opened projects. */
import * as z from 'zod'

import { BackendType, type DirectoryId, type ProjectId } from 'enso-common/src/services/Backend'

import { defineLocalStorageKey } from '#/providers/LocalStorageProvider'

/** Main content of the screen. Only one should be visible at a time. */
export enum TabType {
  drive = 'drive',
  settings = 'settings',
}

const PROJECT_SCHEMA = z
  .object({
    id: z.custom<ProjectId>((x) => typeof x === 'string' && x.startsWith('project-')),
    parentId: z.custom<DirectoryId>((x) => typeof x === 'string' && x.startsWith('directory-')),
    title: z.string(),
    type: z.nativeEnum(BackendType),
  })
  .readonly()
const LAUNCHED_PROJECT_SCHEMA = z.array(PROJECT_SCHEMA).readonly()

/** Launched project information. */
export type LaunchedProject = z.infer<typeof PROJECT_SCHEMA>
/** Launched project ID. */
export type LaunchedProjectId = ProjectId

export const { use: useLaunchedProjects, useState: useLaunchedProjectsState } =
  defineLocalStorageKey('launchedProjects', {
    isUserSpecific: true,
    schema: () => LAUNCHED_PROJECT_SCHEMA,
  })
