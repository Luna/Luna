/** @file Renders the list of templates that can be used to create a project from. */
import * as React from 'react'

// =================
// === Templates ===
// =================

/** Define the template type to render. */
interface Template {
    title: string
    description: string
    templateName: string
}

/** All templates for creating projects that have contents. */
const templates: Template[] = [
    {
        title: 'Colorado COVID',
        templateName: 'Colorado_COVID',
        description: 'Learn to glue multiple spreadsheets to analyses all your data at once.',
    },
    {
        title: 'KMeans',
        templateName: 'Kmeans',
        description: 'Learn where to open a coffee shop to maximize your income.',
    },
    {
        title: 'NASDAQ Returns',
        templateName: 'NASDAQ_Returns',
        description: 'Learn how to clean your data to prepare it for advanced analysis.',
    },
    {
        title: 'Restaurants',
        templateName: 'Orders',
        description: 'Learn how to clean your data to prepare it for advanced analysis.',
    },
    {
        title: 'Github Stars',
        templateName: 'Stargazers',
        description: 'Learn how to clean your data to prepare it for advanced analysis.',
    },
]

/** Render all templates, includes empty template */
interface TemplatesRenderProps {
    // Later this data may be requested and therefore needs to be passed dynamically.
    templates: Template[]
    onTemplateClick(name?: string): void
}

const TemplatesRender: React.FC<TemplatesRenderProps> = ({ templates, onTemplateClick }) => {
    /** Unify the border color and the text color. */

    const borderColor = '9E8C91'
    /**
     * Dash border spacing is not supported by native CSS.
     * Therefore, use a background image to create the border.
     * It is essentially an SVG image that was generated by the website.
     * @see {@link https://kovart.github.io/dashed-border-generator}
     */
    const borderBgImg = `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='%23${borderColor}FF' stroke-width='4' stroke-dasharray='15%2c 15' stroke-dashoffset='0' stroke-linecap='butt'/%3e%3c/svg%3e")`

    /** The action button for creating an empty project.
     * So there is no need to pass a value to onChange function.
     */
    const CreateEmptyTemplate = (
        <button
            className="h-40 cursor-pointer"
            onClick={() => {
                onTemplateClick()
            }}
        >
            <div
                style={{ backgroundImage: borderBgImg }}
                className={`flex h-full w-full rounded-2xl text-[#${borderColor}]`}
            >
                <div className="m-auto text-center">
                    <button>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={0.5}
                            stroke="currentColor"
                            className="w-20 h-20"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </button>
                    <p className="font-semibold text-sm">New empty project</p>
                </div>
            </div>
        </button>
    )

    return (
        <>
            {CreateEmptyTemplate}
            {templates.map(template => (
                <button
                    key={template.title}
                    className="h-40 cursor-pointer"
                    onClick={() => {
                        onTemplateClick(template.templateName)
                    }}
                >
                    <div
                        // style={{ backgroundImage }}
                        className="flex flex-col justify-end h-full w-full rounded-2xl overflow-hidden text-white text-left bg-cover bg-gray-500"
                    >
                        <div className="bg-black bg-opacity-30 px-4 pt-2 pb-4">
                            <div className="text-sm font-bold pb-2">{template.title}</div>
                            <div className="text-xs h-[2lh] text-ellipsis">
                                {template.description}
                            </div>
                        </div>
                    </div>
                </button>
            ))}
        </>
    )
}

/** The TemplatesRender's container. */
interface TemplatesProps {
    onTemplateClick(name?: string): void
}

const Templates: React.FC<TemplatesProps> = ({ onTemplateClick }) => {
    return (
        <div className="bg-white">
            <div className="mx-auto py-2 px-4 sm:py-4 sm:px-6 lg:px-8">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    <TemplatesRender templates={templates} onTemplateClick={onTemplateClick} />
                </div>
            </div>
        </div>
    )
}
export default Templates
