/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const reportPath = path.join(root, 'last-task.md')
const harnessOutputPath = path.join(__dirname, 'last-harness-output.txt')
const useE2E = process.argv.includes('--e2e')
const findings = []
const failures = []

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options
  })
  return {
    code: result.status === null ? 1 : result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error
  }
}

function git(args) {
  return run('git', args)
}

function readHeadFile(filePath) {
  const result = git(['show', `HEAD:${filePath}`])
  return result.code === 0 ? result.stdout : null
}

function summaryLine(output, fallback) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const meaningfulLines = lines.filter(
    (line) => !line.startsWith('npm notice run ') && !line.startsWith('>')
  )
  return meaningfulLines.length > 0 ? meaningfulLines[meaningfulLines.length - 1] : fallback
}

function playwrightSummaryLine(output) {
  const lines = output
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
  const resultLines = lines.filter((line) => /^\d+ (?:passed|failed)(?: \([^)]*\))?$/.test(line))
  return (
    resultLines.find((line) => line.includes('failed')) ??
    resultLines.find((line) => line.includes('passed')) ??
    null
  )
}

function parseStatus(statusText) {
  return statusText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2)
      const filePath = line.slice(3).replace(/^"(.*)"$/, '$1')
      return { status, filePath }
    })
}

function groupFor(filePath) {
  if (filePath.startsWith('src/main/')) return 'main'
  if (filePath.startsWith('src/preload/')) return 'preload'
  if (filePath.startsWith('src/renderer/')) return 'renderer'
  if (filePath.startsWith('scripts/') || filePath.startsWith('e2e/')) return 'tests/scripts'
  if (
    filePath === 'package.json' ||
    filePath === 'package-lock.json' ||
    filePath === '.gitignore' ||
    filePath.startsWith('.github/') ||
    /(^|\/)(tsconfig[^/]*|playwright\.config\.[^/]+|eslint[^/]*|vite\.config\.[^/]+)$/.test(
      filePath
    )
  ) {
    return 'config'
  }
  if (filePath.endsWith('.md')) return 'docs'
  return 'config'
}

function getChangedPaths(statusRows) {
  const paths = new Set()
  for (const row of statusRows) {
    const renameParts = row.filePath.split(' -> ')
    paths.add(renameParts[renameParts.length - 1])
  }
  const diff = git(['diff', '--name-only', 'HEAD'])
  if (diff.code === 0) {
    for (const filePath of diff.stdout.split(/\r?\n/).filter(Boolean)) paths.add(filePath)
  }
  return paths
}

function getAddedDiffLines() {
  const tracked = git(['diff', '--unified=0', '--no-color', 'HEAD', '--'])
  const entries = []
  let activePath = ''
  for (const line of tracked.stdout.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      activePath = line.slice(6)
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      entries.push({ filePath: activePath, line: line.slice(1) })
    }
  }

  const status = git(['status', '--short', '--untracked-files=all'])
  for (const row of parseStatus(status.stdout)) {
    if (!row.status.includes('?')) continue
    const absolutePath = path.join(root, row.filePath)
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue
    const contents = fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '')
    for (const line of contents.split(/\r?\n/)) {
      entries.push({ filePath: row.filePath, line })
    }
  }
  return entries
}

function recordFail(message) {
  failures.push(message)
}

function recordWarn(message) {
  findings.push(message)
}

function executeCheck(label, command, args, options = {}) {
  const result = run(command, args, options)
  if (result.error) {
    recordFail(`${label} could not start: ${result.error.message}`)
  } else if (result.code !== 0) {
    recordFail(`${label} exited ${result.code}`)
  }
  return {
    label,
    code: result.code,
    summary: summaryLine(
      `${result.stdout}\n${result.stderr}`,
      result.error ? result.error.message : result.code === 0 ? 'completed successfully' : 'failed'
    ),
    output: `${result.stdout}${result.stderr}`
  }
}

function executeNpmCheck(label, script, options = {}) {
  const npmCliPath = process.env.npm_execpath
  if (!npmCliPath) {
    const message = 'npm_execpath is unavailable'
    recordFail(`${label} could not start: ${message}`)
    return { label, code: 1, summary: message, output: '' }
  }
  return executeCheck(label, process.execPath, [npmCliPath, 'run', script], options)
}

