import * as fs from 'node:fs/promises'

console.info('Reading icons from "./src/assets/icons.svg"...')
const icons = await fs.readFile('./src/assets/icons.svg', { encoding: 'utf-8' })
const iconNames = icons.match(/(?<=^ {4}<g id=")[^"]+/gm) ?? []

// All generated files MUST follow Prettier formatting.
console.info('Writing icon names to "./src/util/iconList.json"...')
await fs.writeFile('./src/util/iconList.json', JSON.stringify(iconNames, undefined, 2) + '\n')
console.info('Writing icon name type to "./src/util/iconName.ts"...')
await fs.writeFile(
  './src/util/iconName.ts',
  `\
// Generated by \`scripts/generateIcons.js\`.
// Please run \`npm run generate\` to regenerate this file whenever \`icons.svg\` is changed.
export type Icon =
${iconNames?.map((name) => `  | '${name}'`).join('\n')}
`,
)
console.info('Done.')
