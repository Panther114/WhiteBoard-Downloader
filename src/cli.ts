#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import cliProgress from 'cli-progress';
import { WhiteboardDownloader } from './index';
import { getConfig } from './config';
import { Config, Course, DiscoveredFile } from './types';
import { formatBytes, sanitizeFilename } from './utils/helpers';

// Separator is available at runtime in inquirer v8 as a property on the module.
// @types/inquirer@9 ships types for inquirer@9 while the runtime is inquirer@8,
// so there is an unavoidable version mismatch.  We bridge it with a minimal cast
// that preserves the constructor signature we actually use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InquirerSeparator: new (line?: string) => unknown = (inquirer as any).Separator;

const program = new Command();

program
  .name('whiteboard-dl')
  .description('Modern automation tool to download course materials from SHSID Blackboard China')
  .version('2.0.0');

// ---------------------------------------------------------------------------
// Helper: write or update key=value pairs in a .env file.
// - If the file already exists, existing keys are updated in-place.
// - If the file does not exist but .env.example does, the example is used as
//   a template (placeholder values will be replaced).
// - New keys not present in the file are appended at the end.
// ---------------------------------------------------------------------------
function writeEnvFile(envPath: string, values: Record<string, string>): void {
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  } else if (fs.existsSync(envPath + '.example')) {
    content = fs.readFileSync(envPath + '.example', 'utf-8');
  }

  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  }

  fs.writeFileSync(envPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// setup command — first-time configuration wizard
// ---------------------------------------------------------------------------
program
  .command('setup')
  .description('First-time setup: configure credentials and install Playwright browsers')
  .action(async () => {
    try {
      console.log(chalk.bold.cyan('\n🛠️  Whiteboard Downloader — Setup Wizard\n'));
      console.log(chalk.gray('This wizard will create a .env file with your settings.\n'));

      const envPath = path.resolve('.env');

      // Load existing .env values for defaults
      let existingUsername = '';
      let existingDownloadDir = './downloads';
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf-8');
        const userMatch = raw.match(/^BB_USERNAME=(.+)$/m);
        const dirMatch = raw.match(/^DOWNLOAD_DIR=(.+)$/m);
        if (userMatch) existingUsername = userMatch[1].trim();
        if (dirMatch) existingDownloadDir = dirMatch[1].trim();
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Blackboard G-Number (username):',
          default: existingUsername || undefined,
          validate: (v: string) => v.trim().length > 0 || 'Username is required',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Blackboard password:',
          mask: '*',
          validate: (v: string) => v.length > 0 || 'Password is required',
        },
        {
          type: 'input',
          name: 'downloadDir',
          message: 'Download directory:',
          default: existingDownloadDir,
        },
      ]);

      // Write .env
      writeEnvFile(envPath, {
        BB_USERNAME: answers.username.trim(),
        BB_PASSWORD: answers.password,
        DOWNLOAD_DIR: answers.downloadDir,
      });

      console.log(chalk.green(`\n✓ Credentials saved to ${envPath}`));

      // Always install Playwright browsers during setup
      const browserSpinner = ora('Installing Playwright browsers...').start();
      try {
        execSync('npx playwright install chromium', { stdio: 'pipe' });
        browserSpinner.succeed('Playwright browsers installed');
      } catch {
        browserSpinner.warn('Browser installation failed — run: npx playwright install chromium');
      }

      console.log(chalk.bold.green('\n✅ Setup complete!\n'));
      console.log(chalk.white('You can now run:'));
      console.log(chalk.cyan('  npm start download'));
      console.log(chalk.gray('  (or double-click start.bat / start.sh)\n'));
    } catch (error: any) {
      console.error(chalk.red(`\nSetup error: ${error.message}\n`));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// download command
// ---------------------------------------------------------------------------
program
  .command('download')
  .description('Discover course materials, select files interactively, then download')
  .option('-u, --username <username>', 'Blackboard username (G-Number)')
  .option('-p, --password <password>', 'Blackboard password')
  .option('-d, --dir <directory>', 'Download directory', './downloads')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--filter <pattern>', 'Course filter regex pattern')
  .option('--all', 'Skip the selection GUI and download everything')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('\n🎓 Whiteboard Downloader v2.0\n'));

      // Get credentials if not provided
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

        // Offer to persist credentials
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
          writeEnvFile(envPath, { BB_USERNAME: username, BB_PASSWORD: password });
          console.log(chalk.green(`\n✓ Credentials saved to ${envPath}\n`));
        }
      }

      // Load configuration
      const config: Config = getConfig({
        username,
        password,
        downloadDir: options.dir,
        headless: options.headless === 'true',
        courseFilter: options.filter,
      });

      console.log(chalk.gray(`\nDownload directory: ${config.downloadDir}`));
      console.log(chalk.gray(`Browser mode: ${config.headless ? 'headless' : 'visible'}`));
      if (config.courseFilter) {
        console.log(chalk.gray(`Course filter: ${config.courseFilter}`));
      }
      console.log();

      const spinner = ora('Initializing...').start();

      const wbDownloader = new WhiteboardDownloader(config);

      // State for aggregate progress bar (initialised after file selection)
      let singleBar: cliProgress.SingleBar | null = null;
      let completedFiles = 0;
      let failedFiles = 0;
      let skippedFiles = 0;

      // -----------------------------------------------------------------------

      try {
        // Phase 1: Initialize (browser + login)
        spinner.text = 'Launching browser and logging in...';
        await wbDownloader.initialize();
        spinner.succeed('Logged in successfully');

        // Phase 2: Fetch course list
        spinner.start('Fetching course list...');
        const allCourses = await wbDownloader.getCourses();
        spinner.stop();

        if (allCourses.length === 0) {
          console.log(chalk.yellow('\nNo courses found.\n'));
          return;
        }

        let selectedCourses: Course[];

        if (options.all) {
          // --all flag: skip both GUIs, process every course
          selectedCourses = allCourses;
          console.log(chalk.cyan(`\n📚 Processing all ${allCourses.length} courses...\n`));
        } else {
          // Phase 3: Course selection GUI
          console.log();
          selectedCourses = await selectCoursesInteractively(allCourses);

          if (selectedCourses.length === 0) {
            console.log(chalk.yellow('\nNo courses selected. Exiting.\n'));
            return;
          }

          console.log(
            chalk.cyan(`\n📚 Scanning ${selectedCourses.length} selected course(s)...\n`)
          );
        }

        // Phase 4: Discover all files in selected courses
        spinner.start('Scanning selected course materials...');
        const discoveredFiles = await wbDownloader.discoverAllFiles(selectedCourses);
        spinner.stop();

        if (discoveredFiles.length === 0) {
          console.log(chalk.yellow('\nNo downloadable files found.\n'));
          return;
        }

        // Phase 5: Fetch file sizes via HEAD requests
        spinner.start(`Fetching metadata for ${discoveredFiles.length} files...`);
        const enrichedFiles = await wbDownloader.fetchFileMetadata(discoveredFiles);
        const withSize = enrichedFiles.filter(f => f.size !== undefined).length;
        spinner.succeed(
          `Metadata fetched (${withSize} of ${enrichedFiles.length} files have known size)`
        );

        // Phase 5.5: Filter files already present on disk (duplicate prevention)
        const { files: undownloadedFiles, skippedOnDisk } = filterAlreadyDownloaded(enrichedFiles);
        if (skippedOnDisk > 0) {
          console.log(
            chalk.gray(`   ↳ Skipped ${skippedOnDisk} file(s) already present in downloads folder`)
          );
        }

        if (undownloadedFiles.length === 0) {
          console.log(chalk.green('\n✓ All files are already downloaded.\n'));
          return;
        }

        let filesToDownload: DiscoveredFile[];

        if (options.all) {
          // --all flag: skip file selection GUI, download everything not already on disk
          filesToDownload = undownloadedFiles;
          console.log(
            chalk.cyan(`\n📥 Downloading all ${filesToDownload.length} files...\n`)
          );
        } else {
          // Phase 6: GUI file selection
          console.log();
          filesToDownload = await selectFilesInteractively(undownloadedFiles);

          if (filesToDownload.length === 0) {
            console.log(chalk.yellow('\nNo files selected. Exiting.\n'));
            return;
          }

          console.log(
            chalk.cyan(`\n📥 Downloading ${filesToDownload.length} selected files...\n`)
          );
        }

        // -----------------------------------------------------------------------
        // Set up single aggregate progress bar
        // -----------------------------------------------------------------------
        const totalExpectedBytes = filesToDownload.reduce((sum, f) => sum + (f.size ?? 0), 0);
        const barTotal = filesToDownload.length;
        const totalBytesLabel = totalExpectedBytes > 0 ? formatBytes(totalExpectedBytes) : '?';

        singleBar = new cliProgress.SingleBar(
          {
            clearOnComplete: false,
            hideCursor: true,
            format:
              ' {bar} {percentage}% | {completedFiles}/{totalFilesCount} files | {downloadedStr}/{totalStr} | {speedStr} | ETA {eta_formatted}',
          },
          cliProgress.Presets.shades_classic
        );

        const bar = singleBar;
        const fileDownloaded = new Map<string, number>();
        let totalDownloadedBytes = 0;
        let speedWindowStart = Date.now();
        let speedWindowBytes = 0;
        let currentSpeedBps = 0;

        const barPayload = () => ({
          completedFiles: completedFiles + skippedFiles,
          totalFilesCount: barTotal,
          downloadedStr: formatBytes(totalDownloadedBytes),
          totalStr: totalBytesLabel,
          speedStr: currentSpeedBps > 0 ? `${formatBytes(Math.round(currentSpeedBps))}/s` : '...',
        });

        wbDownloader.on('download:start', (file: { url: string; name: string }) => {
          fileDownloaded.set(file.url, 0);
        });

        wbDownloader.on(
          'download:progress',
          (data: { url: string; filename: string; downloaded: number; total: number }) => {
            const prev = fileDownloaded.get(data.url) ?? 0;
            const delta = Math.max(0, data.downloaded - prev);
            fileDownloaded.set(data.url, data.downloaded);
            totalDownloadedBytes += delta;
            speedWindowBytes += delta;

            const now = Date.now();
            const elapsed = now - speedWindowStart;
            if (elapsed >= 1000) {
              currentSpeedBps = speedWindowBytes / (elapsed / 1000);
              speedWindowStart = now;
              speedWindowBytes = 0;
            }

            bar.update(completedFiles + skippedFiles, barPayload());
          }
        );

        wbDownloader.on(
          'download:complete',
          (data: { url: string; filename: string; size: number }) => {
            completedFiles++;
            const prev = fileDownloaded.get(data.url) ?? 0;
            const delta = Math.max(0, data.size - prev);
            totalDownloadedBytes += delta;
            fileDownloaded.set(data.url, data.size);
            bar.update(completedFiles + skippedFiles, barPayload());
          }
        );

        wbDownloader.on(
          'download:error',
          (_data: { url: string; filename: string; error: string }) => {
            failedFiles++;
            bar.update(completedFiles + skippedFiles, barPayload());
          }
        );

        wbDownloader.on('download:skip', (_data: { url: string; filename: string }) => {
          skippedFiles++;
          bar.update(completedFiles + skippedFiles, barPayload());
        });

        singleBar.start(barTotal, 0, {
          completedFiles: 0,
          totalFilesCount: barTotal,
          downloadedStr: '0 B',
          totalStr: totalBytesLabel,
          speedStr: '...',
        });

        // -----------------------------------------------------------------------

        // Phase 7: Sort by size (small files first) so quick downloads
        // complete immediately while large files run in parallel.
        filesToDownload.sort((a, b) => {
          if (a.size === undefined && b.size === undefined) return 0;
          if (a.size === undefined) return 1;
          if (b.size === undefined) return -1;
          return a.size - b.size;
        });

        // Phase 8: Download selected files
        await wbDownloader.downloadSelected(filesToDownload);

        singleBar.stop();

        // Summary
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
        console.log(chalk.green.bold('\n✓ All done!\n'));
      } catch (error: any) {
        if (singleBar) singleBar.stop();
        spinner.fail('Download failed');
        console.error(chalk.red(`\nError: ${error.message}\n`));
        process.exit(1);
      } finally {
        await wbDownloader.cleanup();
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// config command — show current configuration
// ---------------------------------------------------------------------------
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
        'Max Retries': config.maxRetries,
        'Retry Delay': `${config.retryDelay}ms`,
      };

      Object.entries(configDisplay).forEach(([key, value]) => {
        console.log(chalk.white(`${key.padEnd(25)}: ${chalk.cyan(value)}`));
      });

      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.yellow('\n💡 Tip: Run "whiteboard-dl setup" to configure settings\n'));
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// Filesystem duplicate filter
// ---------------------------------------------------------------------------

