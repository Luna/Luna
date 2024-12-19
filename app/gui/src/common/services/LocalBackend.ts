/**
 * @file Module containing the API client for the local backend API.
 *
 * Each exported function in the {@link LocalBackend} in this module corresponds to an API endpoint.
 * The functions are asynchronous and return a {@link Promise} that resolves to the response from
 * the API.
 */
import invariant from 'tiny-invariant'

import {
  Address,
  AssetType,
  Backend,
  BackendType,
  DirectoryDoesNotExistError,
  DirectoryId,
  FileId,
  OrganizationId,
  ProjectId,
  ProjectState,
  S3FilePath,
  compareAssets,
  detectVersionLifecycle,
  fileIsNotProject,
  stripProjectExtension,
  type AnyAsset,
  type AssetId,
  type CopyAssetResponse,
  type CreateDirectoryRequestBody,
  type CreateProjectRequestBody,
  type CreatedDirectory,
  type CreatedProject,
  type DeleteAssetRequestBody,
  type DirectoryAsset,
  type FileAsset,
  type ListDirectoryRequestParams,
  type ListedProject,
  type OpenProjectRequestBody,
  type OrganizationInfo,
  type Project,
  type ProjectAsset,
  type S3MultipartPart,
  type UpdateAssetRequestBody,
  type UpdateDirectoryRequestBody,
  type UpdateFileRequestBody,
  type UpdateProjectRequestBody,
  type UpdatedDirectory,
  type UpdatedProject,
  type UploadFileEndRequestBody,
  type UploadFileRequestParams,
  type UploadLargeFileMetadata,
  type UploadedLargeAsset,
  type User,
} from '@common/services/Backend'
import { fileExtension, getFileName, getFolderPath } from '@common/utilities/data/fileInfo'
import { getDirectoryAndName, joinPath } from '@common/utilities/data/path'
import { download } from '@common/utilities/download'
import { tryGetMessage } from '@common/utilities/error'
import { uniqueString } from '@common/utilities/uniqueString'

import { APP_BASE_URL } from '#/utilities/appBaseUrl'
import type ProjectManager from '@common/services/ProjectManager'
import {
  FileSystemEntryType,
  MissingComponentAction,
  Path,
  ProjectName,
  UUID,
  type IpWithSocket,
} from '@common/services/ProjectManager'

/** Convert a {@link IpWithSocket} to a {@link Address}. */
function ipWithSocketToAddress(ipWithSocket: IpWithSocket) {
  return Address(`ws://${ipWithSocket.host}:${ipWithSocket.port}`)
}

/** Create a {@link DirectoryId} from a path. */
export function newDirectoryId(path: Path) {
  return DirectoryId(`${AssetType.directory}-${path}`)
}

/** Create a {@link ProjectId} from a UUID. */
export function newProjectId(uuid: UUID) {
  return ProjectId(`${AssetType.project}-${uuid}`)
}

/** Create a {@link FileId} from a path. */
export function newFileId(path: Path) {
  return FileId(`${AssetType.file}-${path}`)
}

/** The internal asset type and properly typed corresponding internal ID of a directory. */
interface DirectoryTypeAndId {
  readonly type: AssetType.directory
  readonly id: Path
}

/** The internal asset type and properly typed corresponding internal ID of a project. */
interface ProjectTypeAndId {
  readonly type: AssetType.project
  readonly id: UUID
}

/** The internal asset type and properly typed corresponding internal ID of a file. */
interface FileTypeAndId {
  readonly type: AssetType.file
  readonly id: Path
}

/** The internal asset type and properly typed corresponding internal ID of an arbitrary asset. */
type AssetTypeAndId<Id extends AssetId = AssetId> =
  | (DirectoryId extends Id ? DirectoryTypeAndId : never)
  | (FileId extends Id ? FileTypeAndId : never)
  | (ProjectId extends Id ? ProjectTypeAndId : never)

export function extractTypeAndId<Id extends AssetId>(id: Id): AssetTypeAndId<Id>
/**
 * Extracts the asset type and its corresponding internal ID from a {@link AssetId}.
 * @throws {Error} if the id has an unknown type.
 */
