const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const { menubar } = require('menubar');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Disable hardware acceleration for better menubar performance
app.disableHardwareAcceleration();

// ============================================================================
// Menubar Setup
// ============================================================================

const iconPath = path.join(__dirname, '../../assets/iconTemplate.png');

const mb = menubar({
  index: `file://${path.join(__dirname, '../renderer/index.html')}`,
  icon: iconPath,
  preloadWindow: true,
  browserWindow: {
    width: 420,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    skipTaskbar: true,
    alwaysOnTop: true,
  },
  showDockIcon: false,
});

mb.on('ready', () => {
  console.log('PR Scout is ready');
});

mb.on('after-create-window', () => {
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mb.window.webContents.openDevTools({ mode: 'detach' });
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8', 
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
      ...options 
    }).trim();
  } catch (err) {
    if (options.ignoreError) return '';
    throw err;
  }
}

function callAI(systemPrompt, userPrompt) {
  const tmpDir = os.tmpdir();
  const promptFile = path.join(tmpDir, `pr-scout-prompt-${Date.now()}.txt`);
  
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  fs.writeFileSync(promptFile, fullPrompt);
  
  try {
    const result = exec(`cat "${promptFile}" | claude --print 2>/dev/null || cat "${promptFile}" | llm 2>/dev/null || echo "AI_ERROR"`, {
      maxBuffer: 50 * 1024 * 1024
    });
    
    if (result === 'AI_ERROR' || !result) {
      return 'AI analysis unavailable. Please ensure claude CLI or llm is installed.';
    }
    
    return result;
  } finally {
    try { fs.unlinkSync(promptFile); } catch {}
  }
}

// ============================================================================
// GitHub API Functions
// ============================================================================

function parsePRUrl(input) {
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: urlMatch[3] };
  }
  
  if (/^\d+$/.test(input)) {
    try {
      const remote = exec('gh repo view --json nameWithOwner -q .nameWithOwner');
      const [owner, repo] = remote.split('/');
      return { owner, repo, number: input };
    } catch {
      throw new Error('Could not determine repo. Please provide full PR URL.');
    }
  }
  
  throw new Error('Invalid PR URL or number');
}

function fetchPRDetails(owner, repo, number) {
  const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        pullRequest(number: ${number}) {
          title
          body
          author { login }
          state
          additions
          deletions
          changedFiles
          baseRefName
          headRefName
          commits { totalCount }
          url
        }
      }
    }
  `;
  
  const result = exec(`gh api graphql -f query='${query.replace(/\n/g, ' ')}'`);
  const data = JSON.parse(result);
  return data.data.repository.pullRequest;
}

function fetchPRDiff(owner, repo, number) {
  return exec(`gh pr diff ${number} --repo ${owner}/${repo}`);
}

function fetchPRFiles(owner, repo, number) {
  const result = exec(`gh pr view ${number} --repo ${owner}/${repo} --json files -q '.files[].path'`);
  return result.split('\n').filter(Boolean);
}

// ============================================================================
// AI Analysis Functions
// ============================================================================

function generateSummary(prDetails, diff) {
  const systemPrompt = `You are a code review assistant. Analyze this PR and provide:
1. A 2-3 sentence summary of what this PR does
2. The main purpose/intent
3. Any notable patterns or concerns

Be concise and direct. No fluff. Format as plain text, not markdown.`;

  const userPrompt = `PR Title: ${prDetails.title}

PR Description:
${prDetails.body || '(no description)'}

Author: @${prDetails.author.login}
Changes: +${prDetails.additions} -${prDetails.deletions} across ${prDetails.changedFiles} files
Branch: ${prDetails.headRefName} → ${prDetails.baseRefName}

Diff (first 10000 chars):
${diff.slice(0, 10000)}`;

  return callAI(systemPrompt, userPrompt);
}

function groupFilesByFeature(files, diff, prDetails) {
  const systemPrompt = `You are a code review assistant. Group these files by FEATURE or PURPOSE, not by file type or directory.

Output ONLY valid JSON in this exact format:
{
  "groups": [
    {
      "name": "Feature Name",
      "emoji": "🔧",
      "description": "Brief description of this group",
      "files": ["file1.js", "file2.js"]
    }
  ]
}

Rules:
- Group files that work together for a single feature
- Use descriptive names like "User Authentication" not "Auth Files"
- Include an appropriate emoji for each group
- Every file must be in exactly one group
- Max 5-7 groups, combine smaller ones`;

  const userPrompt = `PR Title: ${prDetails.title}