/**
 * Remove files whose sanitized name already exists in the target directory on
 * disk.  This keeps the TUI clean by only showing files that still need to be
 * downloaded.
 *
 * Note: the check compares within `file.savePath` (the full local directory
 * including course/section path), so two different Blackboard files with the
 * same display name in different courses are handled correctly — they live in
 * separate directories and won't shadow each other.
 */
function filterAlreadyDownloaded(
  files: DiscoveredFile[]
): { files: DiscoveredFile[]; skippedOnDisk: number } {
  const result: DiscoveredFile[] = [];
  let skippedOnDisk = 0;

  for (const file of files) {
    const sanitized = sanitizeFilename(file.name);
    const existsByOriginal = fs.existsSync(path.join(file.savePath, file.name));
    const existsBySanitized =
      sanitized !== file.name && fs.existsSync(path.join(file.savePath, sanitized));

    if (existsByOriginal || existsBySanitized) {
      skippedOnDisk++;
    } else {
      result.push(file);
    }
  }

  return { files: result, skippedOnDisk };
}

// ---------------------------------------------------------------------------
// Interactive course selection GUI
// ---------------------------------------------------------------------------

/**
 * Display an inquirer checkbox list of available courses.
 * All courses are pre-selected; the user can uncheck courses they don't want
 * to scrape.  Returns only the courses the user kept checked.
 */