export function extractTypeAndId<Id extends AssetId>(id: Id): AssetTypeAndId {
  const [, typeRaw, idRaw = ''] = id.match(/(.+?)-(.+)/) ?? []
  switch (typeRaw) {
    case AssetType.directory: {
      return { type: AssetType.directory, id: Path(idRaw) }
    }
    case AssetType.project: {
      return { type: AssetType.project, id: UUID(idRaw) }
    }
    case AssetType.file: {
      return { type: AssetType.file, id: Path(idRaw) }
    }
    default: {
      throw new Error(`Invalid type '${typeRaw}'`)
    }
  }
}

/**
 * Class for sending requests to the Project Manager API endpoints.
 * This is used instead of the cloud backend API when managing local projects from the dashboard.
 */
export class LocalBackend extends Backend {
  readonly type = BackendType.local
  /** All files that have been uploaded to the Project Manager. */
  uploadedFiles: Map<string, UploadedLargeAsset> = new Map()
  private readonly projectManager: ProjectManager

  /** Create a {@link LocalBackend}. */
  constructor(projectManagerInstance: ProjectManager) {
    super()

    this.projectManager = projectManagerInstance
  }

  /** Get the root directory of this Backend. */
  override rootPath() {
    return this.projectManager.rootDirectory
  }

  /** Set the root directory of this Backend. */
  setRootPath(value: Path) {
    this.projectManager.rootDirectory = value
  }

  /** Reset the root directory of this Backend. */
  resetRootPath() {
    this.projectManager.resetRootDirectory()
  }

  /** Tell the {@link ProjectManager} to reconnect. */
  async reconnectProjectManager() {
    await this.projectManager.reconnect()
  }

  /** Return the ID of the root directory. */
  override rootDirectoryId(
    _user: User,
    _organization: OrganizationInfo | null,
    rootDirectory: Path | null | undefined,
  ): DirectoryId {
    return newDirectoryId(rootDirectory ?? this.projectManager.rootDirectory)
  }

  /**
   * Return a list of assets in a directory.
   * @throws An error if the JSON-RPC call fails.
   */
  override async listDirectory(query: ListDirectoryRequestParams): Promise<readonly AnyAsset[]> {
    const parentIdRaw = query.parentId == null ? null : extractTypeAndId(query.parentId).id
    const parentId = query.parentId ?? newDirectoryId(this.projectManager.rootDirectory)

    // Catch the case where the directory does not exist.
    let result: AnyAsset[] = []
    try {
      const entries = await this.projectManager.listDirectory(parentIdRaw)
      result = entries
        .map((entry) => {
          switch (entry.type) {
            case FileSystemEntryType.DirectoryEntry: {
              return {
                type: AssetType.directory,
                id: newDirectoryId(entry.path),
                modifiedAt: entry.attributes.lastModifiedTime,
                parentId,
                title: getFileName(entry.path),
                permissions: [],
                projectState: null,
                extension: null,
                labels: [],
                description: null,
                parentsPath: '',
                virtualParentsPath: '',
              } satisfies DirectoryAsset
            }
            case FileSystemEntryType.ProjectEntry: {
              return {
                type: AssetType.project,
                id: newProjectId(entry.metadata.id),
                title: entry.metadata.name,
                modifiedAt: entry.metadata.lastOpened ?? entry.metadata.created,
                parentId,
                permissions: [],
                projectState: {
                  type:
                    this.projectManager.projects.get(entry.metadata.id)?.state ??
                    ProjectState.closed,
                  volumeId: '',
                },
                extension: null,
                labels: [],
                description: null,
                parentsPath: '',
                virtualParentsPath: '',
              } satisfies ProjectAsset
            }
            case FileSystemEntryType.FileEntry: {
              return {
                type: AssetType.file,
                id: newFileId(entry.path),
                title: getFileName(entry.path),
                modifiedAt: entry.attributes.lastModifiedTime,
                parentId,
                permissions: [],
                projectState: null,
                extension: fileExtension(entry.path),
                labels: [],
                description: null,
                parentsPath: '',
                virtualParentsPath: '',
              } satisfies FileAsset
            }
          }
        })
        .sort(compareAssets)
    } catch {
      // Failed so check if exists
      if (!(await this.projectManager.exists(parentIdRaw))) {
        if (parentIdRaw === this.projectManager.rootDirectory) {
          // Auto create the root directory
          await this.projectManager.createDirectory(this.projectManager.rootDirectory)

          result = []
        } else {
          throw new DirectoryDoesNotExistError()
        }
      }
    }

    return result
  }

