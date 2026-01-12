# Tardis Prototype – Client

This directory contains the **static website** for the Tardis Prototype.  The site
is built with simple HTML, CSS and JavaScript so it can be hosted
anywhere, including [GitHub Pages](https://pages.github.com).  A non‑technical
user can simply click your published link and start using the assistant.

## Files

- `index.html` – the markup for the page.  It includes slider controls for
  honesty and humour, a microphone button for speech input, and a toggle for
  speaking responses aloud.  All interactive behaviour is handled by `app.js`.
- `styles.css` – defines the light, grey–blue–white theme used throughout the
  interface.  Feel free to adjust the CSS variables at the top of this file
  if you wish to tweak the colour palette.
- `app.js` – implements the chat logic, speech recognition, speech synthesis
  and remote API calls.  **You must edit the `WORKER_BASE_URL` constant at
  the top of this file** after you deploy your Cloudflare worker.  It should
  point at your worker’s base URL (for example
  `https://tardis-proxy.your-subdomain.workers.dev`).  Do not include a
  trailing slash – the script appends `/api/chat` automatically.

## Deploying to GitHub Pages

1. Create a new GitHub repository (e.g. `tardis-prototype-site`) and copy
   this directory’s contents into it.
2. Commit your changes and push to GitHub.
3. In your repository settings, enable **GitHub Pages** and select the
   branch and `/` folder as the source.  GitHub will publish your site at
   `https://<username>.github.io/<repository>/`.
4. After deploying your Cloudflare Worker (see `../tardis-prototype-proxy`),
   open `app.js` and replace `WORKER_BASE_URL` with the URL of your worker.
   Commit and push this change.  The published site will now send requests
   through your proxy.

## Testing Locally

When testing the site locally you need to serve it from a local HTTP server,
otherwise the browser will block requests to the Cloudflare worker due to
security restrictions.  You can use Python’s built in web server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.  For speech recognition and
synthesis to work, you will need to access the site over `http://` or
`https://` rather than opening the HTML file directly from the filesystem.

## Using the assistant

1. Type a question in the input box or click the microphone button to dictate
   your query.  Speech recognition works best in Chromium‑based browsers.
2. Tweak the **Honesty** slider to control how strictly the assistant sticks
   to known facts versus making reasonable assumptions.  Lower honesty values
   encourage more speculative answers.
3. Adjust the **Humor** slider if you want the assistant to inject dry wit.
   A value of 0 disables humour entirely.
4. Toggle the **Read replies aloud** switch to have the assistant speak
   responses using the browser’s Speech Synthesis API.  You can still read
   responses on screen even when audio is enabled.

If you encounter connection errors, check that your Cloudflare worker is
running and that the `WORKER_BASE_URL` constant is set correctly.