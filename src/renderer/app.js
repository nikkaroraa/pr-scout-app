const { ipcRenderer } = require('electron');

// ============================================================================
// State
// ============================================================================

let state = {
  view: 'input', // input, loading, summary, groups, files, quiz, result
  pr: null,
  summary: null,
  groups: null,
  currentGroupIndex: 0,
  currentFileIndex: 0,
  fileExplanations: {},
  quiz: null,
  quizAnswers: [],
  quizResults: null,
  error: null,
};

// ============================================================================
// Render Functions
// ============================================================================

function render() {
  const content = document.getElementById('content');
  
  switch (state.view) {
    case 'input':
      content.innerHTML = renderInput();
      setupInputHandlers();
      break;
    case 'loading':
      content.innerHTML = renderLoading();
      break;
    case 'summary':
      content.innerHTML = renderSummary();
      setupSummaryHandlers();
      break;
    case 'groups':
      content.innerHTML = renderGroups();
      setupGroupsHandlers();
      break;
    case 'files':
      content.innerHTML = renderFiles();
      setupFilesHandlers();
      break;
    case 'quiz':
      content.innerHTML = renderQuiz();
      setupQuizHandlers();
      break;
    case 'result':
      content.innerHTML = renderResult();
      setupResultHandlers();
      break;
    case 'error':
      content.innerHTML = renderError();
      setupErrorHandlers();
      break;
  }
}

function renderInput() {
  return `
    <div class="fade-in">
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <h2 style="margin: 0 0 8px; font-size: 20px;">Review a Pull Request</h2>
        <p style="color: #8b949e; margin: 0 0 24px; font-size: 14px;">
          Paste a PR URL or number to get started
        </p>
        
        <input 
          type="text" 
          id="pr-input" 
          class="input"
          placeholder="https://github.com/owner/repo/pull/123"
          style="margin-bottom: 16px;"
        />
        
        <button id="fetch-btn" class="btn btn-primary" style="width: 100%;">
          Start Review
        </button>
        
        <p style="color: #8b949e; font-size: 12px; margin-top: 24px;">
          Requires <code style="background: #161b22; padding: 2px 6px; border-radius: 4px;">gh</code> CLI authenticated
        </p>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px;">
      <div class="spinner"></div>
      <p style="color: #8b949e;">${state.loadingMessage || 'Loading...'}</p>
    </div>
  `;
}

function renderSummary() {
  const pr = state.pr;
  return `
    <div class="fade-in">
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 24px;">📋</span>
          <div style="flex: 1; min-width: 0;">
            <h3 style="margin: 0 0 4px; font-size: 16px; word-wrap: break-word;">${escapeHtml(pr.title)}</h3>
            <p style="margin: 0; color: #8b949e; font-size: 13px;">
              by <span style="color: #58a6ff;">@${pr.author.login}</span>
            </p>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px; font-size: 13px; color: #8b949e; margin-bottom: 12px;">
          <span class="badge badge-green">+${pr.additions}</span>
          <span class="badge badge-red">-${pr.deletions}</span>
          <span>${pr.changedFiles} files</span>
          <span>${pr.commits.totalCount} commits</span>
        </div>
        
        <div style="font-size: 12px; color: #8b949e;">
          ${pr.headRefName} → ${pr.baseRefName}
        </div>
      </div>
      
      <div class="card" style="margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px; display: flex; align-items: center; gap: 8px;">
          <span>🤖</span> AI Summary
        </h4>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(state.summary)}</p>
      </div>
      
      <button id="continue-btn" class="btn btn-primary" style="width: 100%;">
        View Changes by Feature →
      </button>
    </div>
  `;
}

function renderGroups() {
  const groups = state.groups || [];
  return `
    <div class="fade-in">
      <h3 style="margin: 0 0 16px; font-size: 16px;">📁 Feature Groups</h3>
      <p style="color: #8b949e; font-size: 13px; margin-bottom: 16px;">
        Files grouped by feature, not alphabetically
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        ${groups.map((group, i) => `
          <div class="card collapsible" data-index="${i}" style="cursor: pointer; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">${group.emoji}</span>
              <div style="flex: 1;">
                <div style="font-weight: 500;">${escapeHtml(group.name)}</div>
                <div style="font-size: 12px; color: #8b949e;">${group.files.length} files</div>
              </div>
              <span style="color: #8b949e;">→</span>
            </div>
          </div>
        `).join('')}
      </div>
      
      <button id="start-quiz-btn" class="btn btn-secondary" style="width: 100%;">
        Skip to Quiz →
      </button>
    </div>
  `;
}

