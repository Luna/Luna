// ==================
// === HTML Utils ===
// ==================

/** Creates a new top-level div which occupy full size of its parent's space. */
export function newTopLevelDiv(): HTMLDivElement {
    const node = document.createElement('div')
    node.style.width = '100%'
    node.style.height = '100%'
    document.body.appendChild(node)
    return node
}
