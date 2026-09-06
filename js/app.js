// ── APP INIT ──
const VIEW_TITLES = {
  today: 'Today',
  planner: 'Test Planner',
  quiz: 'Quiz',
  tools: 'Tools',
  history: 'History',
  classes: 'Classes',
};

function switchView(name, clickedEl) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');

  // Update sidebar nav
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${name}"]`)?.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.bnav-btn[data-view="${name}"]`)?.classList.add('active');

  // Update topbar title
  document.getElementById('topbarTitle').textContent = VIEW_TITLES[name] || name;

  // Load view-specific data
  if (name === 'history') {
    loadQuizHistory();
  }
}

async function initApp() {
  const cfg = getConfig();

  if (!cfg) {
    document.getElementById('configScreen').classList.remove('hidden');
    return;
  }

  // Init Supabase
  if (!initSupabase()) {
    document.getElementById('configScreen').classList.remove('hidden');
    return;
  }

  // Ensure DB tables exist (graceful — tables must be created in Supabase manually)
  document.getElementById('mainApp').classList.remove('hidden');

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  const datePicker = document.getElementById('datePicker');
  if (datePicker) datePicker.value = today;
  document.getElementById('historyDatePicker').value = today;

  // Update streak
  try {
    const streak = await updateStreak();
    document.getElementById('sidebarStreak').textContent = streak;
    document.getElementById('mobileStreak').textContent = streak;
  } catch(e) { /* streak is non-critical */ }

  // Load today
  await loadDate(today);

  // Set min date for planner to today
  const plannerDate = document.getElementById('plannerDate');
  if (plannerDate) plannerDate.min = today;
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
