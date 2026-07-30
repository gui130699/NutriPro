import { rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

// Vite normally empties `dist`, but an interrupted build in a synced Windows
// folder can leave old hashed assets behind. Removing only this verified build
// directory keeps the Workbox precache aligned with the current release.
const workspace = resolve(process.cwd())
const output = resolve(workspace, 'dist')
const relativeOutput = relative(workspace, output)

if (!relativeOutput || relativeOutput.startsWith(`..${sep}`) || isAbsolute(relativeOutput)) {
  throw new Error(`Refusing to clean a directory outside this workspace: ${output}`)
}

await rm(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 })