function renderFiles() {
  const group = state.groups[state.currentGroupIndex];
  const file = group.files[state.currentFileIndex];
  const explanation = state.fileExplanations[file];
  
  return `
    <div class="fade-in">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <button id="back-btn" class="btn btn-secondary" style="padding: 8px;">←</button>
        <div style="flex: 1;">
          <div style="font-size: 12px; color: #8b949e;">
            ${group.emoji} ${escapeHtml(group.name)} (${state.currentFileIndex + 1}/${group.files.length})
          </div>
        </div>
      </div>
      
      <div class="card" style="margin-bottom: 16px;">
        <div style="font-family: 'SF Mono', Menlo, monospace; font-size: 13px; color: #58a6ff; word-break: break-all; margin-bottom: 12px;">
          📄 ${escapeHtml(file)}
        </div>
        
        ${explanation ? `
          <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(explanation)}</div>
        ` : `
          <div style="display: flex; align-items: center; gap: 8px; color: #8b949e;">
            <div class="spinner"></div>
            <span>Analyzing changes...</span>
          </div>
        `}
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button id="prev-file-btn" class="btn btn-secondary" style="flex: 1;" ${state.currentFileIndex === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        <button id="next-file-btn" class="btn btn-primary" style="flex: 1;">
          ${state.currentFileIndex === group.files.length - 1 ? 'Done →' : 'Next →'}
        </button>
      </div>
    </div>
  `;
}

function renderQuiz() {
  const quiz = state.quiz;
  const currentQ = state.quizAnswers.length;
  
  if (currentQ >= quiz.length) {
    // Calculate and show results
    const correct = state.quizAnswers.filter((a, i) => a === quiz[i].correct).length;
    state.quizResults = { correct, total: quiz.length };
    state.view = 'result';
    render();
    return '';
  }
  
  const q = quiz[currentQ];
  const answered = state.currentAnswer !== undefined;
  
  return `
    <div class="fade-in">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="font-size: 20px;">📝</span>
        <span style="font-weight: 500;">Quiz</span>
        <div style="flex: 1;"></div>
        <span style="color: #8b949e; font-size: 13px;">
          Question ${currentQ + 1}/${quiz.length}
        </span>
      </div>
      
      <div class="card" style="margin-bottom: 16px;">
        <p style="margin: 0 0 16px; font-size: 15px; font-weight: 500;">${escapeHtml(q.question)}</p>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${q.options.map((opt, i) => {
            const letter = opt.charAt(0);
            let className = 'quiz-option';
            if (answered) {
              if (letter === q.correct) className += ' correct';
              else if (letter === state.currentAnswer) className += ' incorrect';
            } else if (letter === state.selectedAnswer) {
              className += ' selected';
            }
            return `
              <button class="${className}" data-answer="${letter}" ${answered ? 'disabled' : ''}>
                ${escapeHtml(opt)}
              </button>
            `;
          }).join('')}
        </div>
        
        ${answered ? `
          <div style="margin-top: 16px; padding: 12px; background: ${state.currentAnswer === q.correct ? 'rgba(35, 134, 54, 0.1)' : 'rgba(218, 54, 51, 0.1)'}; border-radius: 8px;">
            <div style="font-weight: 500; margin-bottom: 4px;">
              ${state.currentAnswer === q.correct ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            <div style="font-size: 13px; color: #8b949e;">${escapeHtml(q.explanation)}</div>
          </div>
        ` : ''}
      </div>
      
      ${answered ? `
        <button id="next-question-btn" class="btn btn-primary" style="width: 100%;">
          ${currentQ === quiz.length - 1 ? 'See Results →' : 'Next Question →'}
        </button>
      ` : `
        <button id="submit-answer-btn" class="btn btn-primary" style="width: 100%;" ${!state.selectedAnswer ? 'disabled' : ''}>
          Submit Answer
        </button>
      `}
    </div>
  `;
}

function renderResult() {
  const { correct, total } = state.quizResults;
  const passed = correct / total >= 0.66;
  
  return `
    <div class="fade-in">
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 64px; margin-bottom: 16px;">${passed ? '🎉' : '📚'}</div>
        <h2 style="margin: 0 0 8px;">${passed ? 'Quiz Passed!' : 'Quiz Failed'}</h2>
        <p style="color: #8b949e; margin: 0 0 24px;">
          You got ${correct} out of ${total} correct (${Math.round(correct/total*100)}%)
        </p>
        
        ${passed ? `
          <div class="card" style="margin-bottom: 16px; text-align: left;">
            <h4 style="margin: 0 0 12px;">Ready to submit your review?</h4>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button id="approve-btn" class="btn btn-primary" style="width: 100%;">
                ✅ Approve PR
              </button>
              <button id="request-changes-btn" class="btn btn-danger" style="width: 100%;">
                🔴 Request Changes
              </button>
            </div>
          </div>
          
          <div id="changes-form" style="display: none;" class="card">
            <h4 style="margin: 0 0 12px; text-align: left;">Request Changes</h4>
            <textarea id="changes-comment" class="input" rows="4" placeholder="Describe the changes you'd like to see..." style="margin-bottom: 12px;"></textarea>
            <div style="display: flex; gap: 8px;">
              <button id="cancel-changes-btn" class="btn btn-secondary" style="flex: 1;">Cancel</button>
              <button id="submit-changes-btn" class="btn btn-danger" style="flex: 1;">Submit</button>
            </div>
          </div>
        ` : `
          <p style="color: #8b949e; margin-bottom: 24px;">
            Please review the changes again before approving.
          </p>
          <button id="retry-btn" class="btn btn-primary" style="width: 100%;">
            Review Again
          </button>
        `}
      </div>
      
      <button id="new-review-btn" class="btn btn-secondary" style="width: 100%; margin-top: 16px;">
        Review Another PR
      </button>
    </div>
  `;
}

function renderError() {
  return `
    <div class="fade-in" style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
      <h3 style="margin: 0 0 8px;">Something went wrong</h3>
      <p style="color: #8b949e; margin: 0 0 24px; font-size: 14px;">
        ${escapeHtml(state.error)}
      </p>
      <button id="retry-input-btn" class="btn btn-primary" style="width: 100%;">
        Try Again
      </button>
    </div>
  `;
}

// ============================================================================
// Event Handlers
// ============================================================================

function setupInputHandlers() {
  const input = document.getElementById('pr-input');
  const fetchBtn = document.getElementById('fetch-btn');
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchPR();
  });
  
  fetchBtn.addEventListener('click', fetchPR);
  
  // Focus input
  setTimeout(() => input.focus(), 100);
}

