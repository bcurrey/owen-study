// ── HISTORY ──
function switchHistoryTab(tab, el) {
  document.querySelectorAll('.htab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.history-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('hist' + (tab === 'quizzes' ? 'Quizzes' : 'Tasks')).classList.add('active');
  if (tab === 'quizzes') loadQuizHistory();
  else loadTaskHistory(new Date().toISOString().split('T')[0]);
}

async function loadQuizHistory() {
  const el = document.getElementById('quizHistoryList');
  el.innerHTML = '<div class="loading"><span class="spinner"></span>Loading...</div>';

  const results = await getQuizHistory();
  if (results.length === 0) {
    el.innerHTML = '<div class="loading">No quiz history yet. Take your first quiz!</div>';
    return;
  }

  // Group by class for summary
  const byClass = {};
  results.forEach(r => {
    if (!byClass[r.class_name]) byClass[r.class_name] = [];
    byClass[r.class_name].push(r);
  });

  // Show overall trend first
  let summaryHtml = '<div class="card" style="margin-bottom:16px">';
  summaryHtml += '<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em">Class averages</div>';
  for (const [cls, scores] of Object.entries(byClass)) {
    const avg = Math.round(scores.reduce((s, r) => s + r.pct, 0) / scores.length);
    summaryHtml += `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:14px;font-weight:500">${cls}</span>
        <span style="font-size:16px;font-weight:700;color:${avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--amber)' : 'var(--red)'}">${avg}%</span>
      </div>
      <div class="progress-bar-bg" style="margin-bottom:12px">
        <div class="progress-bar-fill" style="width:${avg}%;background:${avg >= 80 ? 'var(--green)' : avg >= 60 ? 'var(--amber)' : 'var(--red)'}"></div>
      </div>`;
  }
  summaryHtml += '</div>';

  // Individual results
  const resultsHtml = results.map(r => {
    const date = new Date(r.taken_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const passed = r.pct >= 80;
    return `
      <div class="quiz-history-item">
        <div class="qhi-top">
          <div class="qhi-class">${r.class_name}</div>
          <div class="qhi-score ${passed ? 'pass' : 'fail'}">${r.pct}%</div>
        </div>
        <div class="qhi-date">${date} · ${r.topic} · ${r.score}/${r.total} correct</div>
        <div class="qhi-detail">
          ${r.right_topics && r.right_topics.length > 0 ? r.right_topics.map(t => `<span class="strong-tag">✓ ${t}</span>`).join('') : ''}
          ${r.wrong_topics && r.wrong_topics.length > 0 ? r.wrong_topics.map(t => `<span class="weak-tag">✗ ${t}</span>`).join('') : ''}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = summaryHtml + resultsHtml;
}

async function loadHistoryDate(dateStr) {
  await loadTaskHistory(dateStr);
}

async function loadTaskHistory(dateStr) {
  const el = document.getElementById('taskHistoryList');
  if (!dateStr) return;
  el.innerHTML = '<div class="loading"><span class="spinner"></span>Loading...</div>';

  const tasks = await getTasks(dateStr);
  if (tasks.length === 0) {
    el.innerHTML = '<div class="loading">No tasks recorded for this date.</div>';
    return;
  }

  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);
  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:16px;font-weight:600;margin-bottom:4px">${dateLabel}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${done} of ${tasks.length} tasks completed · ${pct}%</div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'}"></div></div>
    </div>
    ${tasks.map(t => `
      <div class="todo ${t.done ? 'done' : ''}" style="cursor:default">
        <div class="todo-check">${t.done ? '✓' : ''}</div>
        <div>
          <div class="todo-title"><span class="tag tag-${t.tag}">${t.tag}</span>${t.text}</div>
          ${t.time ? `<div class="todo-meta">${t.time}</div>` : ''}
        </div>
      </div>`).join('')}`;
}
