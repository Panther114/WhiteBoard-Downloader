#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import cliProgress from 'cli-progress';
import { WhiteboardDownloader } from './index';
import { getConfig } from './config';
import { Config, Course, DiscoveredFile } from './types';
import { formatBytes, sanitizeFilename } from './utils/helpers';
import { isFileInTree } from './fileTree';
import { BlackboardAuth } from './auth';
import { readEnvFile, writeEnvFile, hasValidCredentials } from './utils/envFile';
import {
  checkPlaywrightChromiumInstalled,
  checkUrlReachable,
  checkWritableDir,
  evaluateConfigEnv,
  formatDoctorLine,
  getDoctorPaths,
  isSupportedNodeVersion,
  type DoctorCheck,
} from './utils/doctor';
import { formatUserError, mapToUserError } from './utils/userErrors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InquirerSeparator: new (line?: string) => unknown = (inquirer as any).Separator;

const program = new Command();

program
  .name('whiteboard-dl')
  .description('Modern automation tool to download course materials from SHSID Blackboard China')
  .version('2.0.0');

function isDebugMode(): boolean {
  return process.env.DEBUG === '1' || process.env.LOG_LEVEL === 'debug';
}

function handleUserFacingError(error: unknown, logsPath?: string): void {
  const friendly = mapToUserError(error, logsPath);
  console.error(chalk.red('\n' + formatUserError(friendly) + '\n'));

  if (isDebugMode()) {
    const stack = error instanceof Error ? error.stack || error.message : String(error);
    console.error(chalk.gray('Debug details:\n' + stack + '\n'));
  }
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '?';

  const rounded = Math.round(seconds);
  if (rounded < 60) return `${Math.max(0, rounded)}s`;

  if (rounded < 3600) {
    const minutes = Math.floor(rounded / 60);
    const remainingSeconds = rounded % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(rounded / 3600);
  const remainingMinutes = Math.floor((rounded % 3600) / 60);
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}m`;
}

function escapeRegexLiteral(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeRunSummary(report: {
  startedAt: string;
  endedAt: string;
  coursesDiscovered: number;
  coursesSelected: number;
  filesDiscovered: number;
  filesSelected: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesFailed: number;
  failedFiles: Array<{ name: string; reason: string }>;
  logFilePath: string;
  downloadDir: string;
  runError?: string;
}): void {
  const logsDir = path.resolve('logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const latestSummaryPath = path.join(logsDir, 'latest-summary.txt');
  const lines = [
    `startedAt: ${report.startedAt}`,
    `endedAt: ${report.endedAt}`,
    `courses discovered: ${report.coursesDiscovered}`,
    `courses selected: ${report.coursesSelected}`,
    `files discovered: ${report.filesDiscovered}`,
    `files selected: ${report.filesSelected}`,
    `files downloaded: ${report.filesDownloaded}`,
    `files skipped: ${report.filesSkipped}`,
    `files failed: ${report.filesFailed}`,
    `log file: ${path.resolve(report.logFilePath)}`,
  ];

  if (report.runError) {
    lines.push(`run error: ${report.runError}`);
  }

  if (report.failedFiles.length > 0) {
    lines.push('failed files:');
    for (const failed of report.failedFiles) {
      lines.push(`- ${failed.name}: ${failed.reason}`);
    }
  }

  fs.writeFileSync(latestSummaryPath, lines.join('\n') + '\n', 'utf-8');

  const reportJsonPath = path.resolve(report.downloadDir, 'whiteboard-run-report.json');
  fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify(
      {
        startedAt: report.startedAt,
        endedAt: report.endedAt,
        coursesDiscovered: report.coursesDiscovered,
        coursesSelected: report.coursesSelected,
        filesDiscovered: report.filesDiscovered,
        filesSelected: report.filesSelected,
        filesDownloaded: report.filesDownloaded,
        filesSkipped: report.filesSkipped,
        filesFailed: report.filesFailed,
        failedFiles: report.failedFiles,
        logFilePath: path.resolve(report.logFilePath),
        runError: report.runError,
      },
      null,
      2,
    ),
    'utf-8',
  );
}

program
  .command('setup')
  .description('First-time setup wizard for Blackboard credentials and downloader options')
  .option('--reset', 'Recreate config cleanly and overwrite existing values')
  .option('--test-login', 'Test Blackboard login immediately after saving setup')
  .action(async options => {
    try {
      console.log(chalk.bold.cyan('\n🛠️  Whiteboard Downloader — Setup Wizard\n'));

      const envPath = path.resolve('.env');
      const existing = options.reset ? {} : readEnvFile(envPath);
      const hasExistingPassword = Boolean(existing.BB_PASSWORD && existing.BB_PASSWORD !== 'your_password');

      const courseFilterDefaultMode = existing.COURSE_FILTER ? 'regex' : 'all';
      const defaultIncludeNonSubject = existing.INCLUDE_NON_SUBJECT_COURSES === 'true';
      const defaultHeadless = existing.HEADLESS !== 'false';

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Blackboard username / G-number:',
          default: existing.BB_USERNAME && existing.BB_USERNAME !== 'your_g_number' ? existing.BB_USERNAME : undefined,
          validate: (v: string) => v.trim().length > 0 || 'Username is required',
        },
        {
          type: 'password',
          name: 'password',
          message: hasExistingPassword && !options.reset ? 'Blackboard password (leave blank to keep current):' : 'Blackboard password:',
          mask: '*',
          validate: (v: string) => {
            if (options.reset || !hasExistingPassword) {
              return v.trim().length > 0 || 'Password is required';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'downloadDir',
          message: 'Download directory:',
          default: existing.DOWNLOAD_DIR || './downloads',
          validate: (v: string) => v.trim().length > 0 || 'Download directory is required',
        },
        {
          type: 'list',
          name: 'courseFilterMode',
          message: 'Course filtering mode:',
          default: courseFilterDefaultMode,
          choices: [
            { name: '1) Download all normal subject courses', value: 'all' },
            { name: '2) Only courses containing a phrase', value: 'phrase' },
            { name: '3) Advanced regex course filter', value: 'regex' },
          ],
        },
        {
          type: 'input',
          name: 'coursePhrase',
          message: 'Enter phrase to match in course names:',
          when: (a: any) => a.courseFilterMode === 'phrase',
          validate: (v: string) => v.trim().length > 0 || 'Phrase is required',
        },
        {
          type: 'input',
          name: 'courseRegex',
          message: 'Enter regex pattern for course names:',
          default: existing.COURSE_FILTER || '',
          when: (a: any) => a.courseFilterMode === 'regex',
          validate: (v: string) => {
            if (!v.trim()) return 'Regex is required';
            try {
              new RegExp(v);
              return true;
            } catch {
              return 'Invalid regex pattern';
            }
          },
        },
        {
          type: 'confirm',
          name: 'includeNonSubjectCourses',
          message: 'Include non-subject / organization courses?',
          default: defaultIncludeNonSubject,
        },
        {
          type: 'confirm',
          name: 'headless',
          message: 'Run browser in headless mode by default? (Visible mode helps debugging)',
          default: defaultHeadless,
        },
        {
          type: 'confirm',
          name: 'testLoginNow',
          message: 'Test Blackboard login now?',
          default: Boolean(options.testLogin),
          when: () => !options.testLogin,
        },
      ]);

      let courseFilter = '';
      if (answers.courseFilterMode === 'phrase') {
        courseFilter = escapeRegexLiteral((answers.coursePhrase || '').trim());
      } else if (answers.courseFilterMode === 'regex') {
        courseFilter = (answers.courseRegex || '').trim();
      }

      const values: Record<string, string> = {
        BB_USERNAME: answers.username.trim(),
        BB_PASSWORD: answers.password,
        DOWNLOAD_DIR: answers.downloadDir.trim(),
        COURSE_FILTER: courseFilter,
        INCLUDE_NON_SUBJECT_COURSES: String(Boolean(answers.includeNonSubjectCourses)),
        HEADLESS: String(Boolean(answers.headless)),
      };

      writeEnvFile(envPath, values, {
        reset: Boolean(options.reset),
        preserveEmptyPassword: true,
      });

      const effectiveEnv = readEnvFile(envPath);
      Object.assign(process.env, effectiveEnv);

      console.log(chalk.green(`\n✓ Configuration saved to ${envPath}`));

      const shouldTestLogin = Boolean(options.testLogin || answers.testLoginNow);
      if (shouldTestLogin) {
        const spinner = ora('Testing Blackboard login...').start();
        let auth: BlackboardAuth | null = null;
        try {
          const cfg = getConfig({ headless: Boolean(answers.headless) });
          auth = new BlackboardAuth(cfg);
          await auth.launchBrowser();
          await auth.login();
          spinner.succeed('Login test passed');
        } catch (error) {
          spinner.fail('Login test failed');
          console.log(chalk.yellow('\nTroubleshooting steps:'));
          console.log(chalk.yellow('1) Verify username/G-number and password.'));
          console.log(chalk.yellow('2) Try HEADLESS=false in setup so you can watch the login flow.'));
          console.log(chalk.yellow('3) Check your network and Blackboard availability.'));
          handleUserFacingError(error, './logs/whiteboard.log');
          process.exitCode = 1;
          return;
        } finally {
          if (auth) await auth.close();
        }
      }

      console.log(chalk.bold.green('\n✅ Setup complete!\n'));
      console.log(chalk.white('Use the start script again to launch downloads.\n'));
    } catch (error) {
      handleUserFacingError(error, './logs/whiteboard.log');
      process.exitCode = 1;
      return;
    }
  });

program
  .command('doctor')
  .description('Run environment and configuration checks')
  .option('--login', 'Attempt a real Blackboard login using current config')
  .option('--config-only', 'Only validate local setup/config checks')
  .action(async options => {
    const checks: DoctorCheck[] = [];

    const add = (status: DoctorCheck['status'], message: string, required = true) => {
      checks.push({ status, message, required });
      console.log(formatDoctorLine({ status, message }));
    };

    try {
      if (isSupportedNodeVersion(process.version)) {
        add('pass', `Node.js version supported (${process.version})`);
      } else {
        add('fail', `Node.js version unsupported (${process.version}); required >=18 and <24`);
      }

      const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf-8' });
      if (npmVersion.status === 0) {
        add('pass', `npm available (${npmVersion.stdout.trim()})`);
      } else {
        add('fail', 'npm is not available in PATH');
      }

      if (fs.existsSync(path.resolve('node_modules'))) {
        add('pass', 'Dependencies installed');
      } else {
        add('fail', 'Dependencies missing (node_modules not found)');
      }

      if (fs.existsSync(path.resolve('dist/cli.js'))) {
        add('pass', 'Build output exists (dist/cli.js)');
      } else {
        add('fail', 'Build output missing (dist/cli.js not found)');
      }

      if (checkPlaywrightChromiumInstalled()) {
        add('pass', 'Playwright Chromium installed');
      } else {
        add('warn', 'Playwright Chromium not installed; run setup/start again', false);
      }

      const envPath = path.resolve('.env');
      const envStatus = evaluateConfigEnv(envPath);
      if (envStatus.exists) {
        add('pass', '.env file exists');
      } else {
        add('fail', '.env file missing');
      }

      if (envStatus.validCredentials) {
        add('pass', 'Blackboard credentials configured');
      } else {
        add('fail', 'Blackboard credentials missing or placeholder values');
      }

      const env = envStatus.env;
      const cfgForPaths = {
        downloadDir: env.DOWNLOAD_DIR || './downloads',
        logFile: env.LOG_FILE || './logs/whiteboard.log',
        databasePath: env.DATABASE_PATH || './whiteboard.db',
      };

      const { downloadDir, logDir, dbDir } = {
        downloadDir: path.resolve(cfgForPaths.downloadDir),
        logDir: path.resolve(path.dirname(cfgForPaths.logFile)),
        dbDir: path.resolve(path.dirname(cfgForPaths.databasePath)),
      };

      if (checkWritableDir(downloadDir)) {
        add('pass', `Download directory writable (${downloadDir})`);
      } else {
        add('fail', `Download directory not writable (${downloadDir})`);
      }

      if (checkWritableDir(logDir)) {
        add('pass', `Log directory writable (${logDir})`);
      } else {
        add('fail', `Log directory not writable (${logDir})`);
      }

      if (checkWritableDir(dbDir)) {
        add('pass', `Database directory writable (${dbDir})`);
      } else {
        add('fail', `Database directory not writable (${dbDir})`);
      }

      if (!options.configOnly) {
        const baseUrl = env.BB_BASE_URL || 'https://shs.blackboardchina.cn';
        const loginUrl = env.BB_LOGIN_URL || 'https://shs.blackboardchina.cn/webapps/login/';

        if (await checkUrlReachable(baseUrl)) {
          add('pass', 'Blackboard base URL reachable');
        } else {
          add('warn', 'Blackboard base URL unreachable right now', false);
        }

        if (await checkUrlReachable(loginUrl)) {
          add('pass', 'Blackboard login URL reachable');
        } else {
          add('warn', 'Blackboard login URL unreachable right now', false);
        }
      }

      if (options.login) {
        if (!envStatus.validCredentials) {
          add('fail', 'Cannot run login test: credentials are missing');
        } else {
          let auth: BlackboardAuth | null = null;
          try {
            const cfg = getConfig({ headless: true });
            const paths = getDoctorPaths(cfg);
            if (!checkWritableDir(paths.downloadDir) || !checkWritableDir(paths.logDir) || !checkWritableDir(paths.dbDir)) {
              add('fail', 'Cannot run login test: required directories are not writable');
            } else {
              auth = new BlackboardAuth(cfg);
              await auth.launchBrowser();
              await auth.login();
              add('pass', 'Blackboard login test passed');
            }
          } catch {
            add('fail', 'Blackboard login test failed');
          } finally {
            if (auth) await auth.close();
          }
        }
      }

      const hasRequiredFailure = checks.some(c => c.required !== false && c.status === 'fail');
      process.exit(hasRequiredFailure ? 1 : 0);
    } catch (error) {
      handleUserFacingError(error, './logs/whiteboard.log');
      process.exitCode = 1;
      return;
    }
  });

program
  .command('download')
  .description('Discover course materials, select files interactively, then download')
  .option('-u, --username <username>', 'Blackboard username (G-Number)')
  .option('-p, --password <password>', 'Blackboard password')
  .option('-d, --dir <directory>', 'Download directory', './downloads')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--filter <pattern>', 'Course filter regex pattern')
  .option(
    '--include-non-subject-courses',
    'Include broad/non-subject organisation courses during automatic course filtering',
    false,
  )
  .option('--all', 'Skip the selection GUI and download everything')
  .action(async options => {
    const runStartedAt = new Date().toISOString();

    const report = {
      startedAt: runStartedAt,
      endedAt: runStartedAt,
      coursesDiscovered: 0,
      coursesSelected: 0,
      filesDiscovered: 0,
      filesSelected: 0,
      filesDownloaded: 0,
      filesSkipped: 0,
      filesFailed: 0,
      failedFiles: [] as Array<{ name: string; reason: string }>,
      logFilePath: './logs/whiteboard.log',
      downloadDir: options.dir || './downloads',
      runError: undefined as string | undefined,
    };

    let wbDownloader: WhiteboardDownloader | null = null;

    try {
      console.log(chalk.bold.cyan('\n🎓 Whiteboard Downloader v2.0\n'));

      let username = options.username;
      let password = options.password;

      if (!username || !password) {
        console.log(chalk.yellow('Please enter your Blackboard credentials:\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'username',
            message: 'G-Number:',
            when: !username,
            validate: (input: string) => input.length > 0 || 'Username is required',
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            when: !password,
            mask: '*',
            validate: (input: string) => input.length > 0 || 'Password is required',
          },
        ]);

        username = username || answers.username;
        password = password || answers.password;

        const envPath = path.resolve('.env');
        const { saveCredentials } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'saveCredentials',
            message: `Save credentials to ${envPath} so you don't have to re-enter them next time?`,
            default: true,
          },
        ]);

        if (saveCredentials) {
          writeEnvFile(envPath, { BB_USERNAME: username, BB_PASSWORD: password }, { preserveEmptyPassword: true });
          console.log(chalk.green(`\n✓ Credentials saved to ${envPath}\n`));
        }
      }

      const config: Config = getConfig({
        username,
        password,
        downloadDir: options.dir,
        headless: options.headless === 'true',
        courseFilter: options.filter,
        includeNonSubjectCourses: Boolean(options.includeNonSubjectCourses),
      });

      report.logFilePath = config.logFile;
      report.downloadDir = config.downloadDir;

      console.log(chalk.gray(`\nDownload directory: ${config.downloadDir}`));
      console.log(chalk.gray(`Browser mode: ${config.headless ? 'headless' : 'visible'}`));
      if (config.courseFilter) {
        console.log(chalk.gray(`Course filter: ${config.courseFilter}`));
      }
      console.log(chalk.gray(`Include non-subject courses: ${config.includeNonSubjectCourses ? 'yes' : 'no'}`));
      console.log();

      const spinner = ora('Initializing...').start();
      wbDownloader = new WhiteboardDownloader(config);

      let singleBar: cliProgress.SingleBar | null = null;
      let completedFiles = 0;
      let failedFiles = 0;
      let skippedFiles = 0;
      let skippedOnDisk = 0;

      try {
        spinner.text = 'Launching browser and logging in...';
        await wbDownloader.initialize();
        spinner.succeed('Logged in successfully');

        spinner.start('Fetching course list...');
        const allCourses = await wbDownloader.getCourses();
        spinner.stop();

        report.coursesDiscovered = allCourses.length;

        if (allCourses.length === 0) {
          console.log(chalk.yellow('\nNo courses found.\n'));
          return;
        }

        let selectedCourses: Course[];

        if (options.all) {
          selectedCourses = allCourses;
          console.log(chalk.cyan(`\n📚 Processing all ${allCourses.length} courses...\n`));
        } else {
          console.log();
          selectedCourses = await selectCoursesInteractively(allCourses);

          if (selectedCourses.length === 0) {
            console.log(chalk.yellow('\nNo courses selected. Exiting.\n'));
            return;
          }

          console.log(chalk.cyan(`\n📚 Scanning ${selectedCourses.length} selected course(s)...\n`));
        }

        report.coursesSelected = selectedCourses.length;

        spinner.start('Scanning selected course materials...');
        const discoveredFiles = await wbDownloader.discoverAllFiles(selectedCourses);
        spinner.stop();

        report.filesDiscovered = discoveredFiles.length;

        if (discoveredFiles.length === 0) {
          console.log(chalk.yellow('\nNo downloadable files found.\n'));
          return;
        }

        spinner.start(`Fetching metadata for ${discoveredFiles.length} files...`);
        const enrichedFiles = await wbDownloader.fetchFileMetadata(discoveredFiles);
        const withSize = enrichedFiles.filter(f => f.size !== undefined).length;
        spinner.succeed(`Metadata fetched (${withSize} of ${enrichedFiles.length} files have known size)`);

        const fileTree = wbDownloader.getFileTree();
        const filtered = filterAlreadyDownloaded(enrichedFiles, fileTree);
        const undownloadedFiles = filtered.files;
        skippedOnDisk = filtered.skippedOnDisk;
        if (skippedOnDisk > 0) {
          console.log(chalk.gray(`   ↳ Skipped ${skippedOnDisk} file(s) already present in downloads folder`));
        }

        if (undownloadedFiles.length === 0) {
          report.filesSkipped = skippedOnDisk;
          console.log(chalk.green('\n✓ All files are already downloaded.\n'));
          return;
        }

        let filesToDownload: DiscoveredFile[];

        if (options.all) {
          filesToDownload = undownloadedFiles;
          console.log(chalk.cyan(`\n📥 Downloading all ${filesToDownload.length} files...\n`));
        } else {
          console.log();
          filesToDownload = await selectFilesInteractively(undownloadedFiles);

          if (filesToDownload.length === 0) {
            console.log(chalk.yellow('\nNo files selected. Exiting.\n'));
            return;
          }

          console.log(chalk.cyan(`\n📥 Downloading ${filesToDownload.length} selected files...\n`));
        }

        report.filesSelected = filesToDownload.length;

        const totalFilesCount = filesToDownload.length;
        const knownFileSizes = new Map<string, number>();
        for (const file of filesToDownload) {
          if (file.size !== undefined) {
            knownFileSizes.set(file.url, file.size);
          }
        }
        const knownSizeFileCount = knownFileSizes.size;
        const unknownSizeFileCount = totalFilesCount - knownSizeFileCount;
        const totalKnownBytes = Array.from(knownFileSizes.values()).reduce((sum, size) => sum + size, 0);
        const useByteProgress = totalKnownBytes > 0;
        const totalLabel = useByteProgress ? formatBytes(totalKnownBytes) : 'file-count';
        const progressBarTotal = useByteProgress ? totalKnownBytes : totalFilesCount;
        const unknownFilesSuffix = unknownSizeFileCount > 0 ? ` (+${unknownSizeFileCount} unknown size)` : '';

        singleBar = new cliProgress.SingleBar(
          {
            clearOnComplete: false,
            hideCursor: true,
            format:
              useByteProgress
                ? ' {bar} {percentage}% | {downloadedStr}/{totalStr} | {completedFiles}/{totalFilesCount} files{unknownFilesStr} | {speedStr} | ETA {etaStr}'
                : ' {bar} {percentage}% (file-count) | {completedFiles}/{totalFilesCount} files | {speedStr} | ETA {etaStr}',
          },
          cliProgress.Presets.shades_classic,
        );

        const bar = singleBar;
        const fileDownloaded = new Map<string, number>();
        let totalDownloadedKnownBytes = 0;
        let speedWindowStart = Date.now();
        let speedWindowBytes = 0;
        let currentSpeedBps = 0;

        const refreshSpeed = () => {
          const now = Date.now();
          const elapsed = now - speedWindowStart;
          if (elapsed >= 1000) {
            currentSpeedBps = speedWindowBytes / (elapsed / 1000);
            speedWindowStart = now;
            speedWindowBytes = 0;
          }
        };

        const getRemainingKnownBytes = () => Math.max(0, totalKnownBytes - totalDownloadedKnownBytes);

        const barPayload = () => ({
          completedFiles: completedFiles + skippedFiles,
          totalFilesCount,
          downloadedStr: formatBytes(totalDownloadedKnownBytes),
          totalStr: totalLabel,
          unknownFilesStr: unknownFilesSuffix,
          speedStr: currentSpeedBps > 0 ? `${formatBytes(Math.round(currentSpeedBps))}/s` : '?',
          etaStr:
            useByteProgress && currentSpeedBps > 0
              ? formatEta(getRemainingKnownBytes() / currentSpeedBps)
              : '?',
        });

        wbDownloader.on('download:start', (file: { url: string; name: string }) => {
          fileDownloaded.set(file.url, 0);
        });

        wbDownloader.on(
          'download:progress',
          (data: { url: string; filename: string; downloaded: number; total: number }) => {
            const prev = fileDownloaded.get(data.url) ?? 0;
            const current = Math.max(prev, data.downloaded);
            fileDownloaded.set(data.url, current);

            const knownSize = knownFileSizes.get(data.url);
            if (knownSize !== undefined) {
              const previousKnownCounted = Math.min(prev, knownSize);
              const currentKnownCounted = Math.min(current, knownSize);
              const delta = Math.max(0, currentKnownCounted - previousKnownCounted);
              totalDownloadedKnownBytes += delta;
              speedWindowBytes += delta;
            }

            refreshSpeed();
            const barValue = useByteProgress ? totalDownloadedKnownBytes : completedFiles + skippedFiles;
            bar.update(barValue, barPayload());
          },
        );

        wbDownloader.on('download:complete', (data: { url: string; filename: string; size: number }) => {
          completedFiles++;
          const prev = fileDownloaded.get(data.url) ?? 0;
          const current = Math.max(prev, data.size);
          fileDownloaded.set(data.url, current);

          const knownSize = knownFileSizes.get(data.url);
          if (knownSize !== undefined) {
            const previousKnownCounted = Math.min(prev, knownSize);
            const currentKnownCounted = Math.min(current, knownSize);
            const delta = Math.max(0, currentKnownCounted - previousKnownCounted);
            totalDownloadedKnownBytes += delta;
            speedWindowBytes += delta;
          }

          refreshSpeed();
          const barValue = useByteProgress ? totalDownloadedKnownBytes : completedFiles + skippedFiles;
          bar.update(barValue, barPayload());
        });

        wbDownloader.on('download:error', (data: { url: string; filename: string; error: string }) => {
          failedFiles++;
          report.failedFiles.push({ name: data.filename, reason: data.error || 'Unknown error' });
          refreshSpeed();
          const barValue = useByteProgress ? totalDownloadedKnownBytes : completedFiles + skippedFiles;
          bar.update(barValue, barPayload());
        });

        wbDownloader.on('download:skip', (data: { url: string; filename: string }) => {
          skippedFiles++;
          const knownSize = knownFileSizes.get(data.url);
          if (knownSize !== undefined) {
            const prev = fileDownloaded.get(data.url) ?? 0;
            const previousKnownCounted = Math.min(prev, knownSize);
            const currentKnownCounted = knownSize;
            const delta = Math.max(0, currentKnownCounted - previousKnownCounted);
            totalDownloadedKnownBytes += delta;
            speedWindowBytes += delta;
            fileDownloaded.set(data.url, Math.max(prev, knownSize));
          }
          refreshSpeed();
          const barValue = useByteProgress ? totalDownloadedKnownBytes : completedFiles + skippedFiles;
          bar.update(barValue, barPayload());
        });

        singleBar.start(progressBarTotal, 0, {
          completedFiles: 0,
          totalFilesCount,
          downloadedStr: '0 B',
          totalStr: totalLabel,
          unknownFilesStr: unknownFilesSuffix,
          speedStr: '?',
          etaStr: '?',
        });

        filesToDownload.sort((a, b) => {
          if (a.size === undefined && b.size === undefined) return 0;
          if (a.size === undefined) return 1;
          if (b.size === undefined) return -1;
          return a.size - b.size;
        });

        await wbDownloader.downloadSelected(filesToDownload);

        singleBar.stop();

        report.filesDownloaded = completedFiles;
        report.filesFailed = failedFiles;
        report.filesSkipped = skippedFiles + skippedOnDisk;

        console.log('\n' + chalk.bold('─'.repeat(55)));
        console.log(chalk.bold.cyan('  DOWNLOAD SUMMARY'));
        console.log(chalk.bold('─'.repeat(55)));
        console.log(`  ${chalk.cyan('Total')}        ${chalk.white(String(filesToDownload.length))}`);
        console.log(`  ${chalk.green('✓ Completed')}   ${chalk.white(String(completedFiles))}`);
        console.log(`  ${chalk.red('✗ Failed')}     ${chalk.white(String(failedFiles))}`);
        console.log(`  ${chalk.gray('  Skipped')}    ${chalk.white(String(skippedFiles))}`);
        if (skippedOnDisk > 0) {
          console.log(`  ${chalk.gray('  On disk')}    ${chalk.white(String(skippedOnDisk))}`);
        }
        console.log(chalk.bold('─'.repeat(55)));
        console.log(chalk.green.bold(`\n✓ All done!\nSummary saved to logs/latest-summary.txt\n`));
      } catch (error) {
        if (singleBar) singleBar.stop();
        spinner.fail('Download failed');
        throw error;
      }
    } catch (error) {
      report.runError = error instanceof Error ? error.message : String(error);
      handleUserFacingError(error, report.logFilePath);
      process.exitCode = 1;
      return;
    } finally {
      if (wbDownloader) {
        await wbDownloader.cleanup();
      }
      report.endedAt = new Date().toISOString();
      try {
        writeRunSummary(report);
      } catch {
        // ignore summary write errors
      }
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      const config = getConfig();

      console.log(chalk.bold.cyan('\n📋 Current Configuration\n'));
      console.log(chalk.gray('─'.repeat(50)));

      const configDisplay = {
        'Base URL': config.baseUrl,
        'Login URL': config.loginUrl,
        'Download Directory': config.downloadDir,
        'Max Concurrent Downloads': config.maxConcurrentDownloads,
        'Download Timeout': `${config.downloadTimeout}ms`,
        'Browser Type': config.browserType,
        'Headless Mode': config.headless,
        'Database Path': config.databasePath,
        'Log Level': config.logLevel,
        'Log File': config.logFile,
        'Include Non-Subject Courses': config.includeNonSubjectCourses,
        'Max Retries': config.maxRetries,
        'Retry Delay': `${config.retryDelay}ms`,
      };

      Object.entries(configDisplay).forEach(([key, value]) => {
        console.log(chalk.white(`${key.padEnd(25)}: ${chalk.cyan(String(value))}`));
      });

      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.yellow('\n💡 Tip: Run "whiteboard-dl setup" to configure settings\n'));
    } catch (error) {
      handleUserFacingError(error, './logs/whiteboard.log');
      process.exitCode = 1;
      return;
    }
  });

