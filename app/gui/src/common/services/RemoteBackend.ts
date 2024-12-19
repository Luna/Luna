/**
 * @file Module containing the API client for the Cloud backend API.
 *
 * Each exported function in the {@link RemoteBackend} in this module corresponds to
 * an API endpoint. The functions are asynchronous and return a {@link Promise} that resolves to
 * the response from the API.
 */
import {
  Address,
  Backend,
  BackendType,
  DirectoryId,
  NetworkError,
  NotAuthorizedError,
  Plan,
  S3_CHUNK_SIZE_BYTES,
  compareAssetPermissions,
  type AnyAsset,
  type AssetId,
  type AssetType,
  type AssetVersions,
  type ChangeUserGroupRequestBody,
  type CheckoutSession,
  type CheckoutSessionId,
  type CheckoutSessionStatus,
  type CognitoCredentials,
  type CopyAssetResponse,
  type CreateCheckoutSessionRequestBody,
  type CreateCustomerPortalSessionResponse,
  type CreateDatalinkRequestBody,
  type CreateDirectoryRequestBody,
  type CreatePermissionRequestBody,
  type CreateProjectRequestBody,
  type CreateSecretRequestBody,
  type CreateTagRequestBody,
  type CreateUserGroupRequestBody,
  type CreateUserRequestBody,
  type CreatedDirectory,
  type CreatedProject,
  type Datalink,
  type DatalinkId,
  type DatalinkInfo,
  type DeleteAssetRequestBody,
  type EmailAddress,
  type Event,
  type FileDetails,
  type FileId,
  type FileLocator,
  type HttpsUrl,
  type InviteUserRequestBody,
  type Label,
  type LabelName,
  type ListDirectoryRequestParams,
  type ListInvitationsResponseBody,
  type ListedProject,
  type ListedProjectRaw,
  type OpenProjectRequestBody,
  type OrganizationInfo,
  type Project,
  type ProjectId,
  type ProjectRaw,
  type ProjectSession,
  type ProjectSessionId,
  type ResourceUsage,
  type S3MultipartPart,
  type S3ObjectVersionId,
  type Secret,
  type SecretId,
  type SecretInfo,
  type TagId,
  type UpdateAssetRequestBody,
  type UpdateDirectoryRequestBody,
  type UpdateOrganizationRequestBody,
  type UpdateProjectRequestBody,
  type UpdateSecretRequestBody,
  type UpdateUserRequestBody,
  type UpdatedDirectory,
  type UpdatedProject,
  type UploadFileEndRequestBody,
  type UploadFileRequestParams,
  type UploadFileStartRequestBody,
  type UploadLargeFileMetadata,
  type UploadPictureRequestParams,
  type UploadedLargeAsset,
  type User,
  type UserGroupId,
  type UserGroupInfo,
  type UserId,
} from '@common/services/Backend'
import type { Replacements, TextId } from '@common/text'
import { merge, omit, type Mutable } from '@common/utilities/data/object'
import { IS_DEV_MODE } from '@common/utilities/detect'
import { download } from '@common/utilities/download'

import type { Logger } from '#/providers/LoggerProvider'
import type { GetText } from '#/providers/TextProvider'

import {
  ACCEPT_INVITATION_PATH,
  CREATE_CHECKOUT_SESSION_PATH,
  CREATE_DATALINK_PATH,
  CREATE_DIRECTORY_PATH,
  CREATE_PERMISSION_PATH,
  CREATE_PROJECT_PATH,
  CREATE_SECRET_PATH,
  CREATE_TAG_PATH,
  CREATE_USER_GROUP_PATH,
  CREATE_USER_PATH,
  DELETE_USER_PATH,
  GET_LOG_EVENTS_PATH,
  GET_ORGANIZATION_PATH,
  INVITATION_PATH,
  INVITE_USER_PATH,
  LIST_DIRECTORY_PATH,
  LIST_FILES_PATH,
  LIST_PROJECTS_PATH,
  LIST_PROJECT_SESSIONS_PATH,
  LIST_SECRETS_PATH,
  LIST_TAGS_PATH,
  LIST_USERS_PATH,
  LIST_USER_GROUPS_PATH,
  POST_LOG_EVENT_PATH,
  TEAMS_DIRECTORY_ID,
  UNDO_DELETE_ASSET_PATH,
  UPDATE_CURRENT_USER_PATH,
  UPDATE_ORGANIZATION_PATH,
  UPLOAD_FILE_END_PATH,
  UPLOAD_FILE_START_PATH,
  UPLOAD_ORGANIZATION_PICTURE_PATH,
  UPLOAD_USER_PICTURE_PATH,
  USERS_DIRECTORY_ID,
  USERS_ME_PATH,
  associateTagPath,
  changeUserGroupPath,
  checkResourcesPath,
  closeProjectPath,
  copyAssetPath,
  deleteAssetPath,
  deleteTagPath,
  deleteUserGroupPath,
  duplicateProjectPath,
  getCheckoutSessionPath,
  getCustomerPortalSessionPath,
  getDatalinkPath,
  getFileDetailsPath,
  getProjectAssetPath,
  getProjectContentPath,
  getProjectDetailsPath,
  getProjectSessionLogsPath,
  getSecretPath,
  listAssetVersionsPath,
  openProjectPath,
  projectUpdatePath,
  restoreProjectPath,
  updateAssetPath,
  updateDirectoryPath,
  updateSecretPath,
} from '@common/services/remoteBackendPaths'

