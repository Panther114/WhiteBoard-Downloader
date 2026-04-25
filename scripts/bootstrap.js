#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const DEBUG = process.env.DEBUG_BOOTSTRAP === '1';

function info(msg) {
  console.log(`[bootstrap] ${msg}`);
}

function fail(message, nextAction, error) {
  console.error(`\n[bootstrap] ERROR: ${message}`);
  if (nextAction) {
    console.error(`[bootstrap] Next step: ${nextAction}`);
  }
  if (DEBUG && error) {
    console.error(error.stack || String(error));
  }
  process.exit(1);
}

function run(command, args, stepName, onFailAction) {
  info(stepName);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail(`${stepName} failed.`, onFailAction);
  }
}

function commandExists(command, versionArgs = ['--version']) {
  const result = spawnSync(command, versionArgs, {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function getNodeMajor() {
  const v = process.versions.node || '';
  const major = Number(v.split('.')[0]);
  return Number.isFinite(major) ? major : NaN;
}

function parseMode() {
  const arg = process.argv.find(value => value.startsWith('--mode='));
  if (arg) return arg.slice('--mode='.length);
  if (process.env.BOOTSTRAP_MODE) return process.env.BOOTSTRAP_MODE;
  return 'tui';
}

function binName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function localBinExists(name) {
  return fs.existsSync(path.join(ROOT, 'node_modules', '.bin', binName(name)));
}

function dependenciesHealthy(mode) {
  const nodeModulesPath = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) return false;

  const baseBins = ['tsc', 'playwright'];
  const guiBins = ['vite', 'electron'];
  const requiredBins = mode === 'gui' ? [...baseBins, ...guiBins] : baseBins;

  return requiredBins.every(localBinExists);
}

function installDependencies(mode) {
  const lockPath = path.join(ROOT, 'package-lock.json');
  const useCi = fs.existsSync(lockPath);
  const installArgs = useCi ? ['ci'] : ['install'];
  if (mode === 'tui') {
    installArgs.push('--omit=optional');
  }

  const stepName = `Installing dependencies with npm ${installArgs.join(' ')}...`;
  const onFailAction =
    mode === 'gui'
      ? 'Electron failed to download. This is usually a network/CDN/VPN issue. Turn on VPN or use a stable network, delete node_modules and rerun start-gui, and optionally set ELECTRON_MIRROR if your environment documents a mirror.'
      : `Run "npm ${installArgs.join(' ')}" manually and fix any installation errors.`;

  run('npm', installArgs, stepName, onFailAction);

  if (!dependenciesHealthy(mode)) {
    const healthFailAction =
      mode === 'gui'
        ? 'Electron failed to download. This is usually a network/CDN/VPN issue. Turn on VPN or use a stable network, delete node_modules and rerun start-gui, and optionally set ELECTRON_MIRROR if your environment documents a mirror.'
        : 'Dependencies are still incomplete after install. Delete node_modules and rerun bootstrap.';
    fail('Dependencies are incomplete after install.', healthFailAction);
  }
}

function isPlaywrightChromiumInstalled() {
  try {
    const { chromium } = require('playwright');
    const executable = chromium.executablePath();
    return Boolean(executable && fs.existsSync(executable));
  } catch {
    return false;
  }
}

function guiBuildHealthy() {
  const requiredFiles = [
    path.join(ROOT, 'dist', 'cli.js'),
    path.join(ROOT, 'dist', 'gui', 'main.js'),
    path.join(ROOT, 'dist', 'gui', 'preload.js'),
    path.join(ROOT, 'dist', 'gui', 'renderer', 'index.html'),
  ];
  return requiredFiles.every(filePath => fs.existsSync(filePath));
}

(function main() {
  const mode = parseMode();
  if (!['tui', 'gui'].includes(mode)) {
    fail(
      `Unsupported bootstrap mode "${mode}".`,
      'Use --mode=tui or --mode=gui (or set BOOTSTRAP_MODE to tui/gui).',
    );
  }

  info(`Starting setup checks (${mode.toUpperCase()} mode)...`);

  if (!commandExists('node')) {
    fail('Node.js is missing.', 'Install Node.js 20.x or 22.x LTS from https://nodejs.org/ then run start again.');
  }

  const nodeMajor = getNodeMajor();
  if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
    fail(
      `Unsupported Node.js version v${process.versions.node}.`,
      'Install Node.js 20.x or 22.x LTS, then run start again.',
    );
  }

  if (nodeMajor >= 24) {
    fail(
      `Node.js v${process.versions.node} is too new for this project.`,
      'Install Node.js 20.x or 22.x LTS, then run start again.',
    );
  }

  info(`Node.js version OK: v${process.versions.node}`);

  if (!commandExists('npm')) {
    fail('npm is missing.', 'Reinstall Node.js from https://nodejs.org/ and run start again.');
  }

  const nodeModulesPath = path.join(ROOT, 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesPath);
  const healthy = dependenciesHealthy(mode);

  if (!hasNodeModules) {
    installDependencies(mode);
  } else if (!healthy) {
    info('Dependencies appear incomplete. Reinstalling...');
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    installDependencies(mode);
  } else {
    info('Dependencies already installed.');
  }

  const distCliPath = path.join(ROOT, 'dist', 'cli.js');
  if (mode === 'gui') {
    if (!guiBuildHealthy()) {
      run('npm', ['run', 'build:gui'], 'Building CLI + GUI...', 'Run "npm run build:gui" manually and fix the build errors.');
    } else {
      info('GUI build output already present.');
    }
  } else if (!fs.existsSync(distCliPath)) {
    run('npm', ['run', 'build'], 'Building project...', 'Run "npm run build" manually and fix the build errors.');
  } else {
    info('Build output already present.');
  }

  if (!isPlaywrightChromiumInstalled()) {
    run(
      'npx',
      ['playwright', 'install', 'chromium'],
      'Installing Playwright Chromium...',
      'Run "npx playwright install chromium" manually, then run start again.',
    );
  } else {
    info('Playwright Chromium already installed.');
  }

  info('Bootstrap complete.');
})();