function setupSummaryHandlers() {
  document.getElementById('continue-btn').addEventListener('click', () => {
    state.view = 'groups';
    render();
  });
}

function setupGroupsHandlers() {
  document.querySelectorAll('.collapsible').forEach(el => {
    el.addEventListener('click', () => {
      const index = parseInt(el.dataset.index);
      state.currentGroupIndex = index;
      state.currentFileIndex = 0;
      state.view = 'files';
      render();
      loadFileExplanation();
    });
  });
  
  document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
}

function setupFilesHandlers() {
  document.getElementById('back-btn').addEventListener('click', () => {
    state.view = 'groups';
    render();
  });
  
  const prevBtn = document.getElementById('prev-file-btn');
  const nextBtn = document.getElementById('next-file-btn');
  
  prevBtn.addEventListener('click', () => {
    if (state.currentFileIndex > 0) {
      state.currentFileIndex--;
      render();
      loadFileExplanation();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    const group = state.groups[state.currentGroupIndex];
    if (state.currentFileIndex < group.files.length - 1) {
      state.currentFileIndex++;
      render();
      loadFileExplanation();
    } else {
      // Move to next group or quiz
      if (state.currentGroupIndex < state.groups.length - 1) {
        state.currentGroupIndex++;
        state.currentFileIndex = 0;
        render();
        loadFileExplanation();
      } else {
        startQuiz();
      }
    }
  });
}

function setupQuizHandlers() {
  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.currentAnswer !== undefined) return;
      state.selectedAnswer = btn.dataset.answer;
      render();
    });
  });
  
  const submitBtn = document.getElementById('submit-answer-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      state.currentAnswer = state.selectedAnswer;
      state.quizAnswers.push(state.currentAnswer);
      render();
    });
  }
  
  const nextBtn = document.getElementById('next-question-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.currentAnswer = undefined;
      state.selectedAnswer = undefined;
      render();
    });
  }
}

