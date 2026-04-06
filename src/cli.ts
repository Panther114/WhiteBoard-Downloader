#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { WhiteboardDownloader } from './index';
import { getConfig } from './config';
import { Config } from './types';

const program = new Command();

program
  .name('whiteboard-dl')
  .description('Modern automation tool to download course materials from SHSID Blackboard China')
  .version('2.0.0');

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
            validate: (input) => input.length > 0 || 'Username is required',
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            when: !password,
            mask: '*',
            validate: (input) => input.length > 0 || 'Password is required',
          },
        ]);

        username = username || answers.username;
        password = password || answers.password;
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
      const downloader = new WhiteboardDownloader(config);

      try {
        // Initialize
        spinner.text = 'Launching browser and logging in...';
        await downloader.initialize();
        spinner.succeed('Logged in successfully');

        // Download all
        spinner.start('Downloading course materials...');
        await downloader.downloadAll();
        spinner.succeed('Download complete!');

        console.log(chalk.green.bold('\n✓ All done!\n'));
      } catch (error: any) {
        spinner.fail('Download failed');
        console.error(chalk.red(`\nError: ${error.message}\n`));
        process.exit(1);
      } finally {
        await downloader.cleanup();
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
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
        'Max Retries': config.maxRetries,
        'Retry Delay': `${config.retryDelay}ms`,
      };

      Object.entries(configDisplay).forEach(([key, value]) => {
        console.log(chalk.white(`${key.padEnd(25)}: ${chalk.cyan(value)}`));
      });

      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.yellow('\n💡 Tip: Create a .env file to customize settings\n'));
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();