import type HttpClient from '#/utilities/HttpClient'

/** HTTP status indicating that the request was successful. */
const STATUS_SUCCESS_FIRST = 200
/** HTTP status indicating that the request was successful. */
const STATUS_SUCCESS_LAST = 299
/** HTTP status indicating that the resource does not exist. */
const STATUS_NOT_FOUND = 404
/** HTTP status indicating that the server encountered a fatal exception. */
const STATUS_SERVER_ERROR = 500
/** HTTP status indicating that the request was successful, but the user is not authorized to access. */
const STATUS_NOT_AUTHORIZED = 401
/** HTTP status indicating that authorized user doesn't have access to the given resource */
const STATUS_NOT_ALLOWED = 403

/** The format of all errors returned by the backend. */
interface RemoteBackendError {
  readonly type: string
  readonly code: string
  readonly message: string
  readonly param: string
}

/** Whether a response has a success HTTP status code (200-299). */
function responseIsSuccessful(response: Response) {
  return response.status >= STATUS_SUCCESS_FIRST && response.status <= STATUS_SUCCESS_LAST
}

/** Whether the given directory is a special directory that cannot be written to. */
export function isSpecialReadonlyDirectoryId(id: AssetId) {
  return id === USERS_DIRECTORY_ID || id === TEAMS_DIRECTORY_ID
}

/** HTTP response body for the "list users" endpoint. */
export interface ListUsersResponseBody {
  readonly users: readonly User[]
}

/** HTTP response body for the "list projects" endpoint. */
export interface ListDirectoryResponseBody {
  readonly assets: readonly AnyAsset[]
}

/** HTTP response body for the "list projects" endpoint. */
export interface ListProjectsResponseBody {
  readonly projects: readonly ListedProjectRaw[]
}

/** HTTP response body for the "list files" endpoint. */
export interface ListFilesResponseBody {
  readonly files: readonly FileLocator[]
}

/** HTTP response body for the "list secrets" endpoint. */
export interface ListSecretsResponseBody {
  readonly secrets: readonly SecretInfo[]
}

/** HTTP response body for the "list tag" endpoint. */
export interface ListTagsResponseBody {
  readonly tags: readonly Label[]
}

/** Options for {@link RemoteBackend.post} private method. */
interface RemoteBackendPostOptions {
  readonly keepalive?: boolean
}

/** Class for sending requests to the Cloud backend API endpoints. */
export default class RemoteBackend extends Backend {
  readonly type = BackendType.remote
  private user: Mutable<User> | null = null

  /**
   * Create a new instance of the {@link RemoteBackend} API client.
   * @throws An error if the `Authorization` header is not set on the given `client`.
   */
  constructor(
    private readonly client: HttpClient,
    private readonly logger: Logger,
    private getText: GetText,
  ) {
    super()
  }

  /**
   * Set `this.getText`. This function is exposed rather than the property itself to make it clear
   * that it is intended to be mutable.
   */
  setGetText(getText: GetText) {
    this.getText = getText
  }

  /**
   * Log an error message and throws an {@link Error} with the specified message.
   * @throws {Error} Always.
   */
  async throw<K extends Extract<TextId, `${string}BackendError`>>(
    response: Response | null,
    textId: K | NetworkError,
    ...replacements: Replacements[K]
  ): Promise<never> {
    if (textId instanceof NetworkError) {
      this.logger.error(textId.message)

      throw textId
    } else {
      const error =
        response == null || response.headers.get('Content-Type') !== 'application/json' ?
          { message: 'unknown error' }
          // This is SAFE only when the response has been confirmed to have an erroring status code.
          // eslint-disable-next-line no-restricted-syntax
        : ((await response.json()) as RemoteBackendError)
      const message = `${this.getText(textId, ...replacements)}: ${error.message}.`
      this.logger.error(message)

      const status = response?.status

      throw new NetworkError(message, status)
    }
  }