function extractHarnessDetails(output) {
  const lines = output.split(/\r?\n/)
  const tableRows = lines.filter((line) => /^\|.*\|\s*(PASS|FAIL)\s*\|/.test(line))
  fs.writeFileSync(harnessOutputPath, `${tableRows.join('\n')}${tableRows.length ? '\n' : ''}`, {
    encoding: 'utf8'
  })
  const summary = lines.find((line) => line.startsWith('SUMMARY ')) ?? 'SUMMARY missing'
  const failedMatch = summary.match(/failed cases:\s*(\[[^\]]*\])/)
  let failedCases = []
  if (failedMatch) {
    try {
      failedCases = JSON.parse(failedMatch[1])
    } catch {
      failedCases = ['could not parse failed case names']
    }
  }
  return {
    summary: summary.trim(),
    count: tableRows.length,
    failedCases
  }
}

function checkMechanicalRules(addedLines, changedPaths) {
  const anyPattern = new RegExp(':' + '\\s*' + 'any\\b')
  const asAnyPattern = new RegExp('as' + '\\s+' + 'any\\b')
  const onlyPattern = new RegExp('\\.' + 'only\\(')
  const debugPattern = new RegExp('debug' + 'ger\\b')
  const todoToken = String.fromCharCode(84, 79, 68, 79)
  const fixmeToken = String.fromCharCode(70, 73, 88, 77, 69)
  const unfinishedPattern = new RegExp(`\\b(?:${todoToken}|${fixmeToken})\\b`)
  const arabicPattern = /[\u0600-\u06ff]/

  for (const entry of addedLines) {
    const text = entry.line
    const sourcePath = entry.filePath
    if (anyPattern.test(text)) recordFail(`added prohibited any annotation in ${sourcePath}`)
    if (asAnyPattern.test(text)) recordFail(`added prohibited any cast in ${sourcePath}`)
    if (onlyPattern.test(text)) recordFail(`added focused-test call in ${sourcePath}`)
    if (debugPattern.test(text)) recordFail(`added debug statement in ${sourcePath}`)
    if (unfinishedPattern.test(text)) recordFail(`added unfinished-work marker in ${sourcePath}`)
    if (
      sourcePath.startsWith('src/main/') &&
      new RegExp('console' + '\\.' + 'log\\s*\\(').test(text)
    ) {
      recordFail(`added console.log in ${sourcePath}`)
    }
    if (
      sourcePath.startsWith('src/renderer/') &&
      !sourcePath.includes('/i18n/locales/') &&
      /\.(?:ts|tsx)$/.test(sourcePath) &&
      arabicPattern.test(text)
    ) {
      recordFail(`added hardcoded Arabic text in ${sourcePath}`)
    }
  }

  if (changedPaths.has('package.json') || changedPaths.has('package-lock.json')) {
    recordWarn('package.json or package-lock.json changed')
  }
  if (changedPaths.has('src/main/db.ts')) {
    recordWarn('src/main/db.ts changed')
  }

  const dbHead = readHeadFile('src/main/db.ts')
  const dbCurrentPath = path.join(root, 'src', 'main', 'db.ts')
  if (dbHead !== null && fs.existsSync(dbCurrentPath)) {
    const dbCurrent = fs.readFileSync(dbCurrentPath, 'utf8')
    const versionPattern = /const CURRENT_VERSION\s*=\s*\d+/
    const headVersion = dbHead.match(versionPattern)?.[0]
    const currentVersion = dbCurrent.match(versionPattern)?.[0]
    if (headVersion !== currentVersion) recordWarn('CURRENT_VERSION/schema version value changed')
  }

  const preloadImplementationChanged = [...changedPaths].some(
    (filePath) => filePath.startsWith('src/preload/') && filePath !== 'src/preload/index.d.ts'
  )
  const declarationChanged = changedPaths.has('src/preload/index.d.ts')
  if (preloadImplementationChanged && !declarationChanged) {
    recordWarn('src/preload changed without src/preload/index.d.ts')
  }
  if (declarationChanged && !preloadImplementationChanged) {
    recordWarn('src/preload/index.d.ts changed without the rest of src/preload')
  }
  if (
    [...changedPaths].some((filePath) => filePath.startsWith('src/')) &&
    !changedPaths.has('PROJECT.md')
  ) {
    recordWarn('src/ changed but PROJECT.md did not')
  }

  const projectPath = path.join(root, 'PROJECT.md')
  if (fs.existsSync(projectPath)) {
    const projectText = fs.readFileSync(projectPath, 'utf8')
    const forbiddenPhrases = [
      'previously',
      'formerly',
      'was changed',
      'fixed in',
      'Part A',
      'Part B',
      'batch',
      'now uses',
      'removed',
      'no longer'
    ]
    for (const phrase of forbiddenPhrases) {
      if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(projectText)) {
        recordWarn(`PROJECT.md contains forbidden history wording: ${phrase}`)
      }
    }
  }

  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  if (untracked.code === 0) {
    for (const filePath of untracked.stdout.split(/\r?\n/).filter(Boolean)) {
      if (
        filePath.startsWith('src/') ||
        filePath.startsWith('scripts/') ||
        filePath.startsWith('e2e/')
      ) {
        recordWarn(`${filePath}: untracked, must be git added`)
      }
    }
  }

  const headHarness = readHeadFile('scripts/verify-closed-shift-use-cases.cjs')
  const harnessPath = path.join(root, 'scripts', 'verify-closed-shift-use-cases.cjs')
  if (headHarness !== null && fs.existsSync(harnessPath)) {
    const countCalls = (text) => (text.match(/runCase\s*\(/g) ?? []).length
    if (countCalls(fs.readFileSync(harnessPath, 'utf8')) < countCalls(headHarness)) {
      recordWarn('runCase( occurrences in the use-case harness decreased compared with HEAD')
    }
  }
}