  /**
   * Return a list of projects belonging to the current user.
   * @throws An error if the JSON-RPC call fails.
   */
  override async listProjects(): Promise<readonly ListedProject[]> {
    const result = await this.projectManager.listProjects({})
    return result.projects.map((project) => ({
      name: project.name,
      organizationId: OrganizationId(''),
      projectId: newProjectId(project.id),
      packageName: project.name,
      state: {
        type: ProjectState.closed,
        volumeId: '',
      },
      jsonAddress: null,
      binaryAddress: null,
      ydocAddress: null,
    }))
  }

  /**
   * Create a project.
   * @throws An error if the JSON-RPC call fails.
   */
  override async createProject(body: CreateProjectRequestBody): Promise<CreatedProject> {
    const projectsDirectory =
      body.parentDirectoryId == null ? null : extractTypeAndId(body.parentDirectoryId).id
    const project = await this.projectManager.createProject({
      name: ProjectName(body.projectName),
      ...(body.projectTemplateName != null ? { projectTemplate: body.projectTemplateName } : {}),
      missingComponentAction: MissingComponentAction.install,
      ...(projectsDirectory == null ? {} : { projectsDirectory }),
    })
    return {
      name: project.projectName,
      organizationId: OrganizationId(''),
      projectId: newProjectId(project.projectId),
      packageName: project.projectName,
      state: { type: ProjectState.closed, volumeId: '' },
    }
  }

  /**
   * Close the project identified by the given project ID.
   * @throws An error if the JSON-RPC call fails.
   */
  override async closeProject(projectId: ProjectId, title: string | null): Promise<void> {
    const { id } = extractTypeAndId(projectId)
    try {
      const state = this.projectManager.projects.get(id)
      if (state?.state === ProjectState.openInProgress) {
        // Projects that are not opened cannot be closed.
        // This is the only way to wait until the project is open.
        await this.projectManager.openProject({
          projectId: id,
          missingComponentAction: MissingComponentAction.install,
        })
      }
      await this.projectManager.closeProject({ projectId: id })
      return
    } catch (error) {
      throw new Error(
        `Could not close project ${title != null ? `'${title}'` : `with ID '${projectId}'`}: ${
          tryGetMessage(error) ?? 'unknown error'
        }.`,
      )
    }
  }

  /**
   * Close the project identified by the given project ID.
   * @throws An error if the JSON-RPC call fails.
   */
  override async getProjectDetails(
    projectId: ProjectId,
    directory: DirectoryId | null,
  ): Promise<Project> {
    const { id } = extractTypeAndId(projectId)
    const state = this.projectManager.projects.get(id)
    if (state == null) {
      const directoryId = directory == null ? null : extractTypeAndId(directory).id
      const entries = await this.projectManager.listDirectory(directoryId)
      const project = entries
        .flatMap((entry) =>
          entry.type === FileSystemEntryType.ProjectEntry ? [entry.metadata] : [],
        )
        .find((metadata) => metadata.id === id)
      if (project == null) {
        throw new Error(`Could not get details of project.`)
      } else {
        const version =
          project.engineVersion == null ?
            null
          : {
              lifecycle: detectVersionLifecycle(project.engineVersion),
              value: project.engineVersion,
            }
        return {
          name: project.name,
          engineVersion: version,
          ideVersion: version,
          jsonAddress: null,
          binaryAddress: null,
          ydocAddress: null,
          organizationId: OrganizationId(''),
          packageName: project.name,
          projectId,
          state: { type: ProjectState.closed, volumeId: '' },
        }
      }
    } else {
      const cachedProject = await state.data
      return {
        name: cachedProject.projectName,
        engineVersion: {
          lifecycle: detectVersionLifecycle(cachedProject.engineVersion),
          value: cachedProject.engineVersion,
        },
        ideVersion: {
          lifecycle: detectVersionLifecycle(cachedProject.engineVersion),
          value: cachedProject.engineVersion,
        },
        jsonAddress: ipWithSocketToAddress(cachedProject.languageServerJsonAddress),
        binaryAddress: ipWithSocketToAddress(cachedProject.languageServerBinaryAddress),
        ydocAddress: null,
        organizationId: OrganizationId(''),
        packageName: cachedProject.projectNormalizedName,
        projectId,
        state: {
          type: ProjectState.opened,
          volumeId: '',
        },
      }
    }
  }