Files to group:
${files.join('\n')}

Diff context (first 15000 chars):
${diff.slice(0, 15000)}`;

  const response = callAI(systemPrompt, userPrompt);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.groups;
    }
  } catch (e) {}
  
  return [{
    name: 'All Changes',
    emoji: '📁',
    description: 'All modified files',
    files: files
  }];
}

function explainFileChanges(file, diff, prDetails) {
  const fileDiffRegex = new RegExp(`diff --git a/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=diff --git|$)`);
  const match = diff.match(fileDiffRegex);
  const fileDiff = match ? match[0] : '';
  
  const systemPrompt = `You are a code review assistant. Explain the changes to this file in 3-5 bullet points.
Be specific about WHAT changed and WHY it might have changed.
Focus on the most important changes first.
Format as plain bullet points with • prefix.`;

  const userPrompt = `PR: ${prDetails.title}
File: ${file}

Diff:
${fileDiff.slice(0, 8000)}`;

  return callAI(systemPrompt, userPrompt);
}

function generateQuizQuestions(prDetails, diff, groups) {
  const systemPrompt = `You are a code review quiz master. Generate 3 multiple-choice questions to test if a reviewer understood this PR.

Output ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "What is the main purpose of this PR?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct": "A",
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Rules:
- Questions should test understanding, not memorization
- Include questions about: intent, side effects, edge cases
- Make wrong answers plausible but clearly wrong
- Exactly 3 questions`;

  const groupSummary = groups.map(g => `${g.emoji} ${g.name}: ${g.files.join(', ')}`).join('\n');

  const userPrompt = `PR Title: ${prDetails.title}
Description: ${prDetails.body || '(none)'}

Feature Groups:
${groupSummary}

Diff (first 12000 chars):
${diff.slice(0, 12000)}`;

  const response = callAI(systemPrompt, userPrompt);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.questions;
    }
  } catch (e) {}
  
  return [{
    question: 'Did you carefully review all the changes in this PR?',
    options: ['A) Yes, I reviewed everything', 'B) No, I skimmed it', 'C) I only looked at some files', 'D) What PR?'],
    correct: 'A',
    explanation: 'A thorough review is essential before approving.'
  }];
}

// ============================================================================
// IPC Handlers
// ============================================================================

let currentPR = null;
let currentDiff = null;
let currentGroups = null;

ipcMain.handle('fetch-pr', async (event, prInput) => {
  try {
    const pr = parsePRUrl(prInput);
    const prDetails = fetchPRDetails(pr.owner, pr.repo, pr.number);
    const diff = fetchPRDiff(pr.owner, pr.repo, pr.number);
    const files = fetchPRFiles(pr.owner, pr.repo, pr.number);
    
    currentPR = { ...pr, details: prDetails };
    currentDiff = diff;
    
    return {
      success: true,
      pr: {
        ...pr,
        ...prDetails,
        files
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('generate-summary', async (event) => {
  if (!currentPR || !currentDiff) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    const summary = generateSummary(currentPR.details, currentDiff);
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('group-files', async (event, files) => {
  if (!currentPR || !currentDiff) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    const groups = groupFilesByFeature(files, currentDiff, currentPR.details);
    currentGroups = groups;
    return { success: true, groups };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('explain-file', async (event, file) => {
  if (!currentPR || !currentDiff) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    const explanation = explainFileChanges(file, currentDiff, currentPR.details);
    return { success: true, explanation };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('generate-quiz', async (event) => {
  if (!currentPR || !currentDiff || !currentGroups) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    const questions = generateQuizQuestions(currentPR.details, currentDiff, currentGroups);
    return { success: true, questions };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('approve-pr', async (event) => {
  if (!currentPR) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    exec(`gh pr review ${currentPR.number} --repo ${currentPR.owner}/${currentPR.repo} --approve`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('request-changes', async (event, comment) => {
  if (!currentPR) {
    return { success: false, error: 'No PR loaded' };
  }
  
  try {
    exec(`gh pr review ${currentPR.number} --repo ${currentPR.owner}/${currentPR.repo} --request-changes --body "${comment.replace(/"/g, '\\"')}"`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('hide-window', () => {
  mb.hideWindow();
});

ipcMain.handle('check-gh-cli', async () => {
  try {
    exec('gh auth status');
    return { success: true };
  } catch (err) {
    return { success: false, error: 'GitHub CLI not authenticated. Run: gh auth login' };
  }
});
