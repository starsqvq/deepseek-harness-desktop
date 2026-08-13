const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn } = require('node:child_process')
const { createServer } = require('node:net')
const { createWriteStream, existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

let mainWindow
let backend
let logStream
let shuttingDown = false

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

function bundledPath(...segments) {
  if (app.isPackaged) return join(process.resourcesPath, 'runtime-app', ...segments)
  return join(__dirname, '..', ...segments)
}

function nodeExecutable() {
  return app.isPackaged
    ? join(process.resourcesPath, 'runtime', 'node.exe')
    : join(__dirname, '..', 'runtime', 'node.exe')
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address === 'string' || address === null) {
        server.close()
        reject(new Error('Could not reserve a local port.'))
        return
      }
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

function waitForServer(url, child, timeoutMs = 120000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (child.exitCode !== null) {
        reject(new Error(`Harness backend exited with code ${child.exitCode}.`))
        return
      }
      try {
        const response = await fetch(url)
        if (response.ok) {
          resolve()
          return
        }
      } catch {
        // The server has not bound its port yet.
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('Harness backend did not become ready within 120 seconds.'))
        return
      }
      setTimeout(poll, 250)
    }
    void poll()
  })
}

function stopBackend() {
  if (backend && backend.exitCode === null) backend.kill('SIGTERM')
  backend = undefined
  logStream?.end()
  logStream = undefined
}

async function startBackend() {
  const cli = bundledPath('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const node = nodeExecutable()
  if (!existsSync(cli)) throw new Error(`Bundled Harness CLI is missing: ${cli}`)
  if (!existsSync(node)) throw new Error(`Bundled Node runtime is missing: ${node}`)

  const port = await reservePort()
  const dataDir = join(app.getPath('userData'), 'harness-data')
  const logsDir = join(app.getPath('userData'), 'logs')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })
  logStream = createWriteStream(join(logsDir, 'backend.log'), { flags: 'a' })

  const environment = {
    ...process.env,
    DSH_HOME: dataDir,
  }
  delete environment.ELECTRON_RUN_AS_NODE

  backend = spawn(node, [cli, 'web', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: dataDir,
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend.stdout.pipe(logStream)
  backend.stderr.pipe(logStream)
  backend.on('error', error => logStream?.write(`\nDesktop launcher error: ${error.stack ?? error.message}\n`))
  backend.on('exit', code => {
    if (!shuttingDown && mainWindow && !mainWindow.isDestroyed()) {
      void dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'DeepSeek Harness',
        message: 'Harness 后端已停止',
        detail: `退出代码：${code ?? 'unknown'}\n日志：${join(logsDir, 'backend.log')}`,
      })
    }
  })

  const url = `http://127.0.0.1:${port}/`
  await waitForServer(url, backend)
  return url
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'DeepSeek Harness',
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
    <html lang="zh-CN"><meta charset="utf-8"><title>DeepSeek Harness</title>
    <style>
      html,body{height:100%;margin:0;background:#f7f8fa;color:#17191d;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
      main{height:100%;display:grid;place-content:center;text-align:center;gap:16px}
      .mark{font-size:30px;font-weight:600}.sub{font-size:14px;color:#737780}
      .loader{width:28px;height:28px;margin:auto;border:3px solid #d9dce2;border-top-color:#4b7bec;border-radius:50%;animation:s .8s linear infinite}
      @keyframes s{to{transform:rotate(360deg)}}
    </style><main><div class="mark">DeepSeek Harness</div><div class="loader"></div><div class="sub">正在启动本地智能体服务...</div></main></html>`)} `)
  mainWindow.on('closed', () => { mainWindow = undefined })
  return mainWindow
}

async function boot() {
  const window = createWindow()
  try {
    const url = await startBackend()
    await window.loadURL(url)
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error)
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
      <html lang="zh-CN"><meta charset="utf-8"><title>DeepSeek Harness</title>
      <style>body{margin:40px;background:#fff;color:#202124;font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif}h1{font-size:22px}pre{white-space:pre-wrap;padding:16px;background:#f5f6f8;border:1px solid #ddd}</style>
      <h1>桌面应用启动失败</h1><p>请检查下面的错误信息和用户数据目录中的 <code>logs/backend.log</code>。</p><pre>${detail.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre></html>`)} `)
  }
}

if (gotSingleInstanceLock) {
  app.on('window-all-closed', () => app.quit())
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
  })
  app.on('before-quit', () => {
    shuttingDown = true
    stopBackend()
  })

  app.whenReady().then(boot)
}
