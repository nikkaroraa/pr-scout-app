# PR Scout 🔍

AI-powered PR review menubar app for Mac. Review PRs smarter, not harder.

![PR Scout](https://img.shields.io/badge/platform-macOS-blue) ![Electron](https://img.shields.io/badge/electron-28.x-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

- **Menubar App** - Click to open, stays out of your way
- **AI Summary** - Get a quick overview of what the PR does
- **Feature-Based Grouping** - Files grouped by purpose, not alphabetically
- **Interactive Walkthrough** - Click through changes with AI explanations
- **Quiz Mode** - Test your understanding before approving
- **GitHub Integration** - Approve or request changes directly

## Screenshots

```
┌────────────────────────────────────┐
│ 🔍 PR Scout                     ✕  │
├────────────────────────────────────┤
│                                    │
│  📋 Add user authentication        │
│  by @developer                     │
│  +142 -23  8 files  3 commits      │
│                                    │
│  🤖 AI Summary                     │
│  This PR adds OAuth-based auth...  │
│                                    │
│  [View Changes by Feature →]       │
│                                    │
└────────────────────────────────────┘
```

## Requirements

- **macOS** 10.15 or later
- **GitHub CLI** (`gh`) installed and authenticated
- **AI CLI** - Either `claude` or `llm` command available

### Install Dependencies

```bash
# Install GitHub CLI
brew install gh
gh auth login

# Install Claude CLI (recommended)
# Or use llm: pip install llm
```

## Installation

### Option 1: Download DMG (Recommended)

Download the latest release from [Releases](https://github.com/nikkaroraa/pr-scout-app/releases).

### Option 2: Build from Source

```bash
# Clone the repo
git clone https://github.com/nikkaroraa/pr-scout-app.git
cd pr-scout-app

# Install dependencies
npm install

# Build CSS
npm run build:css

# Run in development
npm run dev

# Build distributable
npm run build
```

## Usage

1. **Launch** - Click the 🔍 icon in your menubar
2. **Paste PR** - Enter a PR URL or number
3. **Review Summary** - Read the AI-generated overview
4. **Explore Features** - Click through feature groups
5. **Take Quiz** - Answer questions to verify understanding
6. **Submit Review** - Approve or request changes

### Supported PR Formats

```
# Full URL
https://github.com/owner/repo/pull/123

# PR number (when in a git repo)
123
```

## Architecture

```
pr-scout-app/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.js    # Menubar setup, IPC handlers, AI calls
│   └── renderer/       # Frontend
│       ├── index.html  # Main HTML
│       ├── app.js      # UI logic, state management
│       └── styles/     # Tailwind CSS
├── assets/             # Icons
└── package.json
```

## Development

```bash
# Watch CSS changes
npm run watch:css

# Run with DevTools
npm run dev
```

## Building

```bash
# Build DMG for distribution
npm run build:dmg

# Build .app only
npm run build:app

# Output in dist/
```

## How It Works

1. **Fetch** - Uses `gh` CLI to fetch PR details and diff
2. **Analyze** - AI analyzes changes and groups files by feature
3. **Summarize** - Shows a brief summary of PR intent
4. **Walkthrough** - Takes you through each feature group
5. **Quiz** - Generates questions to verify understanding
6. **Review** - Submits approval or change requests via `gh`

## Configuration

The app uses your system's `gh` CLI configuration. Make sure you're authenticated:

```bash
gh auth status
```

## Troubleshooting

### "GitHub CLI not authenticated"

Run `gh auth login` and follow the prompts.

### "AI analysis unavailable"

Make sure you have either:
- `claude` CLI installed and configured
- `llm` CLI installed with a model configured

### App doesn't appear in menubar

- Check if the app is running (Activity Monitor)
- Try restarting the app
- Make sure you're on macOS 10.15+

## License

MIT © [nikkaroraa](https://github.com/nikkaroraa)

## Credits

Based on [pr-scout CLI](https://github.com/nikkaroraa/pr-scout).
