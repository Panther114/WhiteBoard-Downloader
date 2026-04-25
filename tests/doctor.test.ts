import fs from 'fs';
import os from 'os';
import path from 'path';
import { isSupportedNodeVersion, formatDoctorLine, isConfigReadyForLaunch } from '../src/utils/doctor';

describe('doctor helpers', () => {
  it('validates supported node version range', () => {
    expect(isSupportedNodeVersion('v18.20.0')).toBe(true);
    expect(isSupportedNodeVersion('v23.1.0')).toBe(true);
    expect(isSupportedNodeVersion('v17.9.0')).toBe(false);
    expect(isSupportedNodeVersion('v24.0.0')).toBe(false);
  });

  it('formats doctor output line', () => {
    expect(formatDoctorLine({ status: 'pass', message: 'ok' })).toBe('✓ ok');
    expect(formatDoctorLine({ status: 'fail', message: 'bad' })).toBe('✗ bad');
    expect(formatDoctorLine({ status: 'warn', message: 'warn' })).toBe('⚠ warn');
  });

  it('config-check helper fails when .env is missing', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-doctor-test-missing-'));
    const envPath = path.join(tmpRoot, '.env');

    const result = isConfigReadyForLaunch(envPath);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('.env missing');

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('config-check helper fails for placeholder credentials', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-doctor-test-placeholder-'));
    const envPath = path.join(tmpRoot, '.env');
    fs.writeFileSync(envPath, 'BB_USERNAME=your_g_number\nBB_PASSWORD=your_password\n', 'utf-8');

    const result = isConfigReadyForLaunch(envPath);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Blackboard credentials missing or placeholder values');

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('config-check helper passes for valid credentials', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-doctor-test-valid-'));
    const envPath = path.join(tmpRoot, '.env');
    fs.writeFileSync(envPath, 'BB_USERNAME=G123456\nBB_PASSWORD=secret-pass\n', 'utf-8');

    const result = isConfigReadyForLaunch(envPath);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('config-check helper validity does not depend on npm availability', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-doctor-test-path-'));
    const envPath = path.join(tmpRoot, '.env');
    fs.writeFileSync(envPath, 'BB_USERNAME=G123456\nBB_PASSWORD=secret-pass\n', 'utf-8');

    const result = (() => {
      const originalPath = process.env.PATH;
      try {
        process.env.PATH = '';
        return isConfigReadyForLaunch(envPath);
      } finally {
        process.env.PATH = originalPath;
      }
    })();

    expect(result.ok).toBe(true);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
