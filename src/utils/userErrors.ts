import path from 'path';

export interface UserErrorInfo {
  whatHappened: string;
  likelyCause: string;
  nextAction: string;
  logsLocation: string;
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some(n => haystack.includes(n));
}

export function mapToUserError(error: unknown, logsPath = './logs/whiteboard.log'): UserErrorInfo {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error || 'Unknown error');
  const text = raw.toLowerCase();

  if (includesAny(text, ['unsupported node', 'requires node', 'node version', 'ebadengine'])) {
    return {
      whatHappened: 'Your Node.js version is not supported.',
      likelyCause: 'The app requires Node.js 18–23.',
      nextAction: 'Install Node.js 20.x or 22.x LTS, then run the start file again.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['cannot find module', 'node_modules', 'npm install', 'npm ci'])) {
    return {
      whatHappened: 'Dependencies are missing or incomplete.',
      likelyCause: 'Packages were not installed yet or installation failed.',
      nextAction: 'Run the setup/start file again so bootstrap can install dependencies.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['playwright', 'executable doesn\'t exist', 'browser has not been found'])) {
    return {
      whatHappened: 'Playwright Chromium is not installed.',
      likelyCause: 'Browser binaries were not downloaded yet.',
      nextAction: 'Run the setup/start file again, or run: npx playwright install chromium',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['login failed', 'invalid credentials', 'authentication'])) {
    return {
      whatHappened: 'Blackboard login failed.',
      likelyCause: 'Credentials are incorrect, expired, or blocked by Blackboard verification.',
      nextAction: 'Run: whiteboard-dl setup --reset and verify your Blackboard username/password.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['econnrefused', 'enetunreach', 'etimedout', 'blackboard unreachable'])) {
    return {
      whatHappened: 'Blackboard could not be reached.',
      likelyCause: 'Network instability, firewall/proxy issues, or Blackboard outage.',
      nextAction: 'Check internet access and Blackboard site availability, then retry.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['no courses found'])) {
    return {
      whatHappened: 'No courses were discovered.',
      likelyCause: 'No visible courses, filter is too strict, or Blackboard layout changed.',
      nextAction: 'Run setup and relax course filtering, then retry.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['no downloadable files found'])) {
    return {
      whatHappened: 'No downloadable supported documents were found.',
      likelyCause: 'Selected courses contain no allowed document files.',
      nextAction: 'Try different courses/sections or verify files are PDF/PPT/PPTX/DOC/DOCX/XLS/XLSX.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['eacces', 'eperm', 'permission denied'])) {
    return {
      whatHappened: 'A file permission error occurred.',
      likelyCause: 'The app cannot write to download/log/database paths.',
      nextAction: 'Choose a writable folder in setup or run with proper permissions.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['database is locked', 'sqlite_busy', 'resource busy', 'ebusy'])) {
    return {
      whatHappened: 'Database or file is currently locked.',
      likelyCause: 'Another process is using the same database/file.',
      nextAction: 'Close other running instances, wait a moment, then retry.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['session expired', 'not logged in'])) {
    return {
      whatHappened: 'Your Blackboard session expired.',
      likelyCause: 'Session timed out during scraping or downloading.',
      nextAction: 'Run the downloader again to login fresh.',
      logsLocation: path.resolve(logsPath),
    };
  }

  if (includesAny(text, ['invalid .env', 'username is required', 'password is required'])) {
    return {
      whatHappened: 'Configuration in .env is missing or invalid.',
      likelyCause: 'Credentials or required settings are empty/placeholders.',
      nextAction: 'Run: whiteboard-dl setup --reset to recreate config.',
      logsLocation: path.resolve(logsPath),
    };
  }

  return {
    whatHappened: 'The downloader encountered an unexpected error.',
    likelyCause: 'A runtime error occurred while running this command.',
    nextAction: 'Run the setup/start file again. If it still fails, run whiteboard-dl doctor and share logs.',
    logsLocation: path.resolve(logsPath),
  };
}

export function formatUserError(info: UserErrorInfo): string {
  return [
    `What happened: ${info.whatHappened}`,
    `Most likely cause: ${info.likelyCause}`,
    `Try next: ${info.nextAction}`,
    `Logs: ${info.logsLocation}`,
  ].join('\n');
}
