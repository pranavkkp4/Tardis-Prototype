export default {
  /**
   * Fetch handler for the Cloudflare Worker.  This worker serves as a simple
   * JSON proxy between the client and Hugging Face’s Inference Providers API.
   * It adds CORS headers, hides your secret Hugging Face token from the
   * browser, and sanitises user input to prevent abuse.
   *
   * Environment variables:
   *  - HF_TOKEN: your Hugging Face user access token.  Set this via
   *    `wrangler secret put HF_TOKEN`.
   *  - ALLOWED_ORIGIN: optional.  Restrict CORS to a specific domain
   *    (e.g. https://username.github.io).  Default "*" allows all origins.
   */
  async fetch(request, env) {
    // Determine allowed origin for CORS
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN === "*" ? origin : env.ALLOWED_ORIGIN;

    // Preflight response for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: this.corsHeaders(allowed),
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/chat") {
      return new Response("Not found", {
        status: 404,
        headers: this.corsHeaders(allowed),
      });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: this.corsHeaders(allowed),
      });
    }

    // Parse the JSON body
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
    // Clip the message and system strings to reasonable lengths
    const clippedMessage = message.slice(0, 4000);
    const clippedSystem = String(system || "").slice(0, 4000);
    // Build a simple prompt in OpenAI style
    const prompt = `${clippedSystem}\n\nUser: ${clippedMessage}\nAssistant:`;
    // Compose the Hugging Face endpoint URL
    const hfUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
    const hfToken = env.HF_TOKEN;
    if (!hfToken) {
      return this.json({ error: "Server not configured (missing HF_TOKEN)." }, 500, allowed);
    }
    // Build the POST body for Hugging Face.  We request only the new text, not
    // the full prompt back, and we allow the client to control the number of
    // generated tokens and temperature.
    const hfPayload = {
      inputs: prompt,
      parameters: {
        max_new_tokens,
        temperature,
        return_full_text: false,
      },
      options: {
        wait_for_model: true,
      },
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
    // Parse the response, which can vary depending on provider.  It may be an
    // array of objects with `generated_text` or a single object with `generated_text`.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.json({ error: "Invalid JSON from provider" }, 502, allowed);
    }
    let reply = "";
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].generated_text) {
      reply = parsed[0].generated_text;
    } else if (parsed.generated_text) {
      reply = parsed.generated_text;
    } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].text) {
      // Some providers (OpenAI-compatible) return choices
      reply = parsed.choices[0].text;
    } else {
      reply = JSON.stringify(parsed);
    }
    return this.json({ reply }, 200, allowed);
  },

  /** Helper to build JSON responses with CORS */
  json(obj, status, allowedOrigin) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...this.corsHeaders(allowedOrigin),
      },
    });
  },

  /**
   * Generate CORS headers.  If no origin is specified (or it's the empty
   * string), allow all origins.  Note: Cloudflare automatically sets
   * appropriate Vary headers.
   */
  corsHeaders(allowedOrigin) {
    const headers = {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
    if (allowedOrigin && allowedOrigin !== "") {
      headers["Access-Control-Allow-Origin"] = allowedOrigin;
    } else {
      headers["Access-Control-Allow-Origin"] = "*";
    }
    return headers;
  },
};