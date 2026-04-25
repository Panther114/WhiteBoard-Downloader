import { compactConfigOverrides, getConfig } from '../src/config';

describe('config overrides', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BB_USERNAME = 'G123456';
    process.env.BB_PASSWORD = 'secret-pass';
    process.env.HEADLESS = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('preserves base credentials when username/password overrides are undefined', () => {
    const config = getConfig({ username: undefined, password: undefined });
    expect(config.username).toBe('G123456');
    expect(config.password).toBe('secret-pass');
  });

  it('keeps explicit false boolean overrides', () => {
    const config = getConfig({ headless: false });
    expect(config.headless).toBe(false);
  });

  it('drops undefined and blank string overrides', () => {
    const compacted = compactConfigOverrides({
      username: undefined,
      password: '   ',
      downloadDir: '',
      headless: false,
    });
    expect(compacted).toEqual({ headless: false });
  });
});
