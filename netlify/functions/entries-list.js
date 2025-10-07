// netlify/functions/entries-list.js
import { getStore } from '@netlify/blobs';

const json = (b, init={}) => new Response(JSON.stringify(b), {
  ...init, headers: { 'content-type': 'application/json', ...(init.headers||{}) }
});

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'approved').toLowerCase();

    const store = getStore('entries');
    const { blobs } = await store.list();          // [{ key, ... }]
    const out = [];

    for (const b of blobs) {
      const raw = await store.get(b.key);          // string (JSON)
      if (!raw) continue;
      const item = JSON.parse(raw);

      // Filter nach status
      if ((status === 'approved' && item.status !== 'approved') ||
          (status === 'pending'  && item.status !== 'pending')  ||
          (status === 'rejected' && item.status !== 'rejected')) {
        continue;
      }
      out.push(item);
    }

    // Neueste zuerst
    out.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    return json(out, { status: 200 });
  } catch (e) {
    console.error('entries-list error', e);
    return json({ error: 'list_failed' }, { status: 500 });
  }
};
