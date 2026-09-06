// ── TOOLS ──
const TOOL_CONFIGS = {
  notes: {
    title: '📝 Synthesize notes',
    inputLabel: 'Your notes',
    driveEnabled: true,
    btnLabel: 'Synthesize',
    system: () => `You are a study assistant for Owen Currey. ${OWEN_PROFILE}
Turn Owen's raw notes into clean, structured study material.
Format:
**The big idea** (1-2 sentences)
**Key terms** (term: plain-language definition)
**Core concepts** (3-5 bullets — most likely to appear on a test)
**5 self-check questions** (mix recall and application)
**Watch out for** (common mistakes on this topic)
For Algebra 2: flag any formula/procedure that will appear on the end-of-month test. Add a worked example for multi-step processes.`,
  },
  flashcards: {
    title: '🃏 Generate flashcards',
    inputLabel: 'Notes or topic',
    driveEnabled: true,
    btnLabel: 'Generate flashcards',
    system: () => `You are a flashcard generator for Owen Currey. ${OWEN_PROFILE}
Generate 15 flashcards. Format each as:
**Front:** [question or term]
**Back:** [answer in 1-3 sentences, plain language]
Mix: definition cards, application cards, and 2-3 "why does this matter" cards.`,
  },
  explain: {
    title: '💡 Explain something',
    inputLabel: 'What do you need explained?',
    driveEnabled: false,
    btnLabel: 'Explain it',
    system: () => `You are a patient, direct tutor for Owen Currey. ${OWEN_PROFILE}
Break down the concept at 3 levels:
**Level 1 — Plain English:** Real-world analogy, no jargon, 2-4 sentences.
**Level 2 — Course level:** Proper terminology, worked example. For Algebra 2, always show full step-by-step solution.
**Level 3 — Exam ready:** What this looks like on a test, most common mistake, one thing to remember, a practice problem.
For Algebra 2: show 2 worked examples. Flag if this is likely on the end-of-month test.`,
  },
  weekly: {
    title: '🔄 Weekly review',
    inputLabel: 'This week\'s summary',
    driveEnabled: false,
    btnLabel: 'Run review',
    system: () => `You are Owen's weekly review coach. ${OWEN_PROFILE}
After reading Owen's week summary, give him:
**What got done** (one sentence)
**The gap** (honest — what slipped and why, name the pattern)
**One thing to fix** (single most important habit change)
**Next week's 3 priorities**
**Days to watch** (flag risky days and suggest a workaround)
Be direct. Don't lecture.`,
  },
  finals: {
    title: '🎓 Finals prep',
    inputLabel: 'What do you want to focus on? (or leave blank for full review)',
    driveEnabled: true,
    driveMultiClass: true,
    btnLabel: 'Start finals prep',
    system: () => `You are a finals prep tutor for Owen Currey. ${OWEN_PROFILE}
Owen is preparing for finals which may cover material from multiple classes.
Based on his notes, create a comprehensive finals review:
**Key themes across all material**
**Most important concepts per class** (ranked by likelihood to appear)
**Connections between topics**
**Top 10 things to know cold**
**Suggested study order for the next week**
Be specific to what's actually in his notes.`,
  }
};
 
let currentTool = null;
let toolHistory = [];
let toolDriveNotes = '';
 
