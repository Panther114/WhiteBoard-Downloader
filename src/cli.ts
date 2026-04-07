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
import { Config } from './types';
import { formatBytes } from './utils/helpers';

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
      const examplePath = path.resolve('.env.example');

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
        {
          type: 'confirm',
          name: 'installBrowsers',
          message: 'Install Playwright browsers now? (required for first-time setup)',
          default: true,
        },
      ]);

      // Write .env
      writeEnvFile(envPath, {
        BB_USERNAME: answers.username.trim(),
        BB_PASSWORD: answers.password,
        DOWNLOAD_DIR: answers.downloadDir,
      });

      console.log(chalk.green(`\n✓ Credentials saved to ${envPath}`));

      // Install Playwright browsers if requested
      if (answers.installBrowsers) {
        const browserSpinner = ora('Installing Playwright browsers...').start();
        try {
          execSync('npx playwright install chromium', { stdio: 'pipe' });
          browserSpinner.succeed('Playwright browsers installed');
        } catch {
          browserSpinner.warn('Browser installation failed — run: npx playwright install chromium');
        }
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
  .description('Download all course materials')
  .option('-u, --username <username>', 'Blackboard username (G-Number)')
  .option('-p, --password <password>', 'Blackboard password')
  .option('-d, --dir <directory>', 'Download directory', './downloads')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--filter <pattern>', 'Course filter regex pattern')
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

        // Offer to persist credentials in .env so the user only enters them once
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

      // Load configuration with overrides
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

      // Create downloader instance
      const wbDownloader = new WhiteboardDownloader(config);

      // -----------------------------------------------------------------------
      // Progress GUI — multi-bar display for active downloads
      // -----------------------------------------------------------------------
      const multibar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          autopadding: true,
          format:
            ' {bar} {percentage}% | {filename} | {downloadedStr} / {totalStr}',
        },
        cliProgress.Presets.shades_classic
      );

      // Track per-file progress bars
      const bars = new Map<string, cliProgress.SingleBar>();
      let totalFiles = 0;
      let completedFiles = 0;
      let failedFiles = 0;
      let skippedFiles = 0;

      wbDownloader.on('download:start', (file: { url: string; name: string }) => {
        totalFiles++;
        const bar = multibar.create(100, 0, {
          filename: truncate(file.name, 35),
          downloadedStr: '...',
          totalStr: '?',
        });
        bars.set(file.url, bar);
      });

      wbDownloader.on(
        'download:progress',
        (data: { url: string; filename: string; downloaded: number; total: number }) => {
          const bar = bars.get(data.url);
          if (!bar) return;
          if (data.total > 0) {
            const pct = Math.min(Math.round((data.downloaded / data.total) * 100), 100);
            bar.update(pct, {
              filename: truncate(data.filename, 35),
              downloadedStr: formatBytes(data.downloaded),
              totalStr: formatBytes(data.total),
            });
          } else {
            bar.update(50, {
              filename: truncate(data.filename, 35),
              downloadedStr: formatBytes(data.downloaded),
              totalStr: '?',
            });
          }
        }
      );

      wbDownloader.on(
        'download:complete',
        (data: { url: string; filename: string; size: number }) => {
          completedFiles++;
          const bar = bars.get(data.url);
          if (bar) {
            bar.update(100, {
              filename: truncate(data.filename, 35),
              downloadedStr: formatBytes(data.size),
              totalStr: formatBytes(data.size),
            });
            bar.stop();
            bars.delete(data.url);
          }
        }
      );

      wbDownloader.on(
        'download:error',
        (data: { url: string; filename: string; error: string }) => {
          failedFiles++;
          const bar = bars.get(data.url);
          if (bar) {
            bar.stop();
            bars.delete(data.url);
          }
        }
      );

      wbDownloader.on('download:skip', (_data: { url: string; filename: string }) => {
        skippedFiles++;
      });

      // -----------------------------------------------------------------------

      try {
        // Initialize (browser + login)
        spinner.text = 'Launching browser and logging in...';
        await wbDownloader.initialize();
        spinner.succeed('Logged in successfully');

        // Download all — spinner gives way to progress bars
        spinner.start('Scanning courses...');
        spinner.stop();
        console.log(chalk.cyan('\n📥 Downloading course materials...\n'));

        await wbDownloader.downloadAll();

        multibar.stop();

        // Summary
        console.log('\n' + chalk.bold('─'.repeat(55)));
        console.log(chalk.bold.cyan('  DOWNLOAD SUMMARY'));
        console.log(chalk.bold('─'.repeat(55)));
        console.log(`  ${chalk.cyan('Total')}        ${chalk.white(String(totalFiles))}`);
        console.log(`  ${chalk.green('✓ Completed')}   ${chalk.white(String(completedFiles))}`);
        console.log(`  ${chalk.red('✗ Failed')}     ${chalk.white(String(failedFiles))}`);
        console.log(`  ${chalk.gray('  Skipped')}    ${chalk.white(String(skippedFiles))}`);
        console.log(chalk.bold('─'.repeat(55)));
        console.log(chalk.green.bold('\n✓ All done!\n'));
      } catch (error: any) {
        multibar.stop();
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
// Helpers
// ---------------------------------------------------------------------------
function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length <= maxLen ? str.padEnd(maxLen) : str.substring(0, maxLen - 1) + '>';
}

program.parse();
