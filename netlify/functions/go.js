// /netlify/functions/go.js
// Nutzt das globale fetch (Node 18+ / Netlify), kein node-fetch nötig.

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const target = qs.url;

    if (!target) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing ?url=' })
      };
    }

    // Sicherheit: Nur echte URLs erlauben
    let url;
    try {
      url = new URL(target);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL' }) };
    }

    const res = await fetch(url.href, { method: 'GET' });
    const text = await res.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(e && e.message ? e.message : e) })
    };
  }
};
