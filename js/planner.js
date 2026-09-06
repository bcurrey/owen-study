// ── STUDY PLANNER ──
async function generateStudyPlan() {
  const className = document.getElementById('plannerClass').value;
  const testDate = document.getElementById('plannerDate').value;
  const topics = document.getElementById('plannerTopics').value.trim();
  const weak = document.getElementById('plannerWeak').value.trim();

  if (!testDate) { alert('Please enter the test date.'); return; }

  const btn = document.getElementById('plannerBtnText');
  btn.textContent = 'Building your plan...';
  document.querySelector('.planner-form .primary-btn').disabled = true;

  const output = document.getElementById('studyPlanOutput');
  output.innerHTML = '<div class="loading"><span class="spinner"></span>Generating your day-by-day plan...</div>';

  try {
    const today = new Date().toISOString().split('T')[0];
    const daysUntil = Math.ceil((new Date(testDate + 'T12:00:00') - new Date()) / (1000*60*60*24));

    const sys = `You are a study planner for Owen Currey. ${OWEN_PROFILE}
Build a realistic day-by-day study plan from today (${today}) until the test on ${testDate} (${daysUntil} days).
Owen's best study times are 10am and 10pm. Keep daily tasks to 3 items max.
${className === 'Algebra 2' ? 'This is his weakest class. Include a formulas/procedures review sheet on day 1, practice problems throughout, and a full practice test 2-3 days before the test.' : ''}
${weak ? `He feels weakest on: ${weak}. Weight the early days toward this.` : ''}
${topics ? `Topics on this test: ${topics}.` : ''}

Day structure:
- 7+ days out: review/organize notes, identify gaps
- 4-6 days out: focused study on weakest areas, flashcard review
- 2-3 days out: practice problems, full quiz session  
- 1 day out: light review only, no new material
- Day of: 15-min review of key formulas/terms only

Return ONLY a JSON array. No markdown. Format:
[{"date":"YYYY-MM-DD","label":"Mon, Jan 6","phase":"review","tasks":["task 1","task 2","task 3"],"quizRequired":true/false}]
The "phase" field should be: "review", "focus", "practice", "light", or "test".
Set "quizRequired" to true for any day that includes a quiz task.`;

    const raw = await callClaude([{ role: 'user', content: `Build study plan for ${className} test on ${testDate}.` }], sys);
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    // Save to DB
    await saveStudyPlan(className, testDate, plan);

    renderStudyPlan(plan, className, testDate);

    // Add today's tasks if plan has them
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPlan = plan.find(d => d.date === todayStr);
    if (todayPlan) {
      for (const task of todayPlan.tasks) {
        const existing = await getTasks(todayStr);
        if (!existing.find(t => t.text === task)) {
          await createTask(todayStr, task, className === 'Algebra 2' ? 'Math' : className === 'English 3' ? 'English' : 'Econ', '');
        }
      }
    }

  } catch(e) {
    output.innerHTML = `<div class="loading">Error generating plan. Please try again. (${e.message})</div>`;
  }

  btn.textContent = 'Generate study plan';
  document.querySelector('.planner-form .primary-btn').disabled = false;
}

function renderStudyPlan(plan, className, testDate) {
  const output = document.getElementById('studyPlanOutput');
  const testDateObj = new Date(testDate + 'T12:00:00');

  output.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">
      ${className} — Test on ${testDateObj.toLocaleDateString('en-US', {month:'long', day:'numeric'})}
    </div>
    ${plan.map(day => {
      const phaseLabels = { review: 'Review', focus: 'Focus', practice: 'Practice Run', light: 'Light Day', test: 'Test Day' };
      const phaseClasses = { review: 'day-tag-review', focus: 'day-tag-focus', practice: 'day-tag-practice', light: 'day-tag-light', test: '' };
      const isToday = day.date === new Date().toISOString().split('T')[0];

      return `
        <div class="study-day-card" style="${isToday ? 'border-color:var(--accent)' : ''}">
          <div class="study-day-header">
            <div class="study-day-label">${day.label}${isToday ? ' <span style="color:var(--accent);font-size:12px">· Today</span>' : ''}</div>
            <span class="study-day-tag ${phaseClasses[day.phase]}">${phaseLabels[day.phase]}</span>
          </div>
          <div class="study-day-tasks">
            ${day.tasks.map(t => `<div class="study-day-task">${t}</div>`).join('')}
          </div>
          <button class="add-to-today-btn" onclick="addPlanDayToToday('${day.date}', ${JSON.stringify(day.tasks).replace(/"/g, '&quot;')}, '${className}')">
            + Add to ${isToday ? 'today' : day.label.split(',')[0]}'s tasks
          </button>
        </div>`;
    }).join('')}`;
}

async function addPlanDayToToday(date, tasks, className) {
  const tag = className === 'Algebra 2' ? 'Math' : className === 'English 3' ? 'English' : 'Econ';
  const existing = await getTasks(date);
  for (const task of tasks) {
    if (!existing.find(t => t.text === task)) {
      await createTask(date, task, tag, '');
    }
  }
  // If adding to current view date, refresh
  if (date === currentDate) {
    const tasks2 = await getTasks(currentDate);
    renderTasks(tasks2);
  }
  alert(`Added ${tasks.length} task(s) to ${date === currentDate ? 'today' : date}.`);
}