  /**
   * Prepare a project for execution.
   * @throws An error if the JSON-RPC call fails.
   */
  override async openProject(
    projectId: ProjectId,
    body: OpenProjectRequestBody | null,
    title: string | null,
  ): Promise<void> {
    const { id } = extractTypeAndId(projectId)
    try {
      await this.projectManager.openProject({
        projectId: id,
        missingComponentAction: MissingComponentAction.install,
        ...(body?.parentId != null ?
          { projectsDirectory: extractTypeAndId(body.parentId).id }
        : {}),
      })
      return
    } catch (error) {
      throw new Error(
        `Could not open project ${title != null ? `'${title}'` : `with ID '${projectId}'`}: ${
          tryGetMessage(error) ?? 'unknown error'
        }.`,
      )
    }
  }

  /**
   * Change the name of a project.
   * @throws An error if the JSON-RPC call fails.
   */
  override async updateProject(
    projectId: ProjectId,
    body: UpdateProjectRequestBody,
  ): Promise<UpdatedProject> {
    if (body.ami != null) {
      throw new Error('Cannot change project AMI on local backend.')
    } else {
      const { id } = extractTypeAndId(projectId)
      if (body.projectName != null) {
        await this.projectManager.renameProject({
          projectId: id,
          name: ProjectName(body.projectName),
        })
      }
      const parentPath = getDirectoryAndName(this.projectManager.getProjectPath(id)).directoryPath
      const result = await this.projectManager.listDirectory(parentPath)
      const project = result.flatMap((listedProject) =>
        (
          listedProject.type === FileSystemEntryType.ProjectEntry &&
          listedProject.metadata.id === id
        ) ?
          [listedProject.metadata]
        : [],
      )[0]
      const version =
        project?.engineVersion == null ?
          null
        : {
            lifecycle: detectVersionLifecycle(project.engineVersion),
            value: project.engineVersion,
          }
      if (project == null) {
        throw new Error(`The project ID '${projectId}' is invalid.`)
      } else {
        return {
          ami: null,
          engineVersion: version,
          ideVersion: version,
          name: project.name,
          organizationId: OrganizationId(''),
          projectId,
        }
      }
    }
  }

  /** Duplicate a specific version of a project. */
  override async duplicateProject(projectId: ProjectId): Promise<CreatedProject> {
    const id = extractTypeAndId(projectId).id
    const project = await this.projectManager.duplicateProject({ projectId: id })
    return {
      projectId: newProjectId(project.projectId),
      name: project.projectName,
      packageName: project.projectNormalizedName,
      organizationId: OrganizationId(''),
      state: { type: ProjectState.closed, volumeId: '' },
    }
  }

  /**
   * Delete an arbitrary asset.
   * @throws An error if the JSON-RPC call fails.
   */
  override async deleteAsset(
    assetId: AssetId,
    _body: DeleteAssetRequestBody,
    title: string | null,
  ): Promise<void> {
    const typeAndId = extractTypeAndId(assetId)
    switch (typeAndId.type) {
      case AssetType.directory:
      case AssetType.file: {
        await this.projectManager.deleteFile(typeAndId.id)
        return
      }
      case AssetType.project: {
        try {
          await this.projectManager.deleteProject({ projectId: typeAndId.id })
          return
        } catch (error) {
          throw new Error(
            `Could not delete project ${
              title != null ? `'${title}'` : `with ID '${typeAndId.id}'`
            }: ${tryGetMessage(error) ?? 'unknown error'}.`,
          )
        }
      }
    }
  }

  /** Copy an arbitrary asset to another directory. */
  override async copyAsset(
    assetId: AssetId,
    parentDirectoryId: DirectoryId,
  ): Promise<CopyAssetResponse> {
    const typeAndId = extractTypeAndId(assetId)
    if (typeAndId.type !== AssetType.project) {
      throw new Error('Only projects can be copied on the Local Backend.')
    } else {
      const project = await this.projectManager.duplicateProject({ projectId: typeAndId.id })
      const projectPath = this.projectManager.projectPaths.get(typeAndId.id)
      const parentPath = projectPath == null ? null : getDirectoryAndName(projectPath).directoryPath
      if (parentPath !== extractTypeAndId(parentDirectoryId).id) {
        throw new Error('Cannot duplicate project to a different directory on the Local Backend.')
      } else {
        const asset = {
          id: newProjectId(project.projectId),
          parentId: parentDirectoryId,
          title: project.projectName,
        }
        return { asset }
      }
    }
  }

  // === Endpoints that intentionally do not work on the Local Backend ===

