import { mapToUserError } from '../src/utils/userErrors';

describe('user error mapping', () => {
  it('maps unsupported node errors', () => {
    const mapped = mapToUserError(new Error('Unsupported Node version v24'));
    expect(mapped.whatHappened.toLowerCase()).toContain('node.js version');
  });

  it('maps login failures', () => {
    const mapped = mapToUserError(new Error('Login failed - could not find course list'));
    expect(mapped.whatHappened.toLowerCase()).toContain('login failed');
  });

  it('maps permission errors', () => {
    const mapped = mapToUserError(new Error('EACCES: permission denied'));
    expect(mapped.whatHappened.toLowerCase()).toContain('permission');
  });

  it('falls back to generic message', () => {
    const mapped = mapToUserError(new Error('something else'));
    expect(mapped.whatHappened.toLowerCase()).toContain('unexpected error');
  });
});
