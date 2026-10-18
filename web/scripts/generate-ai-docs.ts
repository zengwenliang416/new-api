/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { buildAiDocs } from '../src/features/docs/lib/build-ai-docs'

const documents = buildAiDocs()
const check = process.argv.includes('--check')
for (const [name, content] of [
  ['llms.txt', documents.index],
  ['llms-full.txt', documents.full],
] as const) {
  const path = fileURLToPath(new URL(`../public/${name}`, import.meta.url))
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => null)
    if (current !== content) {
      process.stderr.write(
        `${name} is missing or stale; run bun scripts/generate-ai-docs.ts\n`
      )
      process.exitCode = 1
    }
  } else {
    await writeFile(path, content)
    process.stdout.write(`Generated ${name}\n`)
  }
}
