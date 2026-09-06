// ── DATABASE (Supabase) ──
let supabaseClient = null;

function initSupabase() {
  const cfg = getConfig();
  if (!cfg) return false;
  const { createClient } = supabase;
  supabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  return true;
}

// ── TASKS ──
async function getTasks(dateStr) {
  const { data } = await supabaseClient.from('tasks').select('*').eq('date', dateStr).order('created_at');
  return data || [];
}

async function createTask(dateStr, text, tag, time) {
  const { data } = await supabaseClient.from('tasks').insert({
    date: dateStr, text, tag, time, done: false
  }).select().single();
  return data;
}

async function toggleTask(id, done) {
  await supabaseClient.from('tasks').update({ done }).eq('id', id);
}

async function deleteTask(id) {
  await supabaseClient.from('tasks').delete().eq('id', id);
}

// ── QUIZ RESULTS ──
async function saveQuizResult(className, topic, score, total, wrongTopics, rightTopics) {
  const { data } = await supabaseClient.from('quiz_results').insert({
    class_name: className,
    topic: topic || 'General review',
    score,
    total,
    pct: Math.round((score / total) * 100),
    wrong_topics: wrongTopics,
    right_topics: rightTopics,
    taken_at: new Date().toISOString()
  }).select().single();
  return data;
}

async function getQuizHistory(limit = 50) {
  const { data } = await supabaseClient.from('quiz_results').select('*').order('taken_at', { ascending: false }).limit(limit);
  return data || [];
}

// ── STUDY PLANS ──
async function saveStudyPlan(className, testDate, planJson) {
  await supabaseClient.from('study_plans').delete().eq('class_name', className).eq('test_date', testDate);
  const { data } = await supabaseClient.from('study_plans').insert({
    class_name: className,
    test_date: testDate,
    plan: planJson,
    created_at: new Date().toISOString()
  }).select().single();
  return data;
}

async function getUpcomingPlans() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseClient.from('study_plans').select('*').gte('test_date', today).order('test_date');
  return data || [];
}

async function getAllPlans() {
  const { data } = await supabaseClient.from('study_plans').select('*').order('test_date');
  return data || [];
}

// ── STREAK ──
async function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabaseClient.from('streaks').select('*').eq('date', today).single();
  if (!existing) {
    await supabaseClient.from('streaks').insert({ date: today });
  }
  const { data: streakData } = await supabaseClient.from('streaks').select('date').order('date', { ascending: false }).limit(60);
  if (!streakData) return 0;
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = d.toISOString().split('T')[0];
    if (streakData.find(r => r.date === ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