  /** The path to the root directory of this {@link Backend}. */
  override rootPath(user: User) {
    switch (user.plan) {
      case undefined:
      case Plan.free:
      case Plan.solo: {
        return `enso://Users/${user.name}`
      }
      case Plan.team:
      case Plan.enterprise: {
        return 'enso://'
      }
    }
  }

  /** Return the ID of the root directory. */
  override rootDirectoryId(user: User, organization: OrganizationInfo | null): DirectoryId | null {
    switch (user.plan) {
      case undefined:
      case Plan.free:
      case Plan.solo: {
        return user.rootDirectoryId
      }
      case Plan.team:
      case Plan.enterprise: {
        return organization == null ? null : (
            DirectoryId(`directory-${organization.id.replace(/^organization-/, '')}`)
          )
      }
    }
  }

  /** Return a list of all users in the same organization. */
  override async listUsers(): Promise<readonly User[]> {
    const path = LIST_USERS_PATH
    const response = await this.get<ListUsersResponseBody>(path)
    if (response.status === STATUS_NOT_ALLOWED) {
      return []
    } else if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listUsersBackendError')
    } else {
      return (await response.json()).users
    }
  }

  /** Set the username and parent organization of the current user. */
  override async createUser(body: CreateUserRequestBody): Promise<User> {
    const path = CREATE_USER_PATH
    const response = await this.post<User>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createUserBackendError')
    } else {
      return await response.json()
    }
  }

  /** Change the username of the current user. */
  override async updateUser(body: UpdateUserRequestBody): Promise<void> {
    const path = UPDATE_CURRENT_USER_PATH
    const response = await this.put(path, body)
    if (!responseIsSuccessful(response)) {
      return body.username != null ?
          await this.throw(response, 'updateUsernameBackendError')
        : await this.throw(response, 'updateUserBackendError')
    } else {
      if (this.user != null && body.username != null) {
        this.user.name = body.username
      }
      return
    }
  }

  /** Restore a user that has been soft-deleted. */
  async restoreUser(): Promise<void> {
    const response = await this.put(UPDATE_CURRENT_USER_PATH, {
      clearRemoveAt: true,
    })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'restoreUserBackendError')
    } else {
      return
    }
  }

  /** Delete the current user. */
  override async deleteUser(): Promise<void> {
    const response = await this.delete(DELETE_USER_PATH)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'deleteUserBackendError')
    } else {
      return
    }
  }

  /**
   * Delete a user.
   * FIXME: Not implemented on backend yet.
   */
  override async removeUser(): Promise<void> {
    return await this.throw(null, 'removeUserBackendError')
  }

  /** Invite a new user to the organization by email. */
  override async inviteUser(body: InviteUserRequestBody): Promise<void> {
    const response = await this.post(INVITE_USER_PATH, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'inviteUserBackendError', body.userEmail)
    } else {
      return
    }
  }

  /** List all invitations. */
  override async listInvitations() {
    const response = await this.get<ListInvitationsResponseBody>(INVITATION_PATH)

    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listInvitationsBackendError')
    } else {
      return await response.json()
    }
  }

  /** Delete an outgoing invitation. */
  override async deleteInvitation(userEmail: EmailAddress): Promise<void> {
    const response = await this.delete(INVITATION_PATH, { userEmail })

    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'deleteInvitationBackendError')
    } else {
      return
    }
  }

  /** Resend an outgoing invitation to a user. */
  override async resendInvitation(userEmail: EmailAddress): Promise<void> {
    await this.inviteUser({ userEmail, resend: true })
  }

  /** Accept an invitation to a new organization. */
  override async acceptInvitation(): Promise<void> {
    const response = await this.patch(ACCEPT_INVITATION_PATH, {})
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'acceptInvitationBackendError')
    } else {
      return
    }
  }

  /** Decline an invitation to a new organization. */
  override async declineInvitation(userEmail: EmailAddress): Promise<void> {
    await this.deleteInvitation(userEmail)
  }

  /** Upload a new profile picture for the current user. */
  override async uploadUserPicture(params: UploadPictureRequestParams, file: Blob): Promise<User> {
    const paramsString = new URLSearchParams({
      // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
      ...(params.fileName != null ? { file_name: params.fileName } : {}),
    }).toString()
    const path = `${UPLOAD_USER_PICTURE_PATH}?${paramsString}`
    const response = await this.putBinary<User>(path, file)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'uploadUserPictureBackendError')
    } else {
      return await response.json()
    }
  }

  /** Set the list of groups a user is in. */
  override async changeUserGroup(
    userId: UserId,
    userGroups: ChangeUserGroupRequestBody,
    name: string,
  ): Promise<User> {
    const path = changeUserGroupPath(userId)
    const response = await this.put<User>(path, userGroups)
    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'changeUserGroupsBackendError', name)
    } else {
      return await response.json()
    }
  }

  /**
   * Return details for the current organization.
   * @returns `null` if a non-successful status code (not 200-299) was received.
   */
  override async getOrganization(): Promise<OrganizationInfo | null> {
    const path = GET_ORGANIZATION_PATH
    const response = await this.get<OrganizationInfo>(path)
    if ([STATUS_NOT_ALLOWED, STATUS_NOT_FOUND].includes(response.status)) {
      // Organization info has not yet been created.
      // or the user is not eligible to create an organization.
      return null
    } else if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getOrganizationBackendError')
    } else {
      return await response.json()
    }
  }

  /** Update details for the current organization. */
  override async updateOrganization(
    body: UpdateOrganizationRequestBody,
  ): Promise<OrganizationInfo | null> {
    const path = UPDATE_ORGANIZATION_PATH
    const response = await this.patch<OrganizationInfo>(path, body)

    if (response.status === STATUS_NOT_FOUND) {
      // Organization info has not yet been created.
      return null
    } else if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'updateOrganizationBackendError')
    } else {
      return await response.json()
    }
  }

  /** Upload a new profile picture for the current organization. */
  override async uploadOrganizationPicture(
    params: UploadPictureRequestParams,
    file: Blob,
  ): Promise<OrganizationInfo> {
    const paramsString = new URLSearchParams({
      // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
      ...(params.fileName != null ? { file_name: params.fileName } : {}),
    }).toString()
    const path = `${UPLOAD_ORGANIZATION_PICTURE_PATH}?${paramsString}`
    const response = await this.putBinary<OrganizationInfo>(path, file)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'uploadOrganizationPictureBackendError')
    } else {
      return await response.json()
    }
  }

  /** Adds a permission for a specific user on a specific asset. */
  override async createPermission(body: CreatePermissionRequestBody): Promise<void> {
    const path = CREATE_PERMISSION_PATH
    const response = await this.post(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createPermissionBackendError')
    } else {
      return
    }
  }

  /**
   * Return details for the current user.
   * @returns `null` if a non-successful status code (not 200-299) was received.
   */
  override async usersMe(): Promise<User | null> {
    const response = await this.get<User>(USERS_ME_PATH)

    if (response.status === STATUS_NOT_FOUND) {
      // User info has not yet been created, we should redirect to the onboarding page.
      return null
    } else if (response.status === STATUS_NOT_AUTHORIZED) {
      // User is not authorized, we should redirect to the login page.
      return await this.throw(
        response,
        new NotAuthorizedError(this.getText('notAuthorizedBackendError')),
      )
    } else if (!responseIsSuccessful(response)) {
      // Arbitrary error, might be a server error or a network error.
      return this.throw(response, 'usersMeBackendError')
    } else {
      const user = await response.json()
      this.user = { ...user }

      return user
    }
  }

  /**
   * Return a list of assets in a directory.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listDirectory(
    query: ListDirectoryRequestParams,
    title: string,
  ): Promise<readonly AnyAsset[]> {
    const path = LIST_DIRECTORY_PATH
    const response = await this.get<ListDirectoryResponseBody>(
      path +
        '?' +
        new URLSearchParams(
          query.recentProjects ?
            [['recent_projects', String(true)]]
          : [
              ...(query.parentId != null ? [['parent_id', query.parentId]] : []),
              ...(query.filterBy != null ? [['filter_by', query.filterBy]] : []),
              ...(query.labels != null ? query.labels.map((label) => ['label', label]) : []),
            ],
        ).toString(),
    )
    if (!responseIsSuccessful(response)) {
      if (response.status === STATUS_SERVER_ERROR) {
        this.logger.error(
          query.parentId != null ?
            `Error listing directory '${query.parentId}'`
          : `Error listing root directory`,
        )
        // The directory is probably empty.
        return []
      } else if (query.parentId != null) {
        return await this.throw(response, 'listFolderBackendError', title)
      } else {
        return await this.throw(response, 'listRootFolderBackendError')
      }
    } else {
      const ret = (await response.json()).assets
        .map((asset) =>
          merge(asset, {
            // eslint-disable-next-line no-restricted-syntax
            type: asset.id.match(/^(.+?)-/)?.[1] as AssetType,
            // `Users` and `Teams` folders are virtual, so their children incorrectly have
            // the organization root id as their parent id.
            parentId: query.parentId ?? asset.parentId,
          }),
        )
        .map((asset) =>
          merge(asset, {
            permissions: [...(asset.permissions ?? [])].sort(compareAssetPermissions),
          }),
        )
        .map((asset) => this.dynamicAssetUser(asset))
      return ret
    }
  }

  /**
   * Create a directory.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createDirectory(body: CreateDirectoryRequestBody): Promise<CreatedDirectory> {
    const path = CREATE_DIRECTORY_PATH

    // Remote backend doesn't need the title in the body.
    // It's generated on the server side.
    const { title, ...rest } = body

    const response = await this.post<CreatedDirectory>(path, rest)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createFolderBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Change the name of a directory.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async updateDirectory(
    directoryId: DirectoryId,
    body: UpdateDirectoryRequestBody,
    title: string,
  ) {
    const path = updateDirectoryPath(directoryId)
    const response = await this.put<UpdatedDirectory>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'updateFolderBackendError', title)
    } else {
      return await response.json()
    }
  }

  /** List all previous versions of an asset. */
  override async listAssetVersions(assetId: AssetId): Promise<AssetVersions> {
    const path = listAssetVersionsPath(assetId)
    const response = await this.get<AssetVersions>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listAssetVersionsBackendError')
    } else {
      return await response.json()
    }
  }

  /** Fetch the content of the `Main.enso` file of a project. */
  override async getFileContent(
    projectId: ProjectId,
    versionId?: S3ObjectVersionId,
  ): Promise<string> {
    const path = getProjectContentPath(projectId, versionId)
    const response = await this.get<string>(path)

    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'getFileContentsBackendError')
    } else {
      return await response.text()
    }
  }

  /**
   * Change the parent directory or description of an asset.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async updateAsset(assetId: AssetId, body: UpdateAssetRequestBody, title: string) {
    const path = updateAssetPath(assetId)
    const response = await this.patch(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'updateAssetBackendError', title)
    } else {
      return
    }
  }

  /**
   * Delete an arbitrary asset.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async deleteAsset(assetId: AssetId, body: DeleteAssetRequestBody, title: string) {
    const paramsString = new URLSearchParams([['force', String(body.force)]]).toString()
    const path = deleteAssetPath(assetId) + '?' + paramsString
    const response = await this.delete(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'deleteAssetBackendError', title)
    } else {
      return
    }
  }

  /**
   * Restore an arbitrary asset from the trash.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async undoDeleteAsset(assetId: AssetId, title: string): Promise<void> {
    const path = UNDO_DELETE_ASSET_PATH
    const response = await this.patch(path, { assetId })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'undoDeleteAssetBackendError', title)
    } else {
      return
    }
  }

  /**
   * Copy an arbitrary asset to another directory.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async copyAsset(
    assetId: AssetId,
    parentDirectoryId: DirectoryId,
    title: string,
    parentDirectoryTitle: string,
  ): Promise<CopyAssetResponse> {
    const response = await this.post<CopyAssetResponse>(copyAssetPath(assetId), {
      parentDirectoryId,
    })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'copyAssetBackendError', title, parentDirectoryTitle)
    } else {
      return await response.json()
    }
  }

  /**
   * Return a list of projects belonging to the current user.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listProjects(): Promise<ListedProject[]> {
    const path = LIST_PROJECTS_PATH
    const response = await this.get<ListProjectsResponseBody>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listProjectsBackendError')
    } else {
      return (await response.json()).projects.map((project) => ({
        ...project,
        jsonAddress: project.address != null ? Address(`${project.address}json`) : null,
        binaryAddress: project.address != null ? Address(`${project.address}binary`) : null,
        ydocAddress: project.address != null ? Address(`${project.address}project`) : null,
      }))
    }
  }

  /**
   * Create a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createProject(body: CreateProjectRequestBody): Promise<CreatedProject> {
    const path = CREATE_PROJECT_PATH
    // Remote backend doesn't need the project name in the body.
    // It's generated on the server side.
    const { projectName, ...rest } = body

    const response = await this.post<CreatedProject>(path, rest)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createProjectBackendError', projectName)
    } else {
      return await response.json()
    }
  }

  /** Restore a project from a different version. */
  override async restoreProject(
    projectId: ProjectId,
    versionId: S3ObjectVersionId,
    title: string,
  ): Promise<void> {
    const path = restoreProjectPath(projectId)
    const response = await this.post(path, { versionId })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'restoreProjectBackendError', title)
    } else {
      return
    }
  }

  /** Duplicate a specific version of a project. */
  override async duplicateProject(
    projectId: ProjectId,
    versionId: S3ObjectVersionId,
    title: string,
  ): Promise<CreatedProject> {
    const path = duplicateProjectPath(projectId)
    const response = await this.post<CreatedProject>(path, { versionId })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'duplicateProjectBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Close a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async closeProject(projectId: ProjectId, title: string): Promise<void> {
    const path = closeProjectPath(projectId)
    const response = await this.post(path, {})
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'closeProjectBackendError', title)
    } else {
      return
    }
  }

  /**
   * List project sessions for a specific project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listProjectSessions(
    projectId: ProjectId,
    title: string,
  ): Promise<ProjectSession[]> {
    const paramsString = new URLSearchParams({ projectId }).toString()
    const path = `${LIST_PROJECT_SESSIONS_PATH}?${paramsString}`
    const response = await this.get<ProjectSession[]>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listProjectSessionsBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Return details for a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getProjectDetails(
    projectId: ProjectId,
    _directoryId: null,
    getPresignedUrl = false,
  ): Promise<Project> {
    const paramsString = new URLSearchParams({
      presigned: `${getPresignedUrl}`,
    }).toString()
    const path = `${getProjectDetailsPath(projectId)}?${paramsString}`
    const response = await this.get<ProjectRaw>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getProjectDetailsBackendError')
    } else {
      const project = await response.json()
      return {
        ...project,
        ideVersion: project.ide_version,
        engineVersion: project.engine_version,
        jsonAddress: project.address != null ? Address(`${project.address}json`) : null,
        binaryAddress: project.address != null ? Address(`${project.address}binary`) : null,
        ydocAddress: project.address != null ? Address(`${project.address}project`) : null,
      }
    }
  }

  /**
   * Return Language Server logs for a project session.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getProjectSessionLogs(
    projectSessionId: ProjectSessionId,
    title: string,
  ): Promise<string[]> {
    const path = getProjectSessionLogsPath(projectSessionId)
    const response = await this.get<string[]>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getProjectLogsBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Prepare a project for execution.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async openProject(
    projectId: ProjectId,
    bodyRaw: OpenProjectRequestBody,
    title: string,
  ): Promise<void> {
    const body = omit(bodyRaw, 'parentId')
    const path = openProjectPath(projectId)
    if (body.cognitoCredentials == null) {
      return this.throw(null, 'openProjectMissingCredentialsBackendError', title)
    } else {
      const credentials = body.cognitoCredentials
      const exactCredentials: CognitoCredentials = {
        accessToken: credentials.accessToken,
        clientId: credentials.clientId,
        expireAt: credentials.expireAt,
        refreshToken: credentials.refreshToken,
        refreshUrl: credentials.refreshUrl,
      }
      const filteredBody: Omit<OpenProjectRequestBody, 'parentId'> = {
        ...body,
        cognitoCredentials: exactCredentials,
      }
      const response = await this.post(path, filteredBody)

      if (!responseIsSuccessful(response)) {
        return this.throw(response, 'openProjectBackendError', title)
      } else {
        return
      }
    }
  }

  /**
   * Update the name or AMI of a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async updateProject(
    projectId: ProjectId,
    body: UpdateProjectRequestBody,
    title: string,
  ): Promise<UpdatedProject> {
    const path = projectUpdatePath(projectId)
    const response = await this.put<UpdatedProject>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'updateProjectBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Return the resource usage of a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async checkResources(projectId: ProjectId, title: string): Promise<ResourceUsage> {
    const path = checkResourcesPath(projectId)
    const response = await this.get<ResourceUsage>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'checkResourcesBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Return a list of files accessible by the current user.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listFiles(): Promise<readonly FileLocator[]> {
    const path = LIST_FILES_PATH
    const response = await this.get<ListFilesResponseBody>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listFilesBackendError')
    } else {
      return (await response.json()).files
    }
  }

  /**
   * Begin uploading a large file.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async uploadFileStart(
    body: UploadFileRequestParams,
    file: File,
  ): Promise<UploadLargeFileMetadata> {
    const path = UPLOAD_FILE_START_PATH
    const requestBody: UploadFileStartRequestBody = {
      fileName: body.fileName,
      size: file.size,
    }
    const response = await this.post<UploadLargeFileMetadata>(path, requestBody)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'uploadFileStartBackendError')
    } else {
      return await response.json()
    }
  }

  /**
   * Upload a chunk of a large file.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async uploadFileChunk(
    url: HttpsUrl,
    file: Blob,
    index: number,
  ): Promise<S3MultipartPart> {
    const start = index * S3_CHUNK_SIZE_BYTES
    const end = Math.min(start + S3_CHUNK_SIZE_BYTES, file.size)
    const body = file.slice(start, end)
    const response = await fetch(url, { method: 'PUT', body })
    const eTag = response.headers.get('ETag')
    if (!responseIsSuccessful(response) || eTag == null) {
      return await this.throw(response, 'uploadFileChunkBackendError')
    } else {
      return { eTag, partNumber: index + 1 }
    }
  }

  /**
   * Finish uploading a large file.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async uploadFileEnd(body: UploadFileEndRequestBody): Promise<UploadedLargeAsset> {
    const path = UPLOAD_FILE_END_PATH
    const response = await this.post<UploadedLargeAsset>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'uploadFileEndBackendError')
    } else {
      return await response.json()
    }
  }

  /** Change the name of a file. */
  override async updateFile(): Promise<void> {
    await this.throw(null, 'updateFileNotImplementedBackendError')
  }

  /**
   * Return details for a project.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getFileDetails(
    fileId: FileId,
    title: string,
    getPresignedUrl = false,
  ): Promise<FileDetails> {
    const searchParams = new URLSearchParams({
      presigned: `${getPresignedUrl}`,
    }).toString()
    const path = `${getFileDetailsPath(fileId)}?${searchParams}`
    const response = await this.get<FileDetails>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getFileDetailsBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Return a Datalink.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createDatalink(body: CreateDatalinkRequestBody): Promise<DatalinkInfo> {
    const path = CREATE_DATALINK_PATH
    const response = await this.post<DatalinkInfo>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createDatalinkBackendError', body.name)
    } else {
      return await response.json()
    }
  }

  /**
   * Return a Datalink.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getDatalink(datalinkId: DatalinkId, title: string): Promise<Datalink> {
    const path = getDatalinkPath(datalinkId)
    const response = await this.get<Datalink>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getDatalinkBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Delete a Datalink.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async deleteDatalink(datalinkId: DatalinkId, title: string): Promise<void> {
    const path = getDatalinkPath(datalinkId)
    const response = await this.delete(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'deleteDatalinkBackendError', title)
    } else {
      return
    }
  }

  /**
   * Create a secret environment variable.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createSecret(body: CreateSecretRequestBody): Promise<SecretId> {
    const path = CREATE_SECRET_PATH
    const response = await this.post<SecretId>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createSecretBackendError', body.name)
    } else {
      return await response.json()
    }
  }

  /**
   * Return a secret environment variable.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getSecret(secretId: SecretId, title: string): Promise<Secret> {
    const path = getSecretPath(secretId)
    const response = await this.get<Secret>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getSecretBackendError', title)
    } else {
      return await response.json()
    }
  }

  /**
   * Update a secret environment variable.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async updateSecret(
    secretId: SecretId,
    body: UpdateSecretRequestBody,
    title: string,
  ): Promise<void> {
    const path = updateSecretPath(secretId)
    const response = await this.put(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'updateSecretBackendError', title)
    } else {
      return
    }
  }

  /**
   * Return the secret environment variables accessible by the user.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listSecrets(): Promise<readonly SecretInfo[]> {
    const path = LIST_SECRETS_PATH
    const response = await this.get<ListSecretsResponseBody>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listSecretsBackendError')
    } else {
      return (await response.json()).secrets
    }
  }

  /**
   * Create a label used for categorizing assets.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createTag(body: CreateTagRequestBody): Promise<Label> {
    const path = CREATE_TAG_PATH
    const response = await this.post<Label>(path, body)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createLabelBackendError', body.value)
    } else {
      return await response.json()
    }
  }

  /**
   * Return all labels accessible by the user.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listTags(): Promise<readonly Label[]> {
    const path = LIST_TAGS_PATH
    const response = await this.get<ListTagsResponseBody>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'listLabelsBackendError')
    } else {
      return (await response.json()).tags
    }
  }

  /**
   * Set the full list of labels for a specific asset.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async associateTag(assetId: AssetId, labels: LabelName[], title: string) {
    const path = associateTagPath(assetId)
    const response = await this.patch<ListTagsResponseBody>(path, { labels })
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'associateLabelsBackendError', title)
    } else {
      return
    }
  }

  /**
   * Delete a label.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async deleteTag(tagId: TagId, value: LabelName): Promise<void> {
    const path = deleteTagPath(tagId)
    const response = await this.delete(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'deleteLabelBackendError', value)
    } else {
      return
    }
  }

  /** Create a user group. */
  override async createUserGroup(body: CreateUserGroupRequestBody): Promise<UserGroupInfo> {
    const path = CREATE_USER_GROUP_PATH
    const response = await this.post<UserGroupInfo>(path, body)
    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'createUserGroupBackendError', body.name)
    } else {
      return await response.json()
    }
  }

  /** Delete a user group. */
  override async deleteUserGroup(userGroupId: UserGroupId, name: string): Promise<void> {
    const path = deleteUserGroupPath(userGroupId)
    const response = await this.delete(path)
    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'deleteUserGroupBackendError', name)
    } else {
      return
    }
  }

  /**
   * List all roles in the organization.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async listUserGroups(): Promise<UserGroupInfo[]> {
    const path = LIST_USER_GROUPS_PATH
    const response = await this.get<UserGroupInfo[]>(path)
    if (response.status === STATUS_NOT_ALLOWED) {
      return [] as const
    } else if (!responseIsSuccessful(response)) {
      return this.throw(response, 'listUserGroupsBackendError')
    } else {
      return await response.json()
    }
  }

  /**
   * Create a payment checkout session.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async createCheckoutSession(
    params: CreateCheckoutSessionRequestBody,
  ): Promise<CheckoutSession> {
    const response = await this.post<CheckoutSession>(CREATE_CHECKOUT_SESSION_PATH, params)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'createCheckoutSessionBackendError', params.plan)
    } else {
      return await response.json()
    }
  }

  /**
   * Gets the status of a payment checkout session.
   * @throws An error if a non-successful status code (not 200-299) was received.
   */
  override async getCheckoutSession(sessionId: CheckoutSessionId): Promise<CheckoutSessionStatus> {
    const path = getCheckoutSessionPath(sessionId)
    const response = await this.get<CheckoutSessionStatus>(path)
    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getCheckoutSessionBackendError', sessionId)
    } else {
      return await response.json()
    }
  }

  /** List events in the organization's audit log. */
  override async getLogEvents(): Promise<Event[]> {
    /** The type of the response body of this endpoint. */
    interface ResponseBody {
      readonly events: Event[]
    }

    const path = GET_LOG_EVENTS_PATH
    const response = await this.get<ResponseBody>(path)
    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'getLogEventsBackendError')
    } else {
      const json = await response.json()
      return json.events
    }
  }

  /** Log an event that will be visible in the organization audit log. */
  async logEvent(message: string, projectId?: string | null, metadata?: object | null) {
    // Prevent events from being logged in dev mode, since we are often using production environment
    // and are polluting real logs.
    if (IS_DEV_MODE && process.env.ENSO_CLOUD_ENVIRONMENT === 'production') {
      return
    }

    const path = POST_LOG_EVENT_PATH
    const response = await this.post(
      path,
      {
        message,
        projectId,
        metadata: {
          timestamp: new Date().toISOString(),
          ...(metadata ?? {}),
        },
      },
      {
        keepalive: true,
      },
    )
    if (!responseIsSuccessful(response)) {
      return this.throw(response, 'logEventBackendError', message)
    }
  }

  /** Download from an arbitrary URL that is assumed to originate from this backend. */
  override async download(url: string, name?: string) {
    download(url, name)
    return Promise.resolve()
  }

  /** Fetch the URL of the customer portal. */
  override async createCustomerPortalSession() {
    const response = await this.post<CreateCustomerPortalSessionResponse>(
      getCustomerPortalSessionPath(),
      {},
    )

    if (!responseIsSuccessful(response)) {
      return await this.throw(response, 'getCustomerPortalUrlBackendError')
    } else {
      return (await response.json()).url
    }
  }

  /**
   * Resolve the path of a project asset relative to the project `src` directory.
   */
  override async resolveProjectAssetPath(
    projectId: ProjectId,
    relativePath: string,
  ): Promise<string> {
    const response = await this.get<string>(getProjectAssetPath(projectId, relativePath))

    if (!responseIsSuccessful(response)) {
      return Promise.reject(new Error('Not implemented.'))
    } else {
      return await response.text()
    }
  }

  /**
   * Replaces the `user` of all permissions for the current user on an asset, so that they always
   * return the up-to-date user.
   */
  private dynamicAssetUser<Asset extends AnyAsset>(asset: Asset) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    let foundSelfPermission = (() => false)()
    const permissions = asset.permissions?.map((permission) => {
      if (!('user' in permission) || permission.user.userId !== this.user?.userId) {
        return permission
      } else {
        foundSelfPermission = true
        return {
          ...permission,
          /** Return a dynamic reference to the current user. */
          get user() {
            return self.user
          },
        }
      }
    })
    return !foundSelfPermission ? asset : { ...asset, permissions }
  }

  /** Send an HTTP GET request to the given path. */
  private get<T = void>(path: string) {
    return this.client.get<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`)
  }

  /** Send a JSON HTTP POST request to the given path. */
  private post<T = void>(path: string, payload: object, options?: RemoteBackendPostOptions) {
    return this.client.post<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload, options)
  }

  /** Send a binary HTTP POST request to the given path. */
  private postBinary<T = void>(path: string, payload: Blob) {
    return this.client.postBinary<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload)
  }

  /** Send a JSON HTTP PATCH request to the given path. */
  private patch<T = void>(path: string, payload: object) {
    return this.client.patch<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload)
  }

  /** Send a JSON HTTP PUT request to the given path. */
  private put<T = void>(path: string, payload: object) {
    return this.client.put<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload)
  }

  /** Send a binary HTTP PUT request to the given path. */
  private putBinary<T = void>(path: string, payload: Blob) {
    return this.client.putBinary<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload)
  }

  /** Send an HTTP DELETE request to the given path. */
  private delete<T = void>(path: string, payload?: Record<string, unknown>) {
    return this.client.delete<T>(`${process.env.ENSO_CLOUD_API_URL}/${path}`, payload)
  }
}
