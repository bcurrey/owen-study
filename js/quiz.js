// ── QUIZ ENGINE ──
let quizState = {
  questions: [],
  current: 0,
  correct: 0,
  results: [], // {question, correct, userAnswer, rightAnswer, topic}
  className: '',
  topic: '',
};

async function startQuiz() {
  const className = document.getElementById('quizClass').value;
  const topic = document.getElementById('quizTopic').value.trim();
  const count = parseInt(document.getElementById('quizCount').value);

  quizState = { questions: [], current: 0, correct: 0, results: [], className, topic };

  document.getElementById('quizSetup').classList.add('hidden');
  document.getElementById('quizSession').classList.remove('hidden');
  document.getElementById('quizResults').classList.add('hidden');
  document.getElementById('quizQuestion').innerHTML = '<div class="loading"><span class="spinner"></span>Generating questions...</div>';
  document.getElementById('quizOptions').innerHTML = '';
  document.getElementById('quizFeedback').classList.add('hidden');
  document.getElementById('quizNextBtn').classList.add('hidden');

  try {
    const questionsJson = await generateQuizQuestions(className, topic, count);
    quizState.questions = questionsJson;
    showQuestion(0);
  } catch(e) {
    document.getElementById('quizQuestion').innerHTML = '<div class="loading">Error generating quiz. Check your API key in config.</div>';
  }
}

