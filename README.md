# TARDIS Prototype — Conversational AI Assistant

I built this **TARDIS-inspired AI chatbot** as a lightweight, web-deployable conversational assistant.  
It is intended for **simple, natural conversations** and supports **both text and audio input/output** via browser APIs.

Beyond basic chat, the project implements:
- A **simulated long-term memory framework** for maintaining conversational context
- **Client-side cipher decoding tools** (Caesar / ROT13) aligned with the TARDIS theme
- A secure **serverless AI proxy** to protect API credentials
- A one-click **landing experience** suitable for non-technical users

The entire system is deployable as a static site + serverless backend, requiring no local runtime for end users.

---

## Live Demo
- **Landing page:**  
  `https://pranavkkp4.github.io/Tardis-Prototype/welcome.html`
- **AI assistant:**  
  `https://pranavkkp4.github.io/Tardis-Prototype/`

---

## Architecture Overview

**Frontend**
- Static HTML / CSS / JavaScript
- Hosted on **GitHub Pages**
- Uses:
  - Web Speech API (speech recognition + text-to-speech)
  - LocalStorage for conversation memory
  - Client-side cipher decoding (ROT13 / Caesar)

**Backend**
- **Cloudflare Workers** (serverless)
- Secure proxy to **Hugging Face Inference Router**
- OpenAI-compatible `/v1/chat/completions` API
- Prevents exposing Hugging Face tokens to the browser
- Handles CORS and request validation

**AI Model**
- `google/gemma-2-2b-it`
- Selected for instruction-following and low-latency conversational use

---

## Key Features

### Conversational Memory
- Rolling chat history is sent with each request
- Optional **summary memory** compresses long conversations
- Memory persists across page reloads using `localStorage`
- Memory can be manually cleared from the UI

### Cipher & Decoding Tools
- Built-in Caesar cipher decoding
- Automatic Caesar shift detection
- ROT13 decoding
- Available via:
  - UI panel
  - Chat commands (`/caesar`, `/rot13`)
- Fully client-side (no API calls)

### Voice Interaction
- Speech-to-text input (Web Speech API)
- Text-to-speech output
- Toggleable per user preference

### Landing Experience
- Minimal navy-blue intro page
- Typewriter animation
- One-click entry into the assistant
- No routing frameworks required

---

## Project Structure

<img width="410" height="202" alt="image" src="https://github.com/user-attachments/assets/6c18209f-2e8b-4749-8ae7-012298dbcaa4" />


---

## How to Run This Project Yourself

### 1. Clone the Repository
```bash
git clone https://github.com/pranavkkp4/Tardis-Prototype.git
cd Tardis-Prototype
2. Deploy the Frontend (GitHub Pages)
Push to main

Enable GitHub Pages

Set source to root

No build step required.

3. Deploy the Backend (Cloudflare Worker)
Requirements
Cloudflare account

Node.js

Wrangler CLI

bash
Copy code
npm install -g wrangler
Configure Secrets
bash
Copy code
cd tardis-prototype-proxy
wrangler secret put HF_TOKEN
Your Hugging Face token must allow:

Inference Providers access

Deploy
bash
Copy code
wrangler deploy
4. Connect Frontend to Backend
Ensure app.js contains:

js
Copy code
const WORKER_BASE_URL = "https://<your-worker>.workers.dev";
Why This Project
This project demonstrates:

Serverless architecture

Secure AI API usage

Conversational UX design

Stateful chat without databases

Browser-native speech interfaces

Practical debugging and deployment workflows

It was built to be simple, explainable, and easily shareable, while still showcasing real-world AI integration.
