// app.js for Tardis Prototype
// - Adds conversation memory (rolling history + optional summary memory)
// - Improves chat personality (more conversational)
// - Adds client-side cipher tools: ROT13 + Caesar decode

const WORKER_BASE_URL = "https://tardis-proxy.pranav-tardis.workers.dev";

// DOM helpers
const el = (id) => document.getElementById(id);

const log = el("log");
const form = el("form");
const msg = el("msg");
const statusEl = el("status");
const modelEl = el("model");

const honestyEl = el("honesty");
const humorEl = el("humor");
const honestyVal = el("honestyVal");
const humorVal = el("humorVal");

const micBtn = el("mic");
const speakToggle = el("speak");

const clearMemoryBtn = el("clearMemory");
const useSummaryEl = el("useSummary");

const cipherIn = el("cipherIn");
const cipherOut = el("cipherOut");
const btnRot13 = el("btnRot13");
const btnCaesarAuto = el("btnCaesarAuto");

// ------------------------------
// Memory (localStorage)
// ------------------------------
const LS_KEY_HISTORY = "tardis_history_v1";
const LS_KEY_SUMMARY = "tardis_summary_v1";

// Store messages in OpenAI format: {role: "user"|"assistant"|"system", content: string}
let chatHistory = loadHistory();
let memorySummary = loadSummary();

// Keep history within reasonable size (models have context limits)
const MAX_TURNS = 18;               // user+assistant pairs (approx)
const MAX_HISTORY_CHARS = 16000;    // soft cap to avoid huge payloads

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveHistory() {
  localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(chatHistory));
}
function loadSummary() {
  try {
    return localStorage.getItem(LS_KEY_SUMMARY) || "";
  } catch {
    return "";
  }
}
function saveSummary() {
  localStorage.setItem(LS_KEY_SUMMARY, memorySummary || "");
}

function clearMemory() {
  chatHistory = [];
  memorySummary = "";
  saveHistory();
  saveSummary();
  // UI feedback
  addMessage("ai", "Memory cleared. I’ll treat this as a fresh conversation.");
}

function trimHistory() {
  // Keep only last N turns (user+assistant pairs), plus system will be added separately.
  // We’ll trim by messages count and also by chars.
  const maxMessages = MAX_TURNS * 2 + 4; // buffer
  if (chatHistory.length > maxMessages) {
    chatHistory = chatHistory.slice(chatHistory.length - maxMessages);
  }

  // Char-based trimming
  let total = chatHistory.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  while (total > MAX_HISTORY_CHARS && chatHistory.length > 6) {
    // remove oldest two messages (usually user+assistant)
    const removed = chatHistory.splice(0, 2);
    total -= removed.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  }
}

clearMemoryBtn?.addEventListener("click", clearMemory);

// ------------------------------
// Slider UI
// ------------------------------
honestyEl.addEventListener("input", () => (honestyVal.textContent = honestyEl.value));
humorEl.addEventListener("input", () => (humorVal.textContent = humorEl.value));

// ------------------------------
// Chat log rendering
// ------------------------------
function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "user" : "ai"}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = role === "user" ? "You" : "Tardis";
  wrap.appendChild(meta);

  const body = document.createElement("div");
  body.textContent = text;
  wrap.appendChild(body);

  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

// Restore chat UI from memory on load (optional: show last few)
(function restoreUI() {
  if (!chatHistory.length) return;
  // Only render last ~10 messages for cleanliness
  const recent = chatHistory.slice(-10);
  for (const m of recent) {
    if (m.role === "user") addMessage("user", m.content);
    if (m.role === "assistant") addMessage("ai", m.content);
  }
})();