function filterAlreadyDownloaded(
  files: DiscoveredFile[],
  fileTree: import('./types').FileTree,
): { files: DiscoveredFile[]; skippedOnDisk: number } {
  const result: DiscoveredFile[] = [];
  let skippedOnDisk = 0;

  for (const file of files) {
    const sanitized = sanitizeFilename(file.name);

    const inTree =
      isFileInTree(fileTree, file.courseName, file.sectionName, file.savePath, file.name) ||
      isFileInTree(fileTree, file.courseName, file.sectionName, file.savePath, sanitized);

    const existsByOriginal = !inTree && fs.existsSync(path.join(file.savePath, file.name));
    const existsBySanitized =
      !inTree && sanitized !== file.name && fs.existsSync(path.join(file.savePath, sanitized));

    if (inTree || existsByOriginal || existsBySanitized) {
      skippedOnDisk++;
    } else {
      result.push(file);
    }
  }

  return { files: result, skippedOnDisk };
}

async function selectCoursesInteractively(courses: Course[]): Promise<Course[]> {
  console.log(chalk.bold.cyan(`📚 Found ${courses.length} course(s) on your account`));
  console.log(
    chalk.gray('   Use ↑↓ to navigate, Space to toggle, a to select/deselect all, Enter to confirm\n'),
  );

  const choices = courses.map(course => ({
    name: course.name,
    value: course,
    checked: true,
  }));

  const answers: any = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedCourses',
      message: `Select courses to scrape (${courses.length} pre-selected):`,
      choices,
      pageSize: 20,
    },
  ]);

  return (answers.selectedCourses as Course[]) || [];
}

