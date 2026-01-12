# Tardis Prototype – Cloudflare Worker (Proxy)

This directory contains a simple [Cloudflare Worker](https://workers.cloudflare.com/) that acts
as a **proxy** between the client‐side Tardis Prototype site and the
[Hugging Face Inference Providers API](https://huggingface.co/docs/inference-providers/en/index).

## Why a proxy?

The Tardis Prototype site is served from a static host (e.g. GitHub Pages) and
cannot securely store API keys or tokens.  The proxy protects your Hugging
Face user token, adds the necessary CORS headers so browsers can access the
endpoint from your domain, and sanitises requests before they reach the
inference API.

## Prerequisites

1. **Cloudflare account:** Sign up for a free Cloudflare account at
   <https://dash.cloudflare.com> if you do not already have one.  The Workers
   Free plan includes generous limits, allowing up to **100,000 requests per
   day**【194781770227445†L670-L674】.  Requests exceeding this limit will result in
   1027 errors unless you upgrade or split traffic across multiple accounts.
2. **Hugging Face account:** Create a free account at
   <https://huggingface.co> and generate a **User Access Token**.  Hugging
   Face provides monthly credits ($0.10 for free users, $2.00 for PRO
   subscribers) to experiment with inference providers【454530958302295†L90-L103】.
   Requests beyond your credits will result in errors unless you upgrade.
3. **Node.js & npm:** Install Node.js (v18 or later) and npm from
   <https://nodejs.org>.  You will need them to install Cloudflare’s `wrangler`
   CLI.

## Installation

1. Install the Wrangler CLI globally:

   ```bash
   npm install -g wrangler
   ```

2. Log in to Cloudflare via Wrangler.  This will open a browser window:

   ```bash
   wrangler login
   ```

3. Clone or download this repository and navigate into the proxy folder:

   ```bash
   cd tardis-prototype-proxy
   ```

4. Add your Hugging Face User Access Token as a secret.  Do **not** commit
   this token to GitHub:

   ```bash
   wrangler secret put HF_TOKEN
   ```

   Paste your token when prompted.  This token authorises the worker to
   perform inference requests on your behalf.

5. (Optional) Restrict CORS by setting an `ALLOWED_ORIGIN` secret.  This
   should match your GitHub Pages domain (e.g.
   `https://yourusername.github.io`).  Leaving it unset or `*` will allow
   requests from any origin while testing:

   ```bash
   wrangler secret put ALLOWED_ORIGIN
   # then paste https://yourusername.github.io
   ```

## Deploying the Worker

1. Ensure you are in the `tardis-prototype-proxy` directory.
2. Run the publish command:

   ```bash
   wrangler publish
   ```

   Wrangler will package your code and upload it to Cloudflare.  After a few
   seconds it will print the URL of your worker, which will look like
   `https://tardis-proxy.<random>.workers.dev`.

3. Copy this URL and update the `WORKER_BASE_URL` constant at the top of
   `../tardis-prototype-site/app.js` in your site repository.  Commit and
   push the change so your site knows where to send requests.

That’s it!  Your Tardis Prototype is now backed by a Cloudflare Worker and
ready to serve requests to Hugging Face.  Remember that the worker uses your
monthly Hugging Face credits and that the free tier resets each month.

### How it Works

When a user submits a question through the static site, the browser sends a
JSON request to your worker at `/api/chat`.  The worker constructs a prompt
using the “system” instructions and “user” message, and forwards the
request to the Hugging Face API using your secret token.  The worker then
returns a JSON object containing only the generated reply.  CORS headers
are applied so the browser can read the response.

### Additional Notes

- You can change the default model by editing the `model` dropdown in
  `../tardis-prototype-site/index.html` or by supplying a `model` field in
  the request body.  Make sure the model you choose is supported by
  Hugging Face’s Inference Providers.
- The worker currently limits messages and system prompts to 4,000
  characters to prevent abuse.  You can adjust this limit in
  `src/index.js`.
- If you consistently exceed Cloudflare’s free request limit or Hugging
  Face’s free credits, consider upgrading your accounts or deploying
  multiple workers.