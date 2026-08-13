const { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } = require('node:fs')
const { dirname, join, parse, relative, resolve, sep } = require('node:path')

const projectRoot = resolve(__dirname, '..')
const sourceModules = join(projectRoot, 'node_modules')
const runtimeRoot = join(projectRoot, 'runtime-app')
const runtimeModules = join(runtimeRoot, 'node_modules')
const visited = new Map()

function copyFileWithRetry(source, destination) {
  for (let attempt = 0; attempt < 5; ++attempt) {
    try {
      copyFileSync(source, destination)
      return
    } catch (error) {
      if (attempt === 4) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

function copyPackageTree(source, destination) {
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const from = join(source, entry.name)
    const to = join(destination, entry.name)
    if (entry.isDirectory()) copyPackageTree(from, to)
    else if (entry.isSymbolicLink()) {
      const resolved = realpathSync(from)
      if (lstatSync(resolved).isDirectory()) copyPackageTree(resolved, to)
      else copyFileWithRetry(resolved, to)
    } else copyFileWithRetry(from, to)
  }
}

function packagePath(name, fromDirectory) {
  let cursor = fromDirectory
  const root = parse(cursor).root
  while (true) {
    const candidate = join(cursor, 'node_modules', ...name.split('/'))
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (cursor === root) break
    cursor = dirname(cursor)
  }
  const rootCandidate = join(sourceModules, ...name.split('/'))
  if (existsSync(join(rootCandidate, 'package.json'))) return rootCandidate
  return undefined
}

function destinationPath(name) {
  return join(runtimeModules, ...name.split('/'))
}

function includePackage(name, fromDirectory) {
  const source = packagePath(name, fromDirectory)
  if (!source) throw new Error(`Required runtime package is missing: ${name} (from ${fromDirectory})`)
  const realKey = resolve(source).toLowerCase()
  if (visited.has(realKey)) return
  visited.set(realKey, name)

  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  const destination = destinationPath(name)
  mkdirSync(dirname(destination), { recursive: true })
  copyPackageTree(source, destination)

  const requiredNames = new Set(Object.keys(manifest.dependencies ?? {}))
  const dependencyNames = new Set([
    ...requiredNames,
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ])
  for (const dependency of [...dependencyNames].sort()) {
    const found = packagePath(dependency, source)
    if (found) includePackage(dependency, source)
    else if (requiredNames.has(dependency)) {
      throw new Error(`Required runtime package is missing: ${dependency} (from ${name})`)
    }
  }
}

rmSync(runtimeRoot, { recursive: true, force: true })
mkdirSync(runtimeModules, { recursive: true })
includePackage('@deepseek-ai/dsh', projectRoot)

const manifest = {
  name: 'deepseek-harness-runtime',
  private: true,
  version: '0.1.0',
  type: 'module',
}
require('node:fs').writeFileSync(join(runtimeRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Prepared ${visited.size} runtime packages in ${relative(projectRoot, runtimeRoot)}.`)