function createDiffSection() {
  const tracked = git([
    'diff',
    '--no-color',
    'HEAD',
    '--',
    '.',
    ':(exclude)*.md',
    ':(exclude)package-lock.json',
    ':(exclude)test-results/**',
    ':(exclude)last-task.md'
  ])
  let diffText = tracked.stdout
  const status = git(['status', '--short', '--untracked-files=all'])
  const untrackedPaths = parseStatus(status.stdout)
    .filter((row) => row.status.includes('?'))
    .map((row) => row.filePath)
    .filter(
      (filePath) =>
        !filePath.endsWith('.md') &&
        filePath !== 'package-lock.json' &&
        !filePath.startsWith('test-results/') &&
        filePath !== 'last-task.md' &&
        (filePath.startsWith('src/') ||
          filePath.startsWith('scripts/') ||
          filePath.startsWith('e2e/'))
    )

  for (const filePath of untrackedPaths) {
    const untrackedDiff = run('git', ['diff', '--no-index', '--', 'NUL', filePath])
    if (untrackedDiff.stdout)
      diffText += `${diffText.endsWith('\n') ? '' : '\n'}${untrackedDiff.stdout}`
    else {
      const absolutePath = path.join(root, filePath)
      if (fs.existsSync(absolutePath)) {
        const content = fs.readFileSync(absolutePath, 'utf8')
        const lines = content.split(/\r?\n/)
        diffText += `\nUntracked file: ${filePath}\n${lines.map((line) => `+${line}`).join('\n')}\n`
      }
    }
  }

  const diffLineCount = diffText.split(/\r?\n/).length
  if (diffLineCount > 2500) {
    const names = new Map()
    for (const match of diffText.matchAll(/^\+\+\+ b\/(.+)$/gm)) names.set(match[1], 0)
    for (const filePath of untrackedPaths) {
      const absolutePath = path.join(root, filePath)
      if (fs.existsSync(absolutePath)) {
        names.set(filePath, fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length)
      }
    }
    return [
      ...[...names].map(([filePath, lines]) => `${filePath}: ${lines} lines`),
      'diff too large, request files by name'
    ].join('\n')
  }
  return diffText.trimEnd() || '(no code diff)'
}

