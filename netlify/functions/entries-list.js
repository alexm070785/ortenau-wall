// netlify/functions/entries-list.js
import { getStore } from '@netlify/blobs';

const json = (b, init = {}) =>
  new Response(JSON.stringify(b), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(init.headers || {}),
    },
  });

// kleine Helper: Ist ein Bearer-Token vorhanden?
function hasBearer(req) {
  const h = req.headers.get('authorization') || '';
  return /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(h);
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'approved';

    // „pending“ & „rejected“ nur mit Token
    if (status !== 'approved' && !hasBearer(req)) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = getStore('entries');
    const { blobs } = await store.list();
    const out = [];

    for (const b of blobs) {
      const raw = await store.get(b.key);
      if (!raw) continue;
      const item = JSON.parse(raw);
      if ((item.status || 'pending') === status) {
        out.push({ id: b.key, ...item });
      }
    }

    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json(out, { status: 200 });
  } catch (e) {
    console.error('entries-list error', e);
    return json({ error: 'list_failed' }, { status: 500 });
  }
};

// Optional: OPTIONS für CORS
export const config = { path: '/entries-list' };