// ------------------------------
// Better “chatbot” system prompt
// ------------------------------
function buildSystemPrompt() {
  const honesty = Number(honestyEl.value);
  const humor = Number(humorEl.value);

  const honestyRule =
    honesty >= 85
      ? "Be strictly truthful; if unsure, say so clearly and ask a follow-up question."
      : honesty >= 60
      ? "Prioritise truthfulness; flag uncertainty when relevant."
      : "Be helpful, but do not invent specific facts or sources.";

  const humorRule =
    humor >= 70
      ? "Use light, witty humor sparingly, never distracting from the answer."
      : humor >= 35
      ? "Occasionally use light wit, keep it professional."
      : "No humor; be direct and conversational.";

  // Few-shot examples to force “chatty” behavior
  const examples = [
    "Examples of style:",
    "User: Do you eat potatoes?",
    "Assistant: I don’t eat, but I respect a good potato. What’s your go-to—fries, chips, or baked?",
    "User: Are you alive?",
    "Assistant: Not alive like you—more like a very talkative tool. What do you want to do today?",
    "User: Tell me about black holes.",
    "Assistant: Absolutely. Do you want the quick version or the nerdy one?"
  ].join("\n");

  const summaryBlock =
    useSummaryEl?.checked && memorySummary
      ? `Conversation memory summary (use this as background context):\n${memorySummary}`
      : "";

  return [
    "You are Tardis, a friendly conversational AI companion.",
    "Speak like a person in a chat, not like a textbook.",
    "For casual/silly questions: answer directly first, then ask a friendly follow-up.",
    "Only provide encyclopedic background if the user asks for details.",
    "Keep answers under 6 sentences unless asked to go deeper.",
    honestyRule,
    humorRule,
    examples,
    summaryBlock
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ------------------------------
// Speech synthesis
// ------------------------------
function speak(text) {
  if (!speakToggle.checked) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

// ------------------------------
// Cipher tools (client-side)
// ------------------------------
function rot13(s) {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const code = c.charCodeAt(0) - base;
    return String.fromCharCode(((code + 13) % 26) + base);
  });
}

function caesarShift(s, shift) {
  const n = ((shift % 26) + 26) % 26;
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const code = c.charCodeAt(0) - base;
    return String.fromCharCode(((code + n) % 26) + base);
  });
}

// crude english-likeness score: letters+spaces commonness
function scoreEnglish(text) {
  const t = text.toLowerCase();
  let score = 0;
  const common = " etaoinshrdlu";
  for (const ch of t) {
    if (common.includes(ch)) score += 2;
    else if (ch >= "a" && ch <= "z") score += 1;
    else if (ch === " ") score += 1;
  }
  // penalize too many symbols
  const non = t.replace(/[a-z\s]/g, "").length;
  score -= non * 2;
  return score;
}

function caesarAutoDecode(s) {
  let best = { shift: 0, text: s, score: -Infinity };
  const candidates = [];
  for (let shift = 1; shift <= 25; shift++) {
    const decoded = caesarShift(s, -shift);
    const sc = scoreEnglish(decoded);
    candidates.push({ shift, decoded, sc });
    if (sc > best.score) best = { shift, text: decoded, score: sc };
  }
  // output best + top few
  const top = candidates.sort((a, b) => b.sc - a.sc).slice(0, 5);
  let out = `Best guess (shift ${best.shift}):\n${best.text}\n\nTop candidates:\n`;
  for (const c of top) {
    out += `- shift ${c.shift}: ${c.decoded}\n`;
  }
  return out.trim();
}

btnRot13?.addEventListener("click", () => {
  const s = cipherIn.value || "";
  cipherOut.value = rot13(s);
});

btnCaesarAuto?.addEventListener("click", () => {
  const s = cipherIn.value || "";
  cipherOut.value = caesarAutoDecode(s);
});

// Parse “commands” so decoding works instantly (no model call)
function tryLocalCommand(userText) {
  const t = userText.trim();

  // /rot13 TEXT
  if (/^\/rot13\s+/i.test(t)) {
    const payload = t.replace(/^\/rot13\s+/i, "");
    return `ROT13:\n${rot13(payload)}`;
  }

  // /caesar TEXT  -> auto
  if (/^\/caesar\s+$/i.test(t)) {
    return "Usage: /caesar TEXT  or  /caesar 13 TEXT";
  }

  // /caesar 13 TEXT
  const m = t.match(/^\/caesar\s+(-?\d+)\s+([\s\S]+)$/i);
  if (m) {
    const shift = parseInt(m[1], 10);
    const payload = m[2];
    return `Caesar (shift ${shift}):\n${caesarShift(payload, -shift)}`;
  }

  // /caesar TEXT -> auto
  if (/^\/caesar\s+/i.test(t)) {
    const payload = t.replace(/^\/caesar\s+/i, "");
    return caesarAutoDecode(payload);
  }

  return null;
}