async function generateQuizQuestions(className, topic, count) {
  const isAlgebra = className === 'Algebra 2';
  const sys = `You are a quiz generator for a high school virtual student. ${OWEN_PROFILE}
Generate exactly ${count} multiple-choice questions for ${className}${topic ? ' on the topic: ' + topic : ' as a general review'}.
${isAlgebra ? 'For Algebra 2, include procedural problems (solving equations, factoring, graphing). Show the math problem clearly.' : ''}
Return ONLY a JSON array. No markdown, no preamble. Format:
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","topic":"...","explanation":"..."}]
The "topic" field should be a short 2-4 word label for what concept this question tests.
The "explanation" field should explain why the answer is correct in 2-3 sentences.`;

  const raw = await callClaude([{ role: 'user', content: `Generate ${count} questions for ${className}${topic ? ' topic: ' + topic : ''}.` }], sys);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function showQuestion(index) {
  const q = quizState.questions[index];
  const total = quizState.questions.length;

  document.getElementById('quizProgressText').textContent = `Question ${index + 1} of ${total}`;
  document.getElementById('quizScoreText').textContent = `Score: ${Math.round((quizState.correct / Math.max(index, 1)) * 100)}%`;
  document.getElementById('quizProgressBar').style.width = `${(index / total) * 100}%`;
  document.getElementById('quizFeedback').classList.add('hidden');
  document.getElementById('quizNextBtn').classList.add('hidden');

  document.getElementById('quizQuestion').innerHTML = `<div style="font-size:13px;color:var(--muted);margin-bottom:8px">${q.topic}</div>${q.question}`;

  document.getElementById('quizOptions').innerHTML = q.options.map((opt, i) => `
    <button class="quiz-option" onclick="answerQuestion(${i}, '${opt.charAt(0)}')">${opt}</button>
  `).join('');
}

async function answerQuestion(optionIndex, letter) {
  const q = quizState.questions[quizState.current];
  const isCorrect = letter === q.answer;
  const buttons = document.querySelectorAll('.quiz-option');

  buttons.forEach((btn, i) => {
    btn.classList.add('disabled');
    const btnLetter = q.options[i].charAt(0);
    if (btnLetter === q.answer) btn.classList.add('correct');
    else if (i === optionIndex && !isCorrect) btn.classList.add('wrong');
  });

  if (isCorrect) quizState.correct++;

  quizState.results.push({
    question: q.question,
    correct: isCorrect,
    userAnswer: q.options[optionIndex],
    rightAnswer: q.options.find(o => o.charAt(0) === q.answer),
    topic: q.topic,
    explanation: q.explanation
  });

  const fb = document.getElementById('quizFeedback');
  fb.className = 'quiz-feedback ' + (isCorrect ? 'correct-fb' : 'wrong-fb');
  fb.innerHTML = isCorrect
    ? `<strong>✓ Correct!</strong> ${q.explanation}`
    : `<strong>✗ Not quite.</strong> The correct answer is <strong>${q.options.find(o => o.charAt(0) === q.answer)}</strong>. ${q.explanation}`;
  fb.classList.remove('hidden');

  const nextBtn = document.getElementById('quizNextBtn');
  const isLast = quizState.current === quizState.questions.length - 1;
  nextBtn.textContent = isLast ? 'See results' : 'Next question';
  nextBtn.classList.remove('hidden');
}

function nextQuestion() {
  quizState.current++;
  if (quizState.current >= quizState.questions.length) {
    showResults();
  } else {
    showQuestion(quizState.current);
  }
}

async function showResults() {
  document.getElementById('quizSession').classList.add('hidden');
  document.getElementById('quizResults').classList.remove('hidden');

  const total = quizState.questions.length;
  const correct = quizState.correct;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= 80;

  document.getElementById('resultsScore').textContent = pct + '%';
  document.getElementById('resultsScore').style.color = passed ? 'var(--green)' : 'var(--red)';
  document.getElementById('resultsLabel').textContent = passed ? '✓ Passed' : '✗ Below 80% — let\'s fix that';

  // Breakdown by topic
  const wrongTopics = [...new Set(quizState.results.filter(r => !r.correct).map(r => r.topic))];
  const rightTopics = [...new Set(quizState.results.filter(r => r.correct).map(r => r.topic))];

  let breakdownHtml = `<div class="breakdown-item"><span>Correct</span><span class="breakdown-correct">${correct} / ${total}</span></div>`;
  if (wrongTopics.length > 0) breakdownHtml += `<div class="breakdown-item"><span>Needs work</span><span>${wrongTopics.map(t => `<span class="weak-tag">${t}</span>`).join('')}</span></div>`;
  if (rightTopics.length > 0) breakdownHtml += `<div class="breakdown-item"><span>Strong</span><span>${rightTopics.map(t => `<span class="strong-tag">${t}</span>`).join('')}</span></div>`;
  document.getElementById('resultsBreakdown').innerHTML = breakdownHtml;

  // Save to DB
  await saveQuizResult(quizState.className, quizState.topic, correct, total, wrongTopics, rightTopics);

  // Actions
  const actionsEl = document.getElementById('resultsActions');
  if (passed) {
    actionsEl.innerHTML = `
      <button class="primary-btn" onclick="resetQuiz()">Take another quiz</button>`;
  } else {
    actionsEl.innerHTML = `
      <button class="primary-btn" style="background:var(--amber)" onclick="startRemediation()">Explain what I missed</button>
      <button class="secondary-btn" style="margin-top:8px" onclick="retryQuiz()">Retry quiz now</button>`;
  }

  document.getElementById('remediation').classList.add('hidden');
}

async function startRemediation() {
  const remEl = document.getElementById('remediation');
  remEl.classList.remove('hidden');
  remEl.innerHTML = `
    <div class="remediation-card">
      <div class="remediation-header">📚 Let's work through what you missed</div>
      <div class="ai-response" id="remediationText"><span class="typing-indicator">Working through your missed questions...</span></div>
      <div id="remediationFollowup" style="margin-top:16px;display:none">
        <div class="form-group">
          <input type="text" id="followupInput" placeholder="Ask a question about anything you're still confused on...">
        </div>
        <button class="primary-btn" style="background:var(--amber)" onclick="sendFollowup()">Ask</button>
      </div>
      <button class="primary-btn" id="retryAfterExplainBtn" style="margin-top:16px;display:none" onclick="retryQuiz()">
        I'm ready — retry the quiz
      </button>
    </div>`;

  remEl.scrollIntoView({ behavior: 'smooth' });

  const wrongItems = quizState.results.filter(r => !r.correct);
  const isAlgebra = quizState.className === 'Algebra 2';

  const sys = `You are a patient, direct tutor for Owen Currey, a 17-year-old junior in virtual high school. ${OWEN_PROFILE}
${isAlgebra ? `
IMPORTANT: Owen is working on Algebra 2, his weakest class. For every missed question:
1. Explain the concept in plain English with a real-world analogy
2. Show the full step-by-step solution with the work shown clearly
3. Give a similar practice problem and walk through it
4. State the one rule to remember
Be thorough with algebra — show all the work.` : `
For each missed question, explain clearly what the right answer is and why. Use examples. Be direct, not wordy.`}
After covering all missed questions, invite Owen to ask follow-up questions about anything still unclear.`;

  const userMsg = `I just took a ${quizState.className} quiz and got these wrong:\n\n${wrongItems.map((r, i) =>
    `${i+1}. Question: ${r.question}\nMy answer: ${r.userAnswer}\nCorrect answer: ${r.rightAnswer}\nTopic: ${r.topic}`
  ).join('\n\n')}\n\nPlease explain each one, showing me exactly what I should know.`;

  const textEl = document.getElementById('remediationText');
  textEl.innerHTML = '';

  await callClaude([{ role: 'user', content: userMsg }], sys, (chunk, full) => {
    textEl.innerHTML = full.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  });

  document.getElementById('remediationFollowup').style.display = 'block';
  document.getElementById('retryAfterExplainBtn').style.display = 'block';
}

let remediationHistory = [];

async function sendFollowup() {
  const input = document.getElementById('followupInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  const isAlgebra = quizState.className === 'Algebra 2';
  const sys = `You are a patient, direct tutor for Owen Currey. ${OWEN_PROFILE}
${isAlgebra ? 'Owen is working on Algebra 2. Always show full step-by-step work for any math problem.' : 'Be clear and direct.'}
Answer his follow-up question about the material he just missed.`;

  const textEl = document.getElementById('remediationText');
  textEl.innerHTML += `<br><br><strong style="color:var(--accent)">Owen: ${question}</strong><br><br>`;

  remediationHistory.push({ role: 'user', content: question });

  let responseText = '';
  await callClaude(remediationHistory, sys, (chunk, full) => {
    responseText = full;
    // Append just the new response
    const parts = textEl.innerHTML.split(`<strong style="color:var(--accent)">Owen: ${question}</strong><br><br>`);
    if (parts.length > 1) {
      textEl.innerHTML = parts[0] + `<strong style="color:var(--accent)">Owen: ${question}</strong><br><br>` + full.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
  });
  remediationHistory.push({ role: 'assistant', content: responseText });
}

function retryQuiz() {
  quizState = { ...quizState, current: 0, correct: 0, results: [], questions: [] };
  document.getElementById('quizResults').classList.add('hidden');
  document.getElementById('quizSetup').classList.remove('hidden');
  document.getElementById('quizClass').value = quizState.className;
  document.getElementById('quizTopic').value = quizState.topic;
}

function resetQuiz() {
  document.getElementById('quizResults').classList.add('hidden');
  document.getElementById('quizSetup').classList.remove('hidden');
}
