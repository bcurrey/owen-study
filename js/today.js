// ── TODAY VIEW ──
let currentDate = new Date().toISOString().split('T')[0];

const DEFAULT_TASKS = [
  { text: 'Live math class', tag: 'Math', time: '10:00 AM' },
  { text: 'Upload today\'s Algebra 2 notes', tag: 'Math', time: 'After class' },
  { text: 'Watch English 3 videos/slides', tag: 'English', time: 'Work block' },
  { text: 'Watch Economics videos/slides', tag: 'Econ', time: 'Work block' },
  { text: 'Synthesize notes in Claude', tag: 'General', time: '10:00 PM' },
  { text: 'Algebra 2 quiz', tag: 'Math', time: '10:30 PM' },
];

async function loadDate(dateStr) {
  currentDate = dateStr;
  updateDateDisplay();
  await loadTasks();
  await loadTestAlerts();
}

function updateDateDisplay() {
  const d = new Date(currentDate + 'T12:00:00');
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  const str = d.toLocaleDateString('en-US', opts);
  const el1 = document.getElementById('todayDateStr');
  const el2 = document.getElementById('mobileDateStr');
  const el3 = document.getElementById('datePicker');
  if (el1) el1.textContent = str;
  if (el2) el2.textContent = str;
  if (el3) el3.value = currentDate;
}

function changeDate(delta) {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  loadDate(d.toISOString().split('T')[0]);
}

async function loadTasks() {
  const list = document.getElementById('todoList');
  list.innerHTML = '<div class="loading"><span class="spinner"></span>Loading...</div>';

  let tasks = await getTasks(currentDate);

  // If today and no tasks exist yet, seed with defaults
  const today = new Date().toISOString().split('T')[0];
  if (tasks.length === 0 && currentDate === today) {
    for (const t of DEFAULT_TASKS) {
      await createTask(currentDate, t.text, t.tag, t.time);
    }
    // Also add any study plan tasks for today
    await addStudyPlanTasksForDate(currentDate);
    tasks = await getTasks(currentDate);
  }

  renderTasks(tasks);
}

async function addStudyPlanTasksForDate(dateStr) {
  const plans = await getAllPlans();
  for (const plan of plans) {
    if (!plan.plan) continue;
    const dayEntry = plan.plan.find(d => d.date === dateStr);
    if (dayEntry && dayEntry.tasks) {
      for (const task of dayEntry.tasks) {
        // Check if this task already exists
        const existing = await getTasks(dateStr);
        const alreadyExists = existing.find(t => t.text === task);
        if (!alreadyExists) {
          await createTask(dateStr, task, 'Math', '');
        }
      }
    }
  }
}

function renderTasks(tasks) {
  const list = document.getElementById('todoList');
  if (tasks.length === 0) {
    list.innerHTML = '<div class="loading" style="padding:20px">No tasks for this day. Add one above.</div>';
    updateProgress(0, 0);
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="todo ${t.done ? 'done' : ''}" data-id="${t.id}" onclick="toggleTodoItem('${t.id}', ${!t.done})">
      <div class="todo-check">${t.done ? '✓' : ''}</div>
      <div style="flex:1">
        <div class="todo-title"><span class="tag tag-${t.tag}">${t.tag}</span>${t.text}</div>
        ${t.time ? `<div class="todo-meta">${t.time}</div>` : ''}
      </div>
    </div>
  `).join('');
  const done = tasks.filter(t => t.done).length;
  updateProgress(done, tasks.length);
}

async function toggleTodoItem(id, done) {
  await toggleTask(id, done);
  const tasks = await getTasks(currentDate);
  renderTasks(tasks);
}

function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
}

async function loadTestAlerts() {
  const container = document.getElementById('testAlertContainer');
  container.innerHTML = '';
  const plans = await getUpcomingPlans();
  if (plans.length === 0) return;

  const today = new Date();
  for (const plan of plans.slice(0, 2)) {
    const testDate = new Date(plan.test_date + 'T12:00:00');
    const daysLeft = Math.ceil((testDate - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) continue;
    container.innerHTML += `
      <div class="test-alert">
        <div>
          <div class="test-alert-label">Test Alert</div>
          <div class="test-alert-name">${plan.class_name}</div>
          <div class="test-alert-days">${daysLeft === 0 ? 'Today!' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' away · ' + testDate.toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
        </div>
        <button class="test-alert-btn" onclick="switchView('planner', document.querySelector('[data-view=planner]'))">View plan →</button>
      </div>`;
  }

  // If no plans, show default Algebra 2 end of month
  if (plans.length === 0) {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = Math.ceil((lastDay - today) / (1000 * 60 * 60 * 24));
    container.innerHTML = `
      <div class="test-alert">
        <div>
          <div class="test-alert-label">Upcoming Test</div>
          <div class="test-alert-name">Algebra 2</div>
          <div class="test-alert-days">${daysLeft} days away · end of month</div>
        </div>
        <button class="test-alert-btn" onclick="switchView('planner', document.querySelector('[data-view=planner]'))">Plan it →</button>
      </div>`;
  }
}

// ── ADD TASK MODAL ──
function openAddTask() {
  document.getElementById('addTaskModal').classList.remove('hidden');
  document.getElementById('newTaskText').focus();
}

function closeAddTask() {
  document.getElementById('addTaskModal').classList.add('hidden');
  document.getElementById('newTaskText').value = '';
}

async function addTask() {
  const text = document.getElementById('newTaskText').value.trim();
  const tag = document.getElementById('newTaskClass').value;
  const time = document.getElementById('newTaskTime').value;
  if (!text) return;
  await createTask(currentDate, text, tag, time ? formatTime(time) : '');
  closeAddTask();
  const tasks = await getTasks(currentDate);
  renderTasks(tasks);
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
