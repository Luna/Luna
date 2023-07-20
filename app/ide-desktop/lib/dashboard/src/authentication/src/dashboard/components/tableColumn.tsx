/** @file Types for columns in a `Table`. */

// =============
// === Types ===
// =============

/** Props for a {@link Column}. */
export interface TableColumnProps<T, State = never, RowState = never, Key extends string = string> {
    keyProp: Key
    item: T
    setItem: React.Dispatch<React.SetStateAction<T>>
    selected: boolean
    state: State
    rowState: RowState
    setRowState: React.Dispatch<React.SetStateAction<RowState>>
}

/** Metadata describing how to render a column of the table. */
export interface TableColumn<T, State = never, RowState = never, Key extends string = string> {
    id: string
    className?: string
    heading: JSX.Element
    render: (props: TableColumnProps<T, State, RowState, Key>) => JSX.Element
}
