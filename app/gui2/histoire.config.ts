import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  setupFile: './stories/setup.ts',
  plugins: [HstVue()],
  tree: {
    groups: [
      { id: 'graph', title: 'Graph' },
      { id: 'widgets', title: 'Widgets' },
      { id: 'visualizations', title: 'Visualizations' },
    ],
  },
  vite: {
    resolve: {
      alias: {
        'https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm': require.resolve('d3'),
        'https://cdn.jsdelivr.net/npm/ag-grid-enterprise@30.1.0/+esm':
          require.resolve('ag-grid-enterprise'),
        'https://cdn.jsdelivr.net/npm/sql-formatter@13.0.0/+esm': require.resolve('sql-formatter'),
        'builtins/VisualizationContainer.vue': fileURLToPath(
          new URL('./src/components/VisualizationContainer.vue', import.meta.url),
        ),
        'builtins/useVisualizationConfig.ts': fileURLToPath(
          new URL('./src/providers/useVisualizationConfig.ts', import.meta.url),
        ),
        './icons/show_all.svg': 'src/assets/icons/show_all.svg',
        './icons/find.svg': 'src/assets/icons/find.svg',
        './icons/geo_map_distance.svg': 'src/assets/icons/geo_map_distance.svg',
        './icons/geo_map_pin.svg': 'src/assets/icons/geo_map_pin.svg',
        './icons/path2.svg': 'src/assets/icons/path2.svg',
        './measurement.ts': 'src/components/visualizations/measurement.ts',
        './events.ts': 'src/components/visualizations/events.ts',
        '../public/visualizations/ScatterplotVisualization.vue':
          'public/visualizations/ScatterplotVisualization.vue',
        '../public/visualizations/GeoMapVisualization.vue':
          'public/visualizations/GeoMapVisualization.vue',
      },
    },
    define: {
      HISTOIRE: 'true',
    },
    server: {
      fs: {
        allow: ['../..'],
      },
    },
  },
})
