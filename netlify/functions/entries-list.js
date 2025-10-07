import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (b, init = {}) =>
  new Response(JSON.stringify(b), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...CORS,
      ...(init.headers || {}),
    },
  });

function getUser(context) {
  if (context?.user) return context.user;
  if (context?.clientContext?.user) return context.clientContext.user;
  return null;
}

export default async (req, context) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'approved';

    // pending/rejected nur für Admin
    if (status !== 'approved') {
      const user = getUser(context);
      if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
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
