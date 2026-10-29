/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { build } = require('esbuild')

const root = path.resolve(__dirname, '..')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-tracker-use-cases-'))
const resultOutputPath = process.env.SHIFT_TRACKER_RESULT_FILE

for (const method of ['log', 'error']) {
  const writeConsole = console[method].bind(console)
  console[method] = (...values) => {
    writeConsole(...values)
    if (resultOutputPath) {
      fs.appendFileSync(resultOutputPath, values.map(String).join(' ') + '\n')
    }
  }
}

if (!process.versions.electron) {
  console.error('FAIL runtime | actual: not running in Electron Node | expected: Electron as Node')
  fs.rmSync(tempDir, { recursive: true, force: true })
  process.exit(2)
}

const entry = fs.readFileSync(path.join(__dirname, 'verify', 'entry.ts'), 'utf8')

async function main() {
  process.env.SHIFT_TRACKER_USER_DATA = tempDir
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        dialog: {
          showErrorBox: (...values) => {
            globalThis.__migrationDialog = values
          }
        },
        app: {
          getPath: () => process.env.SHIFT_TRACKER_USER_DATA,
          quit: () => {
            globalThis.__migrationQuitCount += 1
          }
        }
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const buildResult = await build({
      stdin: {
        contents: entry,
        resolveDir: path.join(root, 'scripts', 'verify'),
        sourcefile: 'verify/entry.ts',
        loader: 'ts'
      },
      absWorkingDir: root,
      outfile: path.join(root, 'scripts', '.verify-closed-shift-use-cases.bundle.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron', 'better-sqlite3'],
      write: false,
      logLevel: 'silent'
    })
    const filename = path.join(root, 'scripts', '.verify-closed-shift-use-cases.bundle.cjs')
    globalThis.window = {
      api: new Proxy({}, { get: () => () => Promise.resolve({ ok: true, data: undefined }) })
    }
    const bundleModule = new Module(filename, module)
    bundleModule.filename = filename
    bundleModule.paths = Module._nodeModulePaths(root)
    bundleModule._compile(buildResult.outputFiles[0].text, filename)
    await globalThis.__useCaseRun
  } catch (error) {
    console.error(
      `FAIL harness | actual: ${error instanceof Error ? error.stack : String(error)} | expected: bundle and execute real use cases`
    )
    process.exitCode = 1
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

main().then(() => {
  process.stdout.write('', () => process.exit(process.exitCode || 0))
})