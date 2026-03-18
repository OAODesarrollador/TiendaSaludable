const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:3000';

function runProcess(name, cwd, command, args) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] finalizado por senal ${signal}`);
      return;
    }

    if (code !== 0) {
      console.error(`[${name}] finalizo con codigo ${code}`);
      process.exitCode = code || 1;
    }
  });

  child.on('error', (error) => {
    console.error(`[${name}] no pudo iniciar:`, error);
    process.exitCode = 1;
  });

  return child;
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      const browser = spawn(process.env.ComSpec || 'cmd.exe', ['/c', 'start', '', url], {
        cwd: rootDir,
        detached: true,
        stdio: 'ignore',
      });
      browser.unref();
      return;
    }

    if (process.platform === 'darwin') {
      const browser = spawn('open', [url], {
        cwd: rootDir,
        detached: true,
        stdio: 'ignore',
      });
      browser.unref();
      return;
    }

    const browser = spawn('xdg-open', [url], {
      cwd: rootDir,
      detached: true,
      stdio: 'ignore',
    });
    browser.unref();
  } catch (error) {
    console.warn(`No se pudo abrir el navegador automaticamente. Abri ${url} manualmente.`, error.message);
  }
}

const processes = [
  runProcess(
    'backend',
    path.join(rootDir, 'backend'),
    process.execPath,
    [path.join(rootDir, 'backend', 'node_modules', 'nodemon', 'bin', 'nodemon.js'), 'server.js']
  ),
  runProcess(
    'frontend',
    path.join(rootDir, 'frontend'),
    process.execPath,
    [path.join(rootDir, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js')]
  ),
];

setTimeout(() => {
  openBrowser(appUrl);
}, 3000);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
