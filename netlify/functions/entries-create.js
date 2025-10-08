// netlify/functions/entries-create.mjs
import { createStore } from '@netlify/blobs';

// v5/v6-kompatibel speichern
const setJsonCompat = async (store, key, obj) => {
  if (typeof store.setJSON === 'function') return store.setJSON(key, obj); // v6+
  return store.set(key, JSON.stringify(obj), { contentType: 'application/json' }); // v5
};

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method not allowed', headers: CORS };
    }

    // FormData (Bilder etc.) liest du in deiner vollen Version aus;
    // hier nur die Minimalfelder für den Statusfluss
    const form = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString()
      : event.body;

    // Wenn du JSON sendest:
    let body = {};
    try { body = JSON.parse(form || '{}'); } catch {}

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const entry = {
      id,
      name: body.name || '',
      category: (body.category || '').toLowerCase(),
      city: body.ort || body.city || '',
      street: body.strasse || '',
      zip: body.plz || '',
      // HIER WICHTIG:
      status: 'pending',
      createdAt: now,
    };

    const store = createStore('entries');
    await setJsonCompat(store, id, entry);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, id }),
    };
  } catch (err) {
    console.error('entries-create error', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'create_failed' }) };
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
};
