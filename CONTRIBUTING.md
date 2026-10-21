# Contributing to Prism

Thank you for your interest in contributing to Prism! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Questions](#questions)

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. We expect all contributors to follow it.

## Getting Started

### Prerequisites

- **Rust** (latest stable) — [Install Rust](https://rustup.rs/)
- **Node.js** (v18+) — [Install Node.js](https://nodejs.org/)
- **pnpm** — [Install pnpm](https://pnpm.io/)
- **SQLite** — Usually pre-installed
- **ffmpeg** (optional) — For video features

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/prism.git
   cd prism
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/originalusername/prism.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
# Frontend
cd frontend
pnpm install
cd ..

# Backend (optional, for building)
cd backend_rust
cargo build
cd ..
```

### 2. Start Development Server

```bash
# Web mode (recommended for most development)
./run-web.sh

# Desktop mode (for Tauri-specific features)
./run-desktop.sh
```

### 3. Verify Setup

- Frontend: http://localhost:3005
- Backend: http://localhost:8269/health

## How to Contribute

### Types of Contributions

- **Bug Fixes** — Fix issues in existing functionality
- **Features** — Add new features or enhance existing ones
- **Documentation** — Improve docs, add examples, fix typos
- **Tests** — Add or improve test coverage
- **Refactoring** — Improve code quality without changing functionality
- **Performance** — Optimize speed or resource usage

### Finding Issues

- Check [GitHub Issues](https://github.com/yourusername/prism/issues) for open tasks
- Look for `good first issue` label for beginner-friendly tasks
- Look for `help wanted` label for tasks needing assistance

### Creating Issues

Before creating a new issue:
1. Search existing issues to avoid duplicates
2. Use the appropriate issue template
3. Provide as much detail as possible

## Coding Standards

### TypeScript/Frontend

- **Strict TypeScript** — Enable strict mode, use explicit types
- **ESLint** — Follow the project's ESLint configuration
- **Prettier** — Format code with Prettier
- **Component Structure** — Use functional components with hooks
- **State Management** — Use Zustand stores for shared state
- **Styling** — Use Tailwind CSS utility classes

```typescript
// Good
interface PhotoProps {
  photo: Photo;
  onSelect: (id: string) => void;
}

const PhotoItem: React.FC<PhotoProps> = ({ photo, onSelect }) => {
  return (
    <div onClick={() => onSelect(photo.id)}>
      {/* ... */}
    </div>
  );
};
```

### Rust/Backend

- **Clippy** — No clippy warnings
- **Formatting** — Use `cargo fmt`
- **Error Handling** — Use `Result<T, E>` with proper error types
- **Documentation** — Add doc comments for public items
- **Tests** — Add tests for new functionality

```rust
/// Get a photo by ID
///
/// # Arguments
/// * `id` - The photo ID
///
/// # Returns
/// The photo if found, or an error
async fn get_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Photo>, StatusCode> {
    // ...
}
```

### General

- **No Magic Numbers** — Use named constants
- **Meaningful Names** — Variables and functions should be descriptive
- **DRY** — Don't Repeat Yourself (but don't over-abstract)
- **YAGNI** — You Aren't Gonna Need It (avoid premature optimization)

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat** — New feature
- **fix** — Bug fix
- **docs** — Documentation changes
- **style** — Code style changes (formatting, etc.)
- **refactor** — Code refactoring
- **perf** — Performance improvements
- **test** — Adding or updating tests
- **chore** — Maintenance tasks

### Scopes

- **frontend** — Frontend changes
- **backend** — Backend changes
- **cli** — CLI changes
- **ai** — AI/ML features
- **nle** — Video editor
- **ui** — UI components
- **api** — API changes
- **db** — Database changes

### Examples

```
feat(photos): add batch delete functionality

- Add bulk delete endpoint
- Add confirmation dialog
- Update UI with delete button

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>
```

```
fix(backend): resolve race condition in thumbnail generation

- Add mutex lock for concurrent access
- Add retry logic for failed generations

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>
```

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow coding standards
- Add tests if applicable
- Update documentation if needed

### 3. Test Your Changes

```bash
# Frontend
cd frontend
pnpm test
pnpm lint
pnpm tsc

# Backend
cd backend_rust
cargo test
cargo clippy
cargo fmt --check
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat(scope): your commit message"
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the original repository
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template
5. Submit the PR

### PR Requirements

- [ ] Code follows project conventions
- [ ] Tests pass
- [ ] No linting errors
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow guidelines
- [ ] PR description is clear and complete

### PR Review Process

1. Maintainers will review your PR
2. They may request changes
3. Address feedback and push updates
4. Once approved, your PR will be merged

## Reporting Bugs

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- Browser: [e.g., Chrome 120, Firefox 121]
- Prism Version: [e.g., 0.1.0]

**Additional context**
Any other context about the problem.
```

## Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem. Ex. "I'm always frustrated when..."

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Additional context**
Any other context, mockups, or screenshots about the feature request.
```

## Questions

### Where to Ask

- **GitHub Discussions** — For general questions and discussions
- **GitHub Issues** — For bug reports and feature requests
- **Discord** (if available) — For real-time chat

### How to Ask

- Search existing discussions/issues first
- Be specific and provide context
- Include relevant code snippets
- Mention what you've already tried

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (if applicable)

Thank you for contributing to Prism! 🎉
