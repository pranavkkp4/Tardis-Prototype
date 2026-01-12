export default {
  /**
   * Cloudflare Worker: JSON proxy to Hugging Face Router (OpenAI-compatible)
   *
   * Env vars:
   *  - HF_TOKEN: Hugging Face token (fine-grained) with permission to call Inference Providers
   *  - ALLOWED_ORIGIN: optional CORS restriction. Use "*" or your Pages origin.
   */
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN === "*" ? origin : env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: this.corsHeaders(allowed) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/chat") {
      return new Response("Not found", { status: 404, headers: this.corsHeaders(allowed) });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: this.corsHeaders(allowed) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return this.json({ error: "Invalid JSON" }, 400, allowed);
    }

    const {
      model = "google/gemma-2-2b-it",
      system = "",
      message = "",
      max_new_tokens = 220,
      temperature = 0.6,
    } = body || {};

    if (!message || typeof message !== "string") {
      return this.json({ error: "Missing message" }, 400, allowed);
    }

    const hfToken = env.HF_TOKEN;
    if (!hfToken) {
      return this.json({ error: "Server not configured (missing HF_TOKEN)." }, 500, allowed);
    }

    // OpenAI-compatible Hugging Face Router endpoint
    const hfUrl = "https://router.huggingface.co/v1/chat/completions";

    const clippedSystem = String(system || "").slice(0, 4000);
    const clippedMessage = message.slice(0, 4000);

    const hfPayload = {
      model,
      messages: [
        ...(clippedSystem ? [{ role: "system", content: clippedSystem }] : []),
        { role: "user", content: clippedMessage },
      ],
      temperature,
      max_tokens: max_new_tokens,
    };

    let hfRes;
    try {
      hfRes = await fetch(hfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hfPayload),
      });
    } catch (e) {
      return this.json({ error: "Upstream request failed", detail: String(e) }, 502, allowed);
    }

    const text = await hfRes.text();
    if (!hfRes.ok) {
      return this.json({ error: "Upstream error", status: hfRes.status, detail: text }, 502, allowed);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.json({ error: "Invalid JSON from provider" }, 502, allowed);
    }

    // OpenAI-compatible response shape: choices[0].message.content
    const reply =
      parsed?.choices?.[0]?.message?.content ??
      parsed?.choices?.[0]?.text ??
      "";

    return this.json({ reply }, 200, allowed);
  },

  json(obj, status, allowedOrigin) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json", ...this.corsHeaders(allowedOrigin) },
    });
  },

  corsHeaders(allowedOrigin) {
    const headers = {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
    headers["Access-Control-Allow-Origin"] =
      allowedOrigin && allowedOrigin !== "" ? allowedOrigin : "*";
    return headers;
  },
};
