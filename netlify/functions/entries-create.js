// netlify/functions/entries-create.js
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

export default async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const form = await req.formData();

    // Basisdaten
    const entry = {
      status: 'pending',
      createdAt: new Date().toISOString(),
      name: form.get('name') || '',
      category: form.get('category') || '',
      city: form.get('ort') || '',
      address: [
        form.get('strasse') || '',
        form.get('hausnr') || '',
        form.get('plz') || '',
        form.get('ort') || '',
      ]
        .filter(Boolean)
        .join(' '),
      menuText: form.get('menuText') || '',
      featured: false,
      images: [],
    };

    // Bilder -> images-Store
    const imgStore = getStore('images');
    const files = form.getAll('menuImages') || [];
    for (const file of files) {
      if (!(file instanceof Blob)) continue;
      const ext =
        typeof file.type === 'string' && file.type.includes('/')
          ? file.type.split('/')[1]
          : 'jpg';
      const filename = `img_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      await imgStore.set(filename, file);
      entry.images.push(`/_blob/images/${filename}`);
    }
    if (entry.images.length) entry.thumbUrl = entry.images[0];

    // Eintrag speichern
    const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entStore = getStore('entries');
    await entStore.set(id, JSON.stringify(entry));

    return json({ ok: true, id }, { status: 200 });
  } catch (e) {
    console.error('entries-create error', e);
    return json({ error: 'create_failed' }, { status: 500 });
  }
};
