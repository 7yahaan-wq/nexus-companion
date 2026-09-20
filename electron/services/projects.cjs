const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
async function directory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw Error('请选择绝对项目路径');
  const p = await fs.realpath(value);
  if (!(await fs.stat(p)).isDirectory()) throw Error('项目路径不是文件夹');
  return p;
}
async function inspect(value) {
  const cwd = await directory(value);
  const names = await fs.readdir(cwd);
  let engine = names.includes('project.godot')
    ? 'Godot'
    : names.includes('Assets') && names.includes('ProjectSettings')
      ? 'Unity'
      : 'Other';
  const documents = names
    .filter((n) => /^(readme|agents|architecture|design)/i.test(n) && /\.(md|txt|pdf)$/i.test(n))
    .slice(0, 20);
  let git = { available: false, branch: '', files: [], lastCommit: '', error: '' };
  try {
    const options = { cwd, windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 };
    const [branch, status, commit] = await Promise.all([
      exec('git', ['branch', '--show-current'], options),
      exec('git', ['status', '--porcelain=v1', '-uall'], options),
      exec('git', ['log', '-1', '--format=%h %s'], options).catch(() => ({
        stdout: 'No commits yet',
      })),
    ]);
    git = {
      available: true,
      branch: branch.stdout.trim() || 'Detached HEAD',
      files: status.stdout.split(/\r?\n/).filter(Boolean).slice(0, 500),
      lastCommit: commit.stdout.trim(),
      error: '',
    };
  } catch (e) {
    git.error = 'Git 不可用或此目录不是 Git 仓库';
  }
  return { engine, documents, git };
}
async function openProject(shell, value, action) {
  const cwd = await directory(value);
  if (action === 'folder') {
    const e = await shell.openPath(cwd);
    if (e) throw Error(e);
    return true;
  }
  if (action === 'terminal') {
    return new Promise((resolve, reject) => {
      const child = spawn('wt.exe', ['-d', cwd], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      });
      child.once('error', () =>
        reject(Error('未找到 Windows Terminal，请先安装 Windows Terminal')),
      );
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    });
  }
  if (action === 'vscode') {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Microsoft VS Code/Code.exe'),
      path.join(process.env.ProgramFiles || '', 'Microsoft VS Code/Code.exe'),
    ];
    const executable = await firstExisting(candidates);
    if (!executable) throw Error('未找到 VS Code，请先安装 VS Code');
    return launch(executable, [cwd]);
  }
  if (action === 'launch') {
    const info = await inspect(cwd);
    if (info.engine === 'Godot') {
      try {
        return await launch('godot.exe', ['--editor', '--path', cwd]);
      } catch {
        throw Error('未找到 Godot，请将 Godot 可执行文件加入 PATH');
      }
    }
    if (info.engine === 'Unity') {
      const e = await shell.openExternal('unityhub://' + encodeURIComponent(cwd));
      return true;
    }
    throw Error('此项目类型不支持自动启动，请打开项目目录');
  }
  throw Error('Unsupported action');
}
async function firstExisting(values) {
  for (const p of values)
    try {
      await fs.access(p);
      return p;
    } catch {}
  return null;
}
function launch(file, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(file, args, { windowsHide: true, detached: true, stdio: 'ignore' });
    c.once('error', reject);
    c.once('spawn', () => {
      c.unref();
      resolve(true);
    });
  });
}
module.exports = { directory, inspect, openProject };
