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

function isPlaywrightChromiumInstalled() {
  try {
    const { chromium } = require('playwright');
    const executable = chromium.executablePath();
    return Boolean(executable && fs.existsSync(executable));
  } catch {
    return false;
  }
}

(function main() {
  info('Starting setup checks...');

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
  if (!hasNodeModules) {
    const lockPath = path.join(ROOT, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      run('npm', ['ci'], 'Installing dependencies with npm ci...', 'Run "npm ci" manually and fix any installation errors.');
    } else {
      run(
        'npm',
        ['install'],
        'Installing dependencies with npm install...',
        'Run "npm install" manually and fix any installation errors.',
      );
    }
  } else {
    info('Dependencies already installed.');
  }

  const distCliPath = path.join(ROOT, 'dist', 'cli.js');
  if (!fs.existsSync(distCliPath)) {
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
