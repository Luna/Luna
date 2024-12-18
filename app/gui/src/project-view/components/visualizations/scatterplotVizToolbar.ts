import type { NodeCreationOptions } from '@/components/GraphEditor/nodeCreation'
import type { ToolbarItem } from '@/components/visualizations/toolbar'
import { Ast } from '@/util/ast'
import { Pattern } from '@/util/ast/match'
import { ToValue } from '@/util/reactivity'
import { computed, type ComputedRef, type Ref, toValue } from 'vue'
import { Expression, MutableExpression } from 'ydoc-shared/ast'

interface EnableSelectionOptions {
  selectionEnabled: ToValue<boolean>
}

interface ZoomOptions {
  zoomToSelected: any
  brushExtent: any
}

interface NewNodeOptions {
  createNewFilterNodeEnabled: any
  createNewFilterNode: any
}

interface TextSelectionOptions {
  yAxisSelected: any
  makeSeriesLabelOptions: any
}

export interface Options extends EnableSelectionOptions, ZoomOptions, NewNodeOptions, TextSelectionOptions {is_multi_series: boolean}

const createEnableSelectionButton = ({selectionEnabled} : EnableSelectionOptions) => ({
  icon: 'select',
  title: 'Enable Selection',
  toggle: selectionEnabled,
})

const zoomToSelected = (bool: boolean) => {

}

const createFitAllButton = () => ({
  icon: 'show_all',
  title: 'Fit All',
  onClick: () => zoomToSelected(false),
})

const createZoomButton = ({zoomToSelected, brushExtent} : ZoomOptions) => ({
  icon: 'zoom',
  title: 'Zoom to Selected',
  disabled: () => brushExtent.value == null,
  onClick: zoomToSelected,
})

const createNewNodes = ({createNewFilterNodeEnabled, createNewFilterNode} : NewNodeOptions) => ({
  icon: 'add_to_graph_editor',
  title: 'Create component of selected points',
  disabled: () => !createNewFilterNodeEnabled.value,
  onClick: createNewFilterNode,
})

const createTextSelectionButton = ({yAxisSelected, makeSeriesLabelOptions} : TextSelectionOptions) => (
  {
    type: 'textSelectionMenu',
    selectedTextOption: yAxisSelected,
    title: 'Choose Y Axis Label',
    heading: 'Y Axis Label: ',
    options: {
      none: {
        label: 'No Label',
      },
      ...makeSeriesLabelOptions(),
    },
  }
)

/** TODO: Add docs */
export function useTableVizToolbar(options: Options): ComputedRef<ToolbarItem[]> {
  const enableSelectionButton = createEnableSelectionButton(options)
  const fitAllButton = createFitAllButton(options)
  const zoomButton = createZoomButton(options)
  const newNodeButton = createNewNodes(options)
  const textSelectionButton = createTextSelectionButton(options)
  return computed(() => [enableSelectionButton, fitAllButton, zoomButton, newNodeButton, ...(options.is_multi_series ? [textSelectionButton] : [])])
}
