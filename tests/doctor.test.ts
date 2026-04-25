import { isSupportedNodeVersion, formatDoctorLine } from '../src/utils/doctor';

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
});
