// app.js for Tardis Prototype
//
// This script powers the interactive behaviour of the Tardis Prototype page.
// It manages the chat log, slider interactions, speech recognition and
// synthesis, and communicates with a Cloudflare Worker that proxies
// language model requests.  To use this file in your own deployment,
// replace WORKER_BASE_URL with the URL of your Worker (without a
// trailing slash).

// TODO: After deploying your Cloudflare Worker, set this constant to the
// base URL of your worker (e.g. "https://tardis-proxy.<your-subdomain>.workers.dev").
const WORKER_BASE_URL = "https://tardis-proxy.pranav-tardis.workers.dev";

// Grab references to important DOM elements
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

// Update slider display values on input
honestyEl.addEventListener("input", () => {
  honestyVal.textContent = honestyEl.value;
});
humorEl.addEventListener("input", () => {
  humorVal.textContent = humorEl.value;
});

// Append a message to the chat log
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
  // Scroll to the bottom of the log
  log.scrollTop = log.scrollHeight;
}

// Build a system prompt based on slider settings
function buildSystemPrompt() {
  const honesty = Number(honestyEl.value);
  const humor = Number(humorEl.value);

  const honestyRule =
    honesty >= 85
      ? "Be strictly truthful; if unsure, explicitly say so and suggest how to verify."
      : honesty >= 60
      ? "Prioritise truthfulness; flag uncertainty when relevant."
      : "Be helpful, but do not invent specific facts or sources.";

  const humorRule =
    humor >= 70
      ? "Use dry, understated humour sparingly where appropriate."
      : humor >= 35
      ? "Occasionally use light wit, but keep it professional."
      : "No humour; be direct and mission‑focused.";

  return [
    "You are Tardis: a practical, safety‑bounded mission assistant inspired by science fiction.",
    honestyRule,
    humorRule,
    "Keep responses concise but complete.",
    "If asked for dangerous wrongdoing, refuse and redirect to safe alternatives."
  ].join("\n");
}

// Use the browser's speech synthesis API to read a message aloud
function speak(text) {
  if (!speakToggle.checked) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Send a chat request to the Cloudflare Worker proxy
async function callProxy(userText) {
  const payload = {
    model: modelEl.value,
    system: buildSystemPrompt(),
    message: userText,
    max_new_tokens: 220,
    temperature: 0.6
  };
  const url = `${WORKER_BASE_URL}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

// Handle form submissions
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = msg.value.trim();
  if (!userText) return;
  msg.value = "";
  addMessage("user", userText);
  statusEl.textContent = "Thinking…";
  try {
    const data = await callProxy(userText);
    const reply = (data.reply || "").trim();
    addMessage("ai", reply || "(No response)");
    speak(reply);
    statusEl.textContent = "Ready";
  } catch (err) {
    console.error(err);
    addMessage(
      "ai",
      "Request failed. The proxy may be warming up or rate‑limited. Please try again later."
    );
    statusEl.textContent = "Error";
  }
});

// Speech recognition (Web Speech API)
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
    addMessage(
      "ai",
      "Microphone error. Please allow microphone access and try again."
    );
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