function setupResultHandlers() {
  const approveBtn = document.getElementById('approve-btn');
  const requestChangesBtn = document.getElementById('request-changes-btn');
  const retryBtn = document.getElementById('retry-btn');
  const newReviewBtn = document.getElementById('new-review-btn');
  
  if (approveBtn) {
    approveBtn.addEventListener('click', approvePR);
  }
  
  if (requestChangesBtn) {
    requestChangesBtn.addEventListener('click', () => {
      document.getElementById('changes-form').style.display = 'block';
    });
    
    document.getElementById('cancel-changes-btn')?.addEventListener('click', () => {
      document.getElementById('changes-form').style.display = 'none';
    });
    
    document.getElementById('submit-changes-btn')?.addEventListener('click', () => {
      const comment = document.getElementById('changes-comment').value;
      if (comment.trim()) {
        requestChanges(comment);
      }
    });
  }
  
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      state.view = 'groups';
      state.quizAnswers = [];
      state.quizResults = null;
      render();
    });
  }
  
  if (newReviewBtn) {
    newReviewBtn.addEventListener('click', resetState);
  }
}

function setupErrorHandlers() {
  document.getElementById('retry-input-btn').addEventListener('click', resetState);
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchPR() {
  const input = document.getElementById('pr-input').value.trim();
  if (!input) return;
  
  state.view = 'loading';
  state.loadingMessage = 'Fetching PR details...';
  render();
  
  try {
    // Check gh CLI first
    const ghCheck = await ipcRenderer.invoke('check-gh-cli');
    if (!ghCheck.success) {
      throw new Error(ghCheck.error);
    }
    
    // Fetch PR
    const result = await ipcRenderer.invoke('fetch-pr', input);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    state.pr = result.pr;
    
    // Generate summary
    state.loadingMessage = 'Generating AI summary...';
    render();
    
    const summaryResult = await ipcRenderer.invoke('generate-summary');
    if (!summaryResult.success) {
      throw new Error(summaryResult.error);
    }
    state.summary = summaryResult.summary;
    
    // Group files
    state.loadingMessage = 'Grouping files by feature...';
    render();
    
    const groupsResult = await ipcRenderer.invoke('group-files', state.pr.files);
    if (!groupsResult.success) {
      throw new Error(groupsResult.error);
    }
    state.groups = groupsResult.groups;
    
    state.view = 'summary';
    render();
    
  } catch (err) {
    state.error = err.message;
    state.view = 'error';
    render();
  }
}

async function loadFileExplanation() {
  const group = state.groups[state.currentGroupIndex];
  const file = group.files[state.currentFileIndex];
  
  if (state.fileExplanations[file]) return;
  
  try {
    const result = await ipcRenderer.invoke('explain-file', file);
    if (result.success) {
      state.fileExplanations[file] = result.explanation;
      render();
    }
  } catch (err) {
    state.fileExplanations[file] = 'Failed to load explanation.';
    render();
  }
}

async function startQuiz() {
  state.view = 'loading';
  state.loadingMessage = 'Generating quiz questions...';
  render();
  
  try {
    const result = await ipcRenderer.invoke('generate-quiz');
    if (!result.success) {
      throw new Error(result.error);
    }
    
    state.quiz = result.questions;
    state.quizAnswers = [];
    state.currentAnswer = undefined;
    state.selectedAnswer = undefined;
    state.view = 'quiz';
    render();
    
  } catch (err) {
    state.error = err.message;
    state.view = 'error';
    render();
  }
}

async function approvePR() {
  state.view = 'loading';
  state.loadingMessage = 'Approving PR...';
  render();
  
  try {
    const result = await ipcRenderer.invoke('approve-pr');
    if (!result.success) {
      throw new Error(result.error);
    }
    
    alert('PR approved! 🎉');
    resetState();
    
  } catch (err) {
    state.error = err.message;
    state.view = 'error';
    render();
  }
}

async function requestChanges(comment) {
  state.view = 'loading';
  state.loadingMessage = 'Submitting review...';
  render();
  
  try {
    const result = await ipcRenderer.invoke('request-changes', comment);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    alert('Changes requested!');
    resetState();
    
  } catch (err) {
    state.error = err.message;
    state.view = 'error';
    render();
  }
}

function resetState() {
  state = {
    view: 'input',
    pr: null,
    summary: null,
    groups: null,
    currentGroupIndex: 0,
    currentFileIndex: 0,
    fileExplanations: {},
    quiz: null,
    quizAnswers: [],
    quizResults: null,
    error: null,
  };
  render();
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Initialize
// ============================================================================

document.getElementById('close-btn').addEventListener('click', () => {
  ipcRenderer.invoke('hide-window');
});

render();
