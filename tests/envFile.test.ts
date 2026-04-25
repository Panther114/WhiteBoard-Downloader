import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeEnvFile, readEnvFile } from '../src/utils/envFile';

describe('env file writing behavior', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-env-test-'));

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('preserves existing password when new password is empty', () => {
    const envPath = path.join(tmpRoot, '.env');
    fs.writeFileSync(envPath, 'BB_USERNAME=G12345\nBB_PASSWORD=secret123\n', 'utf-8');

    writeEnvFile(
      envPath,
      {
        BB_USERNAME: 'G12345',
        BB_PASSWORD: '',
      },
      { preserveEmptyPassword: true },
    );

    const env = readEnvFile(envPath);
    expect(env.BB_PASSWORD).toBe('secret123');
  });

  it('recreates env cleanly on reset', () => {
    const envPath = path.join(tmpRoot, '.env.reset');
    fs.writeFileSync(envPath, 'OLD_KEY=yes\nBB_USERNAME=old\n', 'utf-8');

    writeEnvFile(
      envPath,
      {
        BB_USERNAME: 'new-user',
        BB_PASSWORD: 'new-pass',
      },
      { reset: true },
    );

    const text = fs.readFileSync(envPath, 'utf-8');
    expect(text).toContain('BB_USERNAME=new-user');
    expect(text).toContain('BB_PASSWORD=new-pass');
    expect(text).not.toContain('OLD_KEY=yes');
  });
});