function launchTool(key) {
  const cfg = TOOL_CONFIGS[key];
  currentTool = key;
  toolHistory = [];
  toolDriveNotes = '';
 
  const outputEl = document.getElementById('toolOutput');
  outputEl.classList.remove('hidden');
  document.getElementById('toolOutputTitle').textContent = cfg.title;
  document.getElementById('toolResponse').innerHTML = '';
 
  let driveSection = '';
  if (cfg.driveEnabled) {
    if (cfg.driveMultiClass) {
      driveSection = `
        <div class="drive-load-section" style="margin-bottom:12px">
          <div class="drive-load-header">
            <span>📂 Load notes from Google Drive</span>
            <span id="toolDriveStatus" class="drive-badge"></span>
          </div>
          <div id="toolDriveFiles" class="drive-files-list"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('Algebra 2')">Algebra 2</button>
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('English 3')">English 3</button>
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('Economics')">Economics</button>
            <button class="drive-load-btn" style="width:auto;padding:6px 14px;background:var(--accent-dim);color:var(--accent)" onclick="loadToolDriveNotesAll()">Load all classes</button>
          </div>
        </div>`;
    } else {
      driveSection = `
        <div class="drive-load-section" style="margin-bottom:12px">
          <div class="drive-load-header">
            <span>📂 Load from Google Drive</span>
            <span id="toolDriveStatus" class="drive-badge"></span>
          </div>
          <div id="toolDriveFiles" class="drive-files-list"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('Algebra 2')">Algebra 2</button>
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('English 3')">English 3</button>
            <button class="drive-load-btn" style="width:auto;padding:6px 14px" onclick="loadToolDriveNotes('Economics')">Economics</button>
          </div>
        </div>`;
    }
  }
 
  document.getElementById('toolInputArea').innerHTML = `
    ${driveSection}
    <label>${cfg.inputLabel}</label>
    <textarea id="toolInput" placeholder="${cfg.driveEnabled ? 'Notes will load from Drive above, or paste additional notes here...' : 'Enter your question or content here...'}" rows="4"></textarea>
    <div style="margin-top:8px">
      <button onclick="runTool()" style="background:var(--accent);color:white;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;width:100%">${cfg.btnLabel}</button>
    </div>
    <div id="toolFollowup" style="margin-top:12px;display:none">
      <div class="tool-input-row">
        <input type="text" id="toolFollowupInput" placeholder="Ask a follow-up question...">
        <button onclick="sendToolFollowup()">Send</button>
      </div>
    </div>`;
 
  outputEl.scrollIntoView({ behavior: 'smooth' });
}
 
async function loadToolDriveNotes(className) {
  const status = document.getElementById('toolDriveStatus');
  const filesList = document.getElementById('toolDriveFiles');
  if (!isDriveConnected()) {
    alert('Connect Google Drive first — click the Connect button at the top of this page.');
    return;
  }
  status.textContent = 'Loading...';
  status.className = 'drive-badge loading';
  try {
    const result = await loadNotesForClass(className);
    toolDriveNotes += `\n\n=== ${className} ===\n${result.content}`;
    status.textContent = `Loaded`;
    status.className = 'drive-badge loaded';
    const existing = filesList.innerHTML;
    filesList.innerHTML = existing + (existing ? '<br>' : '') + result.files.map(f => `· ${className}: ${f}`).join('<br>');
  } catch(e) {
    status.textContent = 'Error';
    status.className = 'drive-badge';
    alert('Could not load notes: ' + e.message);
  }
}
 
async function loadToolDriveNotesAll() {
  await loadToolDriveNotes('Algebra 2');
  await loadToolDriveNotes('English 3');
  await loadToolDriveNotes('Economics');
}
 
async function runTool() {
  const input = document.getElementById('toolInput').value.trim();
  const cfg = TOOL_CONFIGS[currentTool];
  const responseEl = document.getElementById('toolResponse');
 
  const combinedInput = [
    toolDriveNotes ? `Notes from Google Drive:\n${toolDriveNotes.substring(0, 10000)}` : '',
    input
  ].filter(Boolean).join('\n\n');
 
  if (!combinedInput) { alert('Please load notes from Drive or enter some content first.'); return; }
 
  responseEl.innerHTML = '<span class="typing-indicator">Working on it...</span>';
  toolHistory = [{ role: 'user', content: combinedInput }];
  const sys = cfg.system();
 
  let full = '';
  await callClaude(toolHistory, sys, (chunk, fullText) => {
    full = fullText;
    responseEl.innerHTML = fullText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  });
 
  toolHistory.push({ role: 'assistant', content: full });
  document.getElementById('toolFollowup').style.display = 'block';
}
 
async function sendToolFollowup() {
  const input = document.getElementById('toolFollowupInput');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
 
  const cfg = TOOL_CONFIGS[currentTool];
  const responseEl = document.getElementById('toolResponse');
  responseEl.innerHTML += `<br><br><strong style="color:var(--accent)">You: ${q}</strong><br><br>`;
 
  toolHistory.push({ role: 'user', content: q });
  const sys = cfg.system();
  let responseStart = responseEl.innerHTML;
  let full = '';
 
  await callClaude(toolHistory, sys, (chunk, fullText) => {
    full = fullText;
    responseEl.innerHTML = responseStart + fullText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  });
 
  toolHistory.push({ role: 'assistant', content: full });
}
 
function closeTool() {
  document.getElementById('toolOutput').classList.add('hidden');
  currentTool = null;
  toolHistory = [];
  toolDriveNotes = '';
}
 