  /**
   * Called for any function that does not make sense in the Local Backend.
   * @throws An error stating that the operation is intentionally unavailable on the local
   * backend.
   */
  invalidOperation(): never {
    throw new Error('Cannot manage users, folders, files, tags, and secrets on the local backend.')
  }

  /** Invalid operation. */
  override undoDeleteAsset(): Promise<void> {
    return this.invalidOperation()
  }

  /** Return an empty array. */
  override listUsers() {
    return Promise.resolve([])
  }

  /** Invalid operation. */
  override createUser() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override updateUser() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override restoreUser() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override deleteUser() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override removeUser() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override uploadUserPicture() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override changeUserGroup() {
    return this.invalidOperation()
  }

  /**
   * Get the current organization. Returns `null` because organizations do not exist on the
   * Local Backend. This is required for `rootDiretoryId` to work.
   */
  override async getOrganization(): Promise<OrganizationInfo | null> {
    return Promise.resolve(null)
  }

  /** Invalid operation. */
  override updateOrganization() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override uploadOrganizationPicture() {
    return this.invalidOperation()
  }

  /** Do nothing. This function should never need to be called. */
  override inviteUser() {
    return Promise.resolve()
  }

  /** Do nothing. This function should never need to be called. */
  override createPermission() {
    return Promise.resolve()
  }

  /** Return `null`. This function should never need to be called. */
  override usersMe() {
    return this.invalidOperation()
  }

  /** Create a directory. */
  override async createDirectory(body: CreateDirectoryRequestBody): Promise<CreatedDirectory> {
    const parentDirectoryPath =
      body.parentId == null ? this.projectManager.rootDirectory : extractTypeAndId(body.parentId).id
    const path = joinPath(parentDirectoryPath, body.title)
    await this.projectManager.createDirectory(path)
    return {
      id: newDirectoryId(path),
      parentId: newDirectoryId(parentDirectoryPath),
      title: body.title,
    }
  }

  /**
   * Change the parent directory of an asset.
   * Changing the description is NOT supported.
   */
  override async updateAsset(assetId: AssetId, body: UpdateAssetRequestBody): Promise<void> {
    if (body.parentDirectoryId != null) {
      const typeAndId = extractTypeAndId(assetId)
      const from =
        typeAndId.type !== AssetType.project ?
          typeAndId.id
        : this.projectManager.getProjectPath(typeAndId.id)
      const fileName = getFileName(from)
      const to = joinPath(extractTypeAndId(body.parentDirectoryId).id, fileName)
      await this.projectManager.moveFile(from, to)
    }
  }

  /**
   * Begin uploading a large file.
   */
  override async uploadFileStart(
    body: UploadFileRequestParams,
    file: File,
  ): Promise<UploadLargeFileMetadata> {
    const parentPath =
      body.parentDirectoryId == null ?
        this.projectManager.rootDirectory
      : extractTypeAndId(body.parentDirectoryId).id
    const filePath = joinPath(parentPath, body.fileName)
    const uploadId = uniqueString()
    if (fileIsNotProject(file)) {
      const searchParams = new URLSearchParams([
        ['file_name', body.fileName],
        ...(body.parentDirectoryId == null ? [] : [['directory', parentPath]]),
      ]).toString()
      const path = `${APP_BASE_URL}/api/upload-file?${searchParams}`
      await fetch(path, { method: 'POST', body: file })
      this.uploadedFiles.set(uploadId, { id: newFileId(filePath), project: null })
    } else {
      const title = stripProjectExtension(body.fileName)
      let id: string
      if (
        'backendApi' in window &&
        // This non-standard property is defined in Electron.
        'path' in file &&
        typeof file.path === 'string'
      ) {
        const projectInfo = await window.backendApi.importProjectFromPath(
          file.path,
          parentPath,
          title,
        )
        id = projectInfo.id
      } else {
        const searchParams = new URLSearchParams({
          directory: parentPath,
          name: title,
        }).toString()
        const path = `${APP_BASE_URL}/api/upload-project?${searchParams}`
        const response = await fetch(path, { method: 'POST', body: file })
        id = await response.text()
      }
      const projectId = newProjectId(UUID(id))
      const project = await this.getProjectDetails(projectId, body.parentDirectoryId)
      this.uploadedFiles.set(uploadId, { id: projectId, project })
    }
    return { presignedUrls: [], uploadId, sourcePath: S3FilePath('') }
  }

