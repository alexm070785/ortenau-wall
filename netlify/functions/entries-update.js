// netlify/functions/entries-update.js
import { getStore } from '@netlify/blobs';

const json = (b, init={}) => new Response(JSON.stringify(b), {
  ...init, headers: { 'content-type': 'application/json', ...(init.headers||{}) }
});

export default async (req, context) => {
  // Identity erfordern
  try {
    const { user } = context;          // Netlify Identity (JWT) wird automatisch geparst
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (req.method !== 'PATCH') return json({ error: 'Method not allowed' }, { status: 405 });

    const url = new URL(req.url);
    // ID aus Pfad ODER Query holen
    let id = url.pathname.split('/').pop();
    if (!id || id === 'entries-update') id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing_id' }, { status: 400 });

    const body = await req.json();

    const store = getStore('entries');
    const raw = await store.get(id);
    if (!raw) return json({ error: 'not_found' }, { status: 404 });

    const item = JSON.parse(raw);

    if (body.action === 'approve') {
      item.status = 'approved';
      item.approvedAt = new Date().toISOString();
    } else if (body.action === 'reject') {
      item.status = 'rejected';
      item.rejectedAt = new Date().toISOString();
    } else {
      // freie Felder, z.B. Menü/Featured
      if (typeof body.menuText === 'string') item.menuText = body.menuText;
      if (typeof body.featured !== 'undefined') item.featured = !!body.featured;
      item.updatedAt = new Date().toISOString();
    }

    await store.set(id, JSON.stringify(item));
    return json({ ok: true, id, item }, { status: 200 });

  } catch (e) {
    console.error('entries-update error', e);
    return json({ error: 'update_failed' }, { status: 500 });
  }
};