function main() {
  fs.writeFileSync(harnessOutputPath, '', { encoding: 'utf8' })

  const statusResult = git(['status', '--short', '--untracked-files=all'])
  const statusText = statusResult.stdout.trimEnd() || '(clean)'
  const statusRows = parseStatus(statusResult.stdout)
  const changedPaths = getChangedPaths(statusRows)
  const addedLines = getAddedDiffLines()

  const diffStatResult = git(['diff', '--stat', 'HEAD'])
  const diffStat = diffStatResult.stdout.trimEnd() || '(no tracked diff)'

  const checks = []
  checks.push(executeCheck('git diff --check', 'git', ['diff', '--check', 'HEAD']))
  checks.push(executeNpmCheck('npm run typecheck', 'typecheck'))
  checks.push(executeNpmCheck('npm run lint', 'lint'))
  checks.push(executeNpmCheck('npm run check:i18n', 'check:i18n'))

  const harnessCheck = executeNpmCheck('npm run verify:use-cases', 'verify:use-cases', {
    env: {
      ...process.env,
      SHIFT_TRACKER_RESULT_FILE: harnessOutputPath
    }
  })
  const harnessDetails = extractHarnessDetails(harnessCheck.output)
  if (harnessDetails.summary === 'SUMMARY missing' || harnessDetails.count === 0) {
    recordFail('use-case harness did not produce a summary and case table')
  }
  harnessCheck.summary = `${harnessDetails.summary}; cases: ${harnessDetails.count}; failed: ${
    harnessDetails.failedCases.length ? harnessDetails.failedCases.join(', ') : 'none'
  }`
  checks.push(harnessCheck)

  if (useE2E) {
    const e2eCheck = executeNpmCheck('npm run test:e2e', 'test:e2e')
    const playwrightSummary = playwrightSummaryLine(e2eCheck.output)
    if (playwrightSummary === null) {
      recordFail('Playwright result line was not found in E2E output')
      e2eCheck.summary = 'Playwright result line missing'
    } else {
      e2eCheck.summary = playwrightSummary
    }
    checks.push(e2eCheck)
  }

  checkMechanicalRules(addedLines, changedPaths)

  const groups = ['main', 'preload', 'renderer', 'tests/scripts', 'config', 'docs']
  const groupedFiles = groups.map((group) => {
    const files = [...changedPaths].filter((filePath) => groupFor(filePath) === group).sort()
    return `${group}: ${files.length ? files.join(', ') : '(none)'}`
  })

  const taskNotesPath = path.join(root, 'task-notes.md')
  const taskNotes = fs.existsSync(taskNotesPath)
    ? fs
        .readFileSync(taskNotesPath, 'utf8')
        .replace(/^\uFEFF/, '')
        .trimEnd()
    : '(task-notes.md is absent)'
  const diffSection = createDiffSection()
  const gateStatus = failures.length > 0 ? 'FAIL' : findings.length > 0 ? 'WARN' : 'PASS'
  const reportLines = [
    `GATE RESULT: ${gateStatus}`,
    ...(failures.length ? failures.map((finding) => `FAIL: ${finding}`) : []),
    ...findings.map((finding) => `WARN: ${finding}`),
    '',
    '## Changed files by area',
    ...groupedFiles,
    '',
    '## git status --short --untracked-files=all',
    statusText,
    '',
    '## git diff --stat HEAD',
    diffStat,
    '',
    '## Checks',
    ...checks.map((check) => `${check.label}: exit ${check.code} — ${check.summary}`),
    '',
    '## Mechanical rules',
    'Added diff lines checked for prohibited types/calls/debugging markers, main console logging, renderer Arabic text outside locale files, and unfinished-work markers.',
    'Warnings checked for manifest changes, schema/version changes, preload declaration pairing, PROJECT.md synchronization, history wording, untracked code files, and harness case-count reduction.',
    '',
    '## Notes',
    taskNotes,
    '',
    '## Code diff',
    diffSection
  ]
  fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`, { encoding: 'utf8' })
  process.exitCode = failures.length > 0 ? 1 : 0
}

main()
