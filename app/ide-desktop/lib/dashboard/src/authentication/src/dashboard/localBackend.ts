/** @file Module containing the API client for the local backend API.
 *
 * Each exported function in the {@link LocalBackend} in this module corresponds to an API endpoint.
 * The functions are asynchronous and return a {@link Promise} that resolves to the response from
 * the API. */
import * as backend from './backend'
import * as newtype from '../newtype'
import * as platformModule from '../platform'
import * as projectManager from './projectManager'

// ========================
// === Helper functions ===
// ========================

function ipWithSocketToAddress(ipWithSocket: projectManager.IpWithSocket) {
    return newtype.asNewtype<backend.Address>(`ws://${ipWithSocket.host}:${ipWithSocket.port}`)
}

// ====================
// === LocalBackend ===
// ====================

/** The currently open project and its ID. */
interface CurrentlyOpenProjectInfo {
    id: projectManager.ProjectId
    project: projectManager.OpenProject
}

/** Class for sending requests to the Project Manager API endpoints.
 * This is used instead of the cloud backend API when managing local projects from the dashboard. */
export class LocalBackend implements Partial<backend.Backend> {
    readonly platform = platformModule.Platform.desktop
    private readonly projectManager = projectManager.ProjectManager.default()
    private currentlyOpeningProjectId: string | null = null
    private currentlyOpenProject: CurrentlyOpenProjectInfo | null = null

    async listDirectory(): Promise<backend.Asset[]> {
        const result = await this.projectManager.listProjects({})
        return result.projects.map(project => ({
            type: backend.AssetType.project,
            title: project.name,
            id: project.id,
            parentId: '',
            permissions: [],
        }))
    }

    async listProjects(): Promise<backend.ListedProject[]> {
        const result = await this.projectManager.listProjects({})
        return result.projects.map(project => ({
            name: project.name,
            organizationId: '',
            projectId: project.id,
            packageName: project.name,
            state: {
                type: backend.ProjectState.created,
            },
            jsonAddress: null,
            binaryAddress: null,
        }))
    }

    async createProject(body: backend.CreateProjectRequestBody): Promise<backend.CreatedProject> {
        const project = await this.projectManager.createProject({
            name: newtype.asNewtype<projectManager.ProjectName>(body.projectName),
            ...(body.projectTemplateName ? { projectTemplate: body.projectTemplateName } : {}),
            missingComponentAction: projectManager.MissingComponentAction.install,
        })
        return {
            name: body.projectName,
            organizationId: '',
            projectId: project.projectId,
            packageName: body.projectName,
            state: {
                type: backend.ProjectState.created,
            },
        }
    }

    async closeProject(projectId: backend.ProjectId): Promise<void> {
        if (this.currentlyOpeningProjectId === projectId) {
            this.currentlyOpeningProjectId = null
        }
        await this.projectManager.closeProject({ projectId })
        this.currentlyOpenProject = null
    }

    async getProjectDetails(projectId: backend.ProjectId): Promise<backend.Project> {
        if (projectId !== this.currentlyOpenProject?.id) {
            const result = await this.projectManager.listProjects({})
            const project = result.projects.find(listedProject => listedProject.id === projectId)
            const engineVersion = project?.engineVersion
            if (project == null) {
                throw new Error(`The project ID '${projectId}' is invalid.`)
            } else if (engineVersion == null) {
                throw new Error(`The project '${projectId}' does not have an engine version.`)
            } else {
                return Promise.resolve<backend.Project>({
                    name: project.name,
                    engineVersion: {
                        lifecycle: backend.VersionLifecycle.stable,
                        value: engineVersion,
                    },
                    ideVersion: {
                        lifecycle: backend.VersionLifecycle.stable,
                        value: engineVersion,
                    },
                    jsonAddress: null,
                    binaryAddress: null,
                    organizationId: '',
                    packageName: project.name,
                    projectId,
                    state: {
                        type:
                            projectId === this.currentlyOpeningProjectId
                                ? backend.ProjectState.openInProgress
                                : backend.ProjectState.closed,
                    },
                })
            }
        } else {
            const project = this.currentlyOpenProject.project
            return Promise.resolve<backend.Project>({
                name: project.projectName,
                engineVersion: {
                    lifecycle: backend.VersionLifecycle.stable,
                    value: project.engineVersion,
                },
                ideVersion: {
                    lifecycle: backend.VersionLifecycle.stable,
                    value: project.engineVersion,
                },
                jsonAddress: ipWithSocketToAddress(project.languageServerJsonAddress),
                binaryAddress: ipWithSocketToAddress(project.languageServerBinaryAddress),
                organizationId: '',
                packageName: project.projectName,
                projectId,
                state: {
                    type: backend.ProjectState.opened,
                },
            })
        }
    }

    async openProject(projectId: backend.ProjectId): Promise<void> {
        this.currentlyOpeningProjectId = projectId
        const project = await this.projectManager.openProject({
            projectId,
            missingComponentAction: projectManager.MissingComponentAction.install,
        })
        this.currentlyOpenProject = { id: projectId, project }
    }

    async deleteProject(projectId: backend.ProjectId): Promise<void> {
        if (this.currentlyOpeningProjectId === projectId) {
            this.currentlyOpeningProjectId = null
        }
        await this.projectManager.deleteProject({ projectId })
        if (this.currentlyOpenProject?.id === projectId) {
            this.currentlyOpenProject = null
        }
    }
}