  /** Upload a chunk of a large file. */
  override uploadFileChunk(): Promise<S3MultipartPart> {
    // Do nothing, the entire file has already been uploaded in `uploadFileStart`.
    return Promise.resolve({ eTag: '', partNumber: 0 })
  }

  /** Finish uploading a large file. */
  override uploadFileEnd(body: UploadFileEndRequestBody): Promise<UploadedLargeAsset> {
    // Do nothing, the entire file has already been uploaded in `uploadFileStart`.
    const file = this.uploadedFiles.get(body.uploadId)
    invariant(file, 'Uploaded file not found')
    return Promise.resolve(file)
  }

  /** Change the name of a file. */
  override async updateFile(fileId: FileId, body: UpdateFileRequestBody): Promise<void> {
    const typeAndId = extractTypeAndId(fileId)
    const from = typeAndId.id
    const folderPath = getFolderPath(from)
    const to = joinPath(Path(folderPath), body.title)
    await this.projectManager.moveFile(from, to)
  }

  /** Get the path of a project. */
  getProjectPath(id: ProjectId) {
    return this.projectManager.getProjectPath(extractTypeAndId(id).id)
  }

  /** Construct a new path using the given parent directory and a file name. */
  joinPath(parentId: DirectoryId, fileName: string) {
    return joinPath(extractTypeAndId(parentId).id, fileName)
  }

  /** Change the name of a directory. */
  override async updateDirectory(
    directoryId: DirectoryId,
    body: UpdateDirectoryRequestBody,
  ): Promise<UpdatedDirectory> {
    const from = extractTypeAndId(directoryId).id
    const folderPath = Path(getFolderPath(from))
    const to = joinPath(folderPath, body.title)
    await this.projectManager.moveFile(from, to)
    return {
      id: newDirectoryId(to),
      parentId: newDirectoryId(folderPath),
      title: body.title,
    }
  }

  /** Download from an arbitrary URL that is assumed to originate from this backend. */
  override async download(url: string, name?: string) {
    download(url, name)
    return Promise.resolve()
  }

  /** Invalid operation. */
  override restoreProject() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override listAssetVersions() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override checkResources() {
    return this.invalidOperation()
  }

  /** Return an empty array. This function should never need to be called. */
  override listFiles() {
    return Promise.resolve([])
  }

  /** Invalid operation. */
  override getFileDetails() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override listProjectSessions() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override getProjectSessionLogs() {
    return this.invalidOperation()
  }

  /**
   * Get the content of a file.
   *
   * Versioning is not supported on the Local Backend, thus the `versionId` parameter is ignored.
   */
  override getFileContent(projectId: ProjectId) {
    return this.projectManager.getFileContent(extractTypeAndId(projectId).id)
  }

  /**
   * Resolve the path of a project asset relative to the project `src` directory.
   */
  override resolveProjectAssetPath(projectId: ProjectId, relativePath: string) {
    const projectPath = this.getProjectPath(projectId)

    return Promise.resolve(`enso://${projectPath}/src/${relativePath.replace('./', '')}`)
  }

  /** Invalid operation. */
  override createDatalink() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override getDatalink() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override deleteDatalink() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override createSecret() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override updateSecret() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override getSecret() {
    return this.invalidOperation()
  }

  /** Return an empty array. This function should never need to be called. */
  override listSecrets() {
    return Promise.resolve([])
  }

  /** Invalid operation. */
  override createTag() {
    return this.invalidOperation()
  }

  /**
   * Return an empty array. This function is required to be implemented as it is unconditionally
   * called, but its result should never need to be used.
   */
  override listTags() {
    return Promise.resolve([])
  }

  /** Do nothing. This function should never need to be called. */
  override associateTag() {
    return Promise.resolve()
  }

  /** Do nothing. This function should never need to be called. */
  override deleteTag() {
    return Promise.resolve()
  }

  /** Invalid operation. */
  override createUserGroup() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override createCheckoutSession() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override deleteUserGroup() {
    return this.invalidOperation()
  }

  /** Return an empty array. */
  override listUserGroups() {
    return Promise.resolve([])
  }

  /** Invalid operation. */
  override getCheckoutSession() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override listInvitations() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override deleteInvitation() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override resendInvitation() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override acceptInvitation() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override declineInvitation() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override getLogEvents() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override logEvent() {
    return this.invalidOperation()
  }

  /** Invalid operation. */
  override createCustomerPortalSession() {
    return this.invalidOperation()
  }
}
