/** @file */
/* eslint-disable @typescript-eslint/naming-convention */
import React, { PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

interface ModalImpProps {
    onCancel?: () => void
}
const ModalImp: React.FC<PropsWithChildren<ModalImpProps>> = props => {
    const { children, onCancel } = props
    /** Ensure that the container is only created once for each component. */
    const containerRef = React.useRef(document.createElement('div'))
    const container = containerRef.current
    /** The div with this id is included in the `index.html`, so it can be asserted as non-empty. */
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const modalRoot = document.getElementById('modal-root')!

    React.useEffect(() => {
        document.body.classList.add('overflow-y-hidden', 'h-screen')
        modalRoot.appendChild(container)
        return () => {
            document.body.classList.remove('overflow-y-hidden', 'h-screen')
            modalRoot.removeChild(container)
        }
    }, [])

    const handleClickOver: React.MouseEventHandler<HTMLDivElement> = ev => {
        if (ev.currentTarget !== ev.target) return
        onCancel?.()
    }

    return createPortal(
        <div
            className="fixed top-0 bottom-0 right-0 left-0 flex justify-center items-center overflow-hidden bg-black bg-opacity-30"
            onMouseDown={handleClickOver}
        >
            {children}
        </div>,
        containerRef.current
    )
}
interface ModalProps {
    visible: boolean
    onCancel?: () => void
}
const Modal: React.FC<PropsWithChildren<ModalProps>> = props => {
    const { children, visible, onCancel } = props

    return visible ? <ModalImp onCancel={onCancel}>{children}</ModalImp> : null
}

export default Modal