async function selectCoursesInteractively(courses: Course[]): Promise<Course[]> {
  console.log(chalk.bold.cyan(`📚 Found ${courses.length} course(s) on your account`));
  console.log(
    chalk.gray(
      '   Use ↑↓ to navigate, Space to toggle, a to select/deselect all, Enter to confirm\n'
    )
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

// ---------------------------------------------------------------------------
// Interactive file selection GUI
// ---------------------------------------------------------------------------

/**
 * Display an inquirer checkbox list grouped by course/section.
 * All files are pre-selected; the user can uncheck what they don't want.
 * Returns only the files the user kept checked.
 */
async function selectFilesInteractively(files: DiscoveredFile[]): Promise<DiscoveredFile[]> {
  // Group files by "CourseName / SectionName"
  const groups = new Map<string, DiscoveredFile[]>();
  for (const file of files) {
    const key = `${file.courseName} / ${file.sectionName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  // Build choices array with Separator headers for each group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices: any[] = [];

  /** Column width for the size label (e.g. "10.23 MB") — wide enough for GB values. */
  const SIZE_LABEL_WIDTH = 9;

  for (const [groupName, groupFiles] of groups) {
    choices.push(new InquirerSeparator(`\n  ── ${groupName} ──`));

    // Sort largest first within each group so users can easily spot big files
    const sortedGroupFiles = [...groupFiles].sort((a, b) => {
      if (a.size === undefined && b.size === undefined) return 0;
      if (a.size === undefined) return 1;
      if (b.size === undefined) return -1;
      return b.size - a.size;
    });

    for (const file of sortedGroupFiles) {
      const typeLabel = (
        file.fileType ||
        path.extname(file.name).slice(1) ||
        '?'
      )
        .toUpperCase()
        .padEnd(5);
      const sizeLabel = file.size !== undefined ? formatBytes(file.size).padStart(SIZE_LABEL_WIDTH) : '      ?'.padStart(SIZE_LABEL_WIDTH);

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
          `(${knownCount}/${files.length} sizes known)`
      )
    );
  }
  console.log(
    chalk.gray(
      '   Use ↑↓ to navigate, Space to toggle, a to select/deselect all, Enter to confirm\n'
    )
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
