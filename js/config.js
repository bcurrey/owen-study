// ── CONFIG ──
// Store/retrieve credentials from localStorage
const CONFIG_KEY = 'owenStudyConfig';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); } catch { return null; }
}

function saveConfig() {
  const url = document.getElementById('cfgUrl').value.trim();
  const key = document.getElementById('cfgKey').value.trim();
  const anthro = document.getElementById('cfgAnthro').value.trim();
  if (!url || !key || !anthro) { alert('Please fill in all fields.'); return; }
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ supabaseUrl: url, supabaseKey: key, anthropicKey: anthro }));
  window.location.reload();
}

// Owen's profile — baked in, used by all AI calls
const OWEN_PROFILE = `Student profile: Owen Currey, Junior doing virtual high school.
Classes:
- Algebra 2: live instruction 1hr/day, tests + assignments, confidence 3/5 (weakest — needs most attention)
- English 3: PowerPoints + videos, tests + assignments, confidence 4/5
- Economics: PowerPoints + videos, tests + assignments, confidence 5/5 (strongest)
Schedule: primary study 10am–12:30pm, backup 10pm–11:30pm. Best focus: 10am and 10pm. Avoid 2–3pm.
Outside commitments: sports, recovery from injury, work, gym.
Falls behind when: sick or forgets.
Math test: end of every month (predictable, recurring).`;

// Call Anthropic API
async function callClaude(messages, systemPrompt, onChunk) {
  const cfg = getConfig();
  if (!cfg) throw new Error('No config');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages,
      stream: onChunk ? true : false,
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  if (onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text;
              onChunk(data.delta.text, fullText);
            }
          } catch {}
        }
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    return data.content[0].text;
  }
}
