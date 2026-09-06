// ── TOOLS ──
const TOOL_CONFIGS = {
  notes: {
    title: '📝 Synthesize notes',
    placeholder: 'Paste today\'s notes here — whatever you jotted down in class, from videos, slides, etc.',
    inputLabel: 'Your notes',
    btnLabel: 'Synthesize',
    system: (input) => `You are a study assistant for Owen Currey. ${OWEN_PROFILE}
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
    placeholder: 'Paste the notes or topic you want flashcards for.',
    inputLabel: 'Notes or topic',
    btnLabel: 'Generate flashcards',
    system: () => `You are a flashcard generator for Owen Currey. ${OWEN_PROFILE}
Generate 15 flashcards. Format each as:
**Front:** [question or term]
**Back:** [answer in 1-3 sentences, plain language]
Mix: definition cards, application cards (how do you solve/use X?), and 2-3 "why does this matter" cards.`,
  },
  explain: {
    title: '💡 Explain something',
    placeholder: 'What concept are you stuck on? Which class?',
    inputLabel: 'What do you need explained?',
    btnLabel: 'Explain it',
    system: () => `You are a patient, direct tutor for Owen Currey. ${OWEN_PROFILE}
Break down the concept at 3 levels:
**Level 1 — Plain English:** Real-world analogy, no jargon, 2-4 sentences.
**Level 2 — Course level:** Proper terminology, worked example. For Algebra 2, always show full step-by-step solution.
**Level 3 — Exam ready:** What this looks like on a test, most common mistake, one thing to remember under pressure, a practice problem to try.
For Algebra 2: show 2 worked examples (one easy, one harder). Flag if this is likely on the end-of-month test.`,
  },
  weekly: {
    title: '🔄 Weekly review',
    placeholder: 'Tell me: what you planned this week, what you actually did, what slipped and why, what\'s coming next week.',
    inputLabel: 'This week\'s summary',
    btnLabel: 'Run review',
    system: () => `You are Owen's weekly review coach. ${OWEN_PROFILE}
After reading Owen's week summary, give him:
**What got done** (one sentence, no over-praising)
**The gap** (honest — what slipped and why, name the pattern directly)
**One thing to fix** (single most important habit change — just one)
**Next week's 3 priorities** (most urgent, weakest area, catch-up item)
**Days to watch** (flag risky days and suggest a workaround)
Be direct. He's 17 and can handle honesty. Don't lecture.`,
  }
};

let currentTool = null;
let toolHistory = [];

function launchTool(key) {
  const cfg = TOOL_CONFIGS[key];
  currentTool = key;
  toolHistory = [];

  const outputEl = document.getElementById('toolOutput');
  outputEl.classList.remove('hidden');
  document.getElementById('toolOutputTitle').textContent = cfg.title;
  document.getElementById('toolResponse').innerHTML = '';

  document.getElementById('toolInputArea').innerHTML = `
    <label>${cfg.inputLabel}</label>
    <textarea id="toolInput" placeholder="${cfg.placeholder}" rows="5"></textarea>
    <div class="tool-input-row" style="margin-top:8px">
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

async function runTool() {
  const input = document.getElementById('toolInput').value.trim();
  if (!input) { alert('Please enter some content first.'); return; }

  const cfg = TOOL_CONFIGS[currentTool];
  const responseEl = document.getElementById('toolResponse');
  responseEl.innerHTML = '<span class="typing-indicator">Working on it...</span>';

  toolHistory = [{ role: 'user', content: input }];
  const sys = typeof cfg.system === 'function' ? cfg.system(input) : cfg.system;

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
  const sys = typeof cfg.system === 'function' ? cfg.system('') : cfg.system;

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
}
