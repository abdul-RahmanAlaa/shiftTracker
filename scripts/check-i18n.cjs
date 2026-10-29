/* Allow-list for runtime-built keys: IPC errors, status/grid prefixes, route labels, and page-section labels. */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sourceRoot = path.join(root, 'src', 'renderer', 'src')
const localePath = path.join(sourceRoot, 'i18n', 'locales', 'ar.json')
const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'))
const dynamicPrefixes = new Set([
  'ipcErrors.',
  'shiftStatus.',
  'tripForm.fields.',
  'tripGrid.rowStatus.',
  'tripGrid.validation.',
  'accountsPage.sections.',
  'settingsPage.sections.',
  'addTrip.title',
  'shifts.title',
  'allTrips.title',
  'accountsPage.title',
  'statementsPage.title',
  'settingsPage.title'
])
const dynamicArguments = new Map([
  ['key', ['ipcErrors.']],
  ['item.label', ['accountsPage.sections.', 'settingsPage.sections.']],
  [
    'label',
    [
      'addTrip.title',
      'shifts.title',
      'allTrips.title',
      'accountsPage.title',
      'statementsPage.title',
      'settingsPage.title'
    ]
  ]
])

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(filePath)
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [filePath] : []
  })
}

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  )
}

function collectReferences(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const staticKeys = new Set()
  const prefixes = new Set()
  const unsupportedDynamicPrefixes = []
  const unsupportedDynamicArguments = []

  const staticCall = /\b(?:i18n\s*\.\s*)?t\s*\(\s*(['"])([^'"\r\n]+)\1/g
  for (const match of source.matchAll(staticCall)) staticKeys.add(match[2])

  const templateCall = /\b(?:i18n\s*\.\s*)?t\s*\(\s*`([^`]+)`/g
  for (const match of source.matchAll(templateCall)) {
    const template = match[1]
    const interpolation = template.indexOf('${')
    if (interpolation === -1) staticKeys.add(template)
    else {
      const prefix = template.slice(0, interpolation)
      if (dynamicPrefixes.has(prefix)) prefixes.add(prefix)
      else unsupportedDynamicPrefixes.push(`${path.relative(root, filePath)}: ${prefix}`)
    }
  }

  const dynamicCall =
    /\b(?:i18n\s*\.\s*)?t\s*\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?=[,)])/g
  for (const match of source.matchAll(dynamicCall)) {
    const allowedPrefixes = dynamicArguments.get(match[1])
    if (!allowedPrefixes) {
      unsupportedDynamicArguments.push(`${path.relative(root, filePath)}: ${match[1]}`)
      continue
    }
    allowedPrefixes.forEach((prefix) => prefixes.add(prefix))
  }

  return { staticKeys, prefixes, unsupportedDynamicPrefixes, unsupportedDynamicArguments }
}

function keyExists(key) {
  return (
    key.split('.').reduce((value, part) => {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
        return undefined
      return value[part]
    }, locale) !== undefined
  )
}

const localeKeys = flattenKeys(locale)
const usedKeys = new Set()
const missingKeys = []
const unsupportedDynamicPrefixes = []
const unsupportedDynamicArguments = []

for (const filePath of listSourceFiles(sourceRoot)) {
  const references = collectReferences(filePath)
  for (const key of references.staticKeys) {
    if (keyExists(key)) usedKeys.add(key)
    else missingKeys.push(`${path.relative(root, filePath)}: ${key}`)
  }
  for (const prefix of references.prefixes) {
    for (const key of localeKeys) {
      if (key.startsWith(prefix)) usedKeys.add(key)
    }
  }
  unsupportedDynamicPrefixes.push(...references.unsupportedDynamicPrefixes)
  unsupportedDynamicArguments.push(...references.unsupportedDynamicArguments)
}

const unusedKeys = localeKeys.filter((key) => !usedKeys.has(key))
const unmatchedPrefixes = [...dynamicPrefixes].filter(
  (prefix) => !localeKeys.some((key) => key.startsWith(prefix))
)
const invalidDynamicArgumentPrefixes = [...dynamicArguments].flatMap(([argument, prefixes]) =>
  prefixes
    .filter((prefix) => !dynamicPrefixes.has(prefix))
    .map((prefix) => `${argument}: ${prefix}`)
)
const failures = [
  ...missingKeys.map((entry) => `Missing translation: ${entry}`),
  ...unusedKeys.map((key) => `Unused translation: ${key}`),
  ...unsupportedDynamicPrefixes.map((entry) => `Unallow-listed dynamic prefix: ${entry}`),
  ...unsupportedDynamicArguments.map((entry) => `Unallow-listed dynamic key: ${entry}`),
  ...invalidDynamicArgumentPrefixes.map(
    (entry) => `Dynamic argument prefix is not allow-listed: ${entry}`
  ),
  ...unmatchedPrefixes.map((prefix) => `Dynamic prefix matches no locale keys: ${prefix}`)
]

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `i18n check passed: ${usedKeys.size} referenced keys, ${localeKeys.length} locale keys`
  )
}
