/** @file Modal dialog to upload a file. */
import * as react from 'react'
import * as toast from 'react-hot-toast'

import * as backendModule from '../service'
import * as fileInfo from '../../fileInfo'

export interface UploadFileModalProps {
    backend: backendModule.Backend
    directoryId: backendModule.DirectoryId
    onSuccess: () => void
    close: () => void
}

function UploadFileModal(props: UploadFileModalProps) {
    const { backend, directoryId, onSuccess, close } = props

    const [name, setName] = react.useState<string | null>(null)
    const [file, setFile] = react.useState<File | null>(null)

    async function onSubmit() {
        if (file == null) {
            toast.toast.error('Please select a file to upload.')
        } else if (!name) {
            toast.toast.error('Please provide a file name.')
        } else {
            await backend.uploadFile(
                {
                    parentDirectoryId: directoryId,
                    fileName: name,
                },
                file
            )
            toast.toast.success('Sucessfully uploaded file.')
            onSuccess()
            close()
        }
    }

    return (
        <form className="bg-white rounded-lg w-96 h-72 p-2">
            <div className="m-2">
                <label className="w-1/3" htmlFor="uploaded_file_name">
                    File name
                </label>
                <input
                    id="uploaded_file_name"
                    type="text"
                    required
                    className="border-primary bg-gray-200 rounded-full w-2/3 px-2 mx-2"
                    onChange={event => {
                        setName(event.target.value)
                    }}
                    defaultValue={name ?? ''}
                />
            </div>
            <div className="m-2">
                <div className="inline-block text-white bg-blue-600 rounded-full px-4 py-1">
                    <label htmlFor="uploaded_file">Select file</label>
                </div>
            </div>
            <div className="border border-primary rounded-md m-2">
                <input
                    id="uploaded_file"
                    type="file"
                    className="hidden"
                    onChange={event => {
                        setName(name ?? event.target.files?.[0]?.name ?? '')
                        setFile(event.target.files?.[0] ?? null)
                    }}
                />
                <div className="inline-flex flex-row flex-nowrap w-full p-2">
                    <div className="grow">
                        <div>{file?.name ?? 'No file selected'}</div>
                        <div className="text-xs">
                            {file ? fileInfo.toReadableSize(file.size) : '\u00a0'}
                        </div>
                    </div>
                    <div>{file ? fileInfo.fileIcon(fileInfo.fileExtension(file.name)) : <></>}</div>
                </div>
            </div>
            <div className="m-1">
                <div
                    className="inline-block text-white bg-blue-600 rounded-full px-4 py-1 m-1"
                    onClick={onSubmit}
                >
                    Upload
                </div>
                <div
                    className="inline-block bg-gray-200 rounded-full px-4 py-1 m-1"
                    onClick={close}
                >
                    Cancel
                </div>
            </div>
        </form>
    )
}

export default UploadFileModal
