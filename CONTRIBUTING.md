# Contributing to Whiteboard Downloader

Thank you for considering contributing to Whiteboard Downloader! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue on GitHub with:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Your environment (OS, Node.js version, etc.)
- Relevant logs from `logs/whiteboard.log`

### Suggesting Enhancements

Enhancement suggestions are welcome! Please open an issue with:
- A clear description of the feature
- Why it would be useful
- Possible implementation approach (optional)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure code follows the existing style
5. Run linter: `npm run lint`
6. Run formatter: `npm run format`
7. Test your changes thoroughly
8. Commit with a clear message
9. Push to your fork
10. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add comments for complex logic
- Keep functions focused and small
- Use meaningful variable names

### Commit Messages

Follow conventional commits format:
```
feat: add email notifications
fix: resolve timeout issue in large downloads
docs: update installation instructions
refactor: simplify downloader logic
test: add unit tests for scraper
chore: update dependencies
```

### Testing

Before submitting a PR:
- Test with real Blackboard login (if possible)
- Test with headless and non-headless modes
- Verify no breaking changes to existing functionality
- Check for TypeScript errors: `npm run build`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/WhiteBoard-Downloader.git
cd WhiteBoard-Downloader

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your test credentials

# Run in dev mode
npm run dev

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## Areas Needing Help

- **Testing**: Test on different operating systems
- **Selectors**: Verify CSS selectors work after Blackboard updates
- **Performance**: Profile and optimize download speeds
- **Documentation**: Improve guides and examples
- **Features**: Implement items from TODO list
- **Internationalization**: Add support for multiple languages
- **Error Handling**: Improve error messages and recovery

## Questions?

Feel free to open a discussion on GitHub or contact the maintainers.

## Code of Conduct

Be respectful and constructive in all interactions. We're all here to learn and improve the project together.
