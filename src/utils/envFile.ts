import fs from 'fs';

export type EnvMap = Record<string, string>;

export function parseEnv(content: string): EnvMap {
  const out: EnvMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    out[key] = value;
  }
  return out;
}

export function readEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) return {};
  return parseEnv(fs.readFileSync(filePath, 'utf-8'));
}

export function mergeEnvContent(content: string, values: EnvMap): string {
  let merged = content;

  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (regex.test(merged)) {
      merged = merged.replace(regex, line);
    } else {
      merged += (merged.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  }

  return merged;
}

export function writeEnvFile(
  envPath: string,
  values: EnvMap,
  options?: { reset?: boolean; preserveEmptyPassword?: boolean },
): void {
  const reset = options?.reset === true;
  const preserveEmptyPassword = options?.preserveEmptyPassword !== false;

  let content = '';
  if (!reset) {
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    } else if (fs.existsSync(`${envPath}.example`)) {
      content = fs.readFileSync(`${envPath}.example`, 'utf-8');
    }
  }

  const existing = parseEnv(content);
  const nextValues = { ...values };

  if (preserveEmptyPassword && nextValues.BB_PASSWORD !== undefined && nextValues.BB_PASSWORD.trim() === '') {
    if (existing.BB_PASSWORD && existing.BB_PASSWORD.trim().length > 0) {
      nextValues.BB_PASSWORD = existing.BB_PASSWORD;
    } else {
      delete nextValues.BB_PASSWORD;
    }
  }

  const merged = mergeEnvContent(content, nextValues);
  fs.writeFileSync(envPath, merged, 'utf-8');
}

export function hasValidCredentials(env: EnvMap): boolean {
  const user = (env.BB_USERNAME || '').trim();
  const pass = (env.BB_PASSWORD || '').trim();
  const invalidUser = !user || user === 'your_g_number';
  const invalidPass = !pass || pass === 'your_password';
  return !(invalidUser || invalidPass);
}