async function selectFilesInteractively(files: DiscoveredFile[]): Promise<DiscoveredFile[]> {
  const groups = new Map<string, DiscoveredFile[]>();
  for (const file of files) {
    const key = `${file.courseName} / ${file.sectionName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices: any[] = [];
  const SIZE_LABEL_WIDTH = 9;

  for (const [groupName, groupFiles] of groups) {
    choices.push(new InquirerSeparator(`\n  ── ${groupName} ──`));

    const sortedGroupFiles = [...groupFiles].sort((a, b) => {
      if (a.size === undefined && b.size === undefined) return 0;
      if (a.size === undefined) return 1;
      if (b.size === undefined) return -1;
      return b.size - a.size;
    });

    for (const file of sortedGroupFiles) {
      const typeLabel = (file.fileType || path.extname(file.name).slice(1) || '?').toUpperCase().padEnd(5);
      const sizeLabel =
        file.size !== undefined
          ? formatBytes(file.size).padStart(SIZE_LABEL_WIDTH)
          : '      ?'.padStart(SIZE_LABEL_WIDTH);

      choices.push({
        name: `${typeLabel}  ${sizeLabel}  ${file.name}`,
        value: file,
        checked: true,
      });
    }
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const knownCount = files.filter(f => f.size !== undefined).length;

  console.log(chalk.bold.cyan(`📚 Found ${files.length} files across ${groups.size} sections`));
  if (knownCount > 0) {
    console.log(
      chalk.gray(
        `   Total size (known): ${formatBytes(totalSize)} ` +
          `(${knownCount}/${files.length} sizes known)`,
      ),
    );
  }
  console.log(
    chalk.gray('   Use ↑↓ to navigate, Space to toggle, a to select/deselect all, Enter to confirm\n'),
  );

  const answers: any = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedFiles',
      message: `Select files to download (${files.length} pre-selected):`,
      choices,
      pageSize: 20,
    },
  ]);

  return (answers.selectedFiles as DiscoveredFile[]) || [];
}

program.parse();