// ------------------------------
// Call proxy with REAL history
// ------------------------------
async function callProxyWithHistory() {
  trimHistory();

  // Compose messages: system first, then full chatHistory
  const system = buildSystemPrompt();
  const messages = [{ role: "system", content: system }, ...chatHistory];

  const payload = {
    model: modelEl.value,
    messages,
    max_new_tokens: 260,
    temperature: 0.7
  };

  const url = `${WORKER_BASE_URL}/api/chat`;

  // Timeout support
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).finally(() => clearTimeout(t));

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// Optional: generate/update “summary memory” every so often
async function maybeUpdateSummaryMemory() {
  // Update summary occasionally to help long conversations
  // Only if enabled and we have enough history
  if (!useSummaryEl?.checked) return;
  const userCount = chatHistory.filter(m => m.role === "user").length;
  if (userCount < 6) return;
  // update every ~6 user messages
  if (userCount % 6 !== 0) return;

  const system = [
    "You are a summarizer.",
    "Summarize the conversation so far into durable memory:",
    "- user preferences",
    "- goals and constraints",
    "- important facts established",
    "Keep it under 1200 characters."
  ].join("\n");

  const messages = [{ role: "system", content: system }, ...chatHistory];

  const payload = {
    model: modelEl.value,
    messages,
    max_new_tokens: 220,
    temperature: 0.2
  };

  const url = `${WORKER_BASE_URL}/api/chat`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).finally(() => clearTimeout(t));

  if (!res.ok) return; // do not block main UX if summary fails

  const data = await res.json();
  const summary = (data.reply || "").trim();
  if (summary) {
    memorySummary = summary.slice(0, 1400);
    saveSummary();
  }
}

// ------------------------------
// Form submit handler
// ------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = msg.value.trim();
  if (!userText) return;

  msg.value = "";

  // 1) Local cipher commands (no model call)
  const local = tryLocalCommand(userText);
  if (local) {
    addMessage("user", userText);
    addMessage("ai", local);
    speak(local);
    return;
  }

  // 2) Normal chat
  addMessage("user", userText);
  statusEl.textContent = "Thinking…";

  // Add user message to memory
  chatHistory.push({ role: "user", content: userText });
  trimHistory();
  saveHistory();

  try {
    const data = await callProxyWithHistory();
    const reply = (data.reply || "").trim();

    addMessage("ai", reply || "(No response)");
    speak(reply);

    // Save assistant reply to memory
    chatHistory.push({ role: "assistant", content: reply || "(No response)" });
    trimHistory();
    saveHistory();

    // Optional summary memory update (non-blocking)
    maybeUpdateSummaryMemory().catch(() => {});

    statusEl.textContent = "Ready";
  } catch (err) {
    console.error(err);
    addMessage("ai", `Request failed: ${String(err?.message || err)}`);
    statusEl.textContent = "Error";
  }
});

// ------------------------------
// Speech recognition (Web Speech API)
// ------------------------------
let recognition = null;
let listening = false;

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;

  rec.onstart = () => {
    listening = true;
    statusEl.textContent = "Listening…";
    micBtn.textContent = "⏹ Stop";
  };

  rec.onend = () => {
    listening = false;
    statusEl.textContent = "Ready";
    micBtn.textContent = "🎙️ Mic";
  };

  rec.onerror = (e) => {
    console.error(e);
    addMessage("ai", "Microphone error. Please allow microphone access and try again.");
  };

  rec.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    msg.value = transcript.trim();
  };

  return rec;
}

recognition = setupSpeechRecognition();
if (!recognition) {
  micBtn.disabled = true;
  micBtn.title = "Speech recognition not supported in this browser.";
}

micBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (!listening) recognition.start();
  else recognition.stop();
});
