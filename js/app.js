// ── APP INIT ──
const VIEW_TITLES = {
  today: 'Today', planner: 'Test Planner', quiz: 'Quiz',
  tools: 'Tools', history: 'History', classes: 'Classes',
};

function switchView(name, clickedEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${name}"]`)?.classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.bnav-btn[data-view="${name}"]`)?.classList.add('active');
  document.getElementById('topbarTitle').textContent = VIEW_TITLES[name] || name;
  if (name === 'history') loadQuizHistory();
  if (name === 'tools') updateDriveBanner();
}

function updateDriveBanner() {
  const btn = document.getElementById('driveConnectBtn');
  const sub = document.getElementById('driveBannerSub');
  const sidebar = document.getElementById('driveStatusSidebar');
  if (!btn) return;
  if (isDriveConnected()) {
    btn.textContent = 'Connected ✓';
    btn.classList.add('connected');
    btn.onclick = null;
    if (sub) sub.textContent = 'Notes load automatically from Google Drive';
    if (sidebar) sidebar.innerHTML = '📂 Drive connected';
  } else {
    btn.textContent = 'Connect';
    btn.classList.remove('connected');
    btn.onclick = connectGoogleDrive;
    if (sub) sub.textContent = 'Connect to load notes automatically';
    if (sidebar) sidebar.innerHTML = '📂 <a href="#" onclick="switchView(\'tools\', null); return false;" style="color:var(--accent)">Connect Drive</a>';
  }
}

// Quiz Drive loader
let quizDriveNotes = '';

async function loadDriveNotesForQuiz() {
  const btn = document.getElementById('quizLoadDriveBtn');
  const status = document.getElementById('quizDriveStatus');
  const filesList = document.getElementById('quizDriveFiles');
  const className = document.getElementById('quizClass').value;

  if (!isDriveConnected()) {
    alert('Connect Google Drive first in the Tools tab.');
    return;
  }

  btn.textContent = 'Loading...';
  btn.disabled = true;
  status.textContent = 'Loading';
  status.className = 'drive-badge loading';

  try {
    const result = await loadNotesForClass(className);
    quizDriveNotes = result.content;
    status.textContent = `${result.files.length} files loaded`;
    status.className = 'drive-badge loaded';
    filesList.innerHTML = result.files.map(f => `· ${f}`).join('<br>');
    btn.textContent = 'Reload notes';
  } catch(e) {
    if (e.message === 'not_connected') {
      alert('Connect Google Drive first in the Tools tab.');
    } else {
      alert('Error loading notes: ' + e.message);
    }
    status.textContent = 'Failed';
    status.className = 'drive-badge';
    btn.textContent = 'Try again';
  }
  btn.disabled = false;
}

async function initApp() {
  const cfg = getConfig();
  if (!cfg) {
    document.getElementById('configScreen').classList.remove('hidden');
    return;
  }
  if (!initSupabase()) {
    document.getElementById('configScreen').classList.remove('hidden');
    return;
  }

  document.getElementById('mainApp').classList.remove('hidden');

  // Handle Google Drive OAuth callback
  const driveAuthed = handleDriveAuthCallback();
  if (!driveAuthed) restoreDriveSession();

  const today = new Date().toISOString().split('T')[0];
  const datePicker = document.getElementById('datePicker');
  if (datePicker) datePicker.value = today;
  document.getElementById('historyDatePicker').value = today;

  try {
    const streak = await updateStreak();
    document.getElementById('sidebarStreak').textContent = streak;
    document.getElementById('mobileStreak').textContent = streak;
  } catch(e) {}

  await loadDate(today);
  updateDriveBanner();

  const plannerDate = document.getElementById('plannerDate');
  if (plannerDate) plannerDate.min = today;
}

document.addEventListener('DOMContentLoaded', initApp);
