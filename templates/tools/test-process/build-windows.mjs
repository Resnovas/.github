// Synced from Resnovas/.github templates/tools/test-process/build-windows.mjs.
/**
 * @file tools/test-process/build-windows.mjs
 *
 * Copyright 2026 Jonathan Stevens trading as Resnovas. All rights reserved.
 * Licensed under the Fair Core License, Version 1.0, MIT Future License
 * (FCL-1.0-MIT); see LICENSE. You may not move, change, disable or circumvent
 * the licence key functionality, or modify any part of the software that the
 * licence key protects.
 *
 * Contributions are made under the Developer Certificate of Origin (DCO.md) and
 * the Contributing Guidelines (CONTRIBUTING.md), subject to the Code of Conduct
 * (CODE_OF_CONDUCT.md) and the Cooperation Commitment (COOPERATION_COMMITMENT.md).
 *
 * DELETING THIS NOTICE AUTOMATICALLY VOIDS YOUR LICENSE.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Explicit build prerequisite, never a compiler launched inside a test budget.
// Only Microsoft's installed Framework compiler and system assemblies are used.
if (process.platform === 'win32') {
  const compiler = ['Framework64', 'Framework'].map((framework) =>
    join(process.env.SystemRoot ?? 'C:\\Windows', 'Microsoft.NET', framework, 'v4.0.30319', 'csc.exe')).find(existsSync)
  if (!compiler) throw new Error('Windows native process tests require the installed .NET Framework 4 C# compiler.')
  const source = fileURLToPath(new URL('./windows-supervisor.cs', import.meta.url))
  const output = fileURLToPath(new URL('./windows-supervisor.exe', import.meta.url))
  execFileSync(compiler, ['/nologo', '/target:exe', '/optimize+', '/reference:System.Web.Extensions.dll', `/out:${output}`, source], {
    timeout: 30000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
}
