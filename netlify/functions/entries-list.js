// netlify/functions/entries-list.js
import { getStore } from '@netlify/blobs';

const json = (b, init={}) => new Response(JSON.stringify(b), {
  ...init, headers: { 'content-type': 'application/json', ...(init.headers||{}) }
});

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'approved';

    // "pending" & "rejected" sind Admin-Only
    if (status !== 'approved') {
      const { user } = context;
      if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = getStore('entries');
    const { blobs } = await store.list(); // [{key, ...}]
    const out = [];

    for (const b of blobs) {
      const raw = await store.get(b.key);
      if (!raw) continue;
      const item = JSON.parse(raw);
      if ((item.status || 'pending') === status) {
        out.push({ id: b.key, ...item });
      }
    }

    // neueste zuerst
    out.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    return json(out, { status: 200 });

  } catch (e) {
    console.error('entries-list error', e);
    return json({ error: 'list_failed' }, { status: 500 });
  }
};
