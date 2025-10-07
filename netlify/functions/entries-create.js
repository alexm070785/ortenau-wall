// netlify/functions/entries-create.js
import { getStore } from '@netlify/blobs';

const json = (b, init={}) => new Response(JSON.stringify(b), {
  ...init, headers: { 'content-type': 'application/json', ...(init.headers||{}) }
});

// Hilfsfunktion: Datei in images-Store speichern
async function saveImage(file) {
  const images = getStore('images');
  const buf = Buffer.from(await file.arrayBuffer());
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${(file.name||'').split('.').pop()||'jpg'}`;
  await images.set(id, buf, { metadata: { contentType: file.type || 'image/jpeg' } });
  // Öffentliche URL: https://{site}.netlify.app/_blob/images/<key>
  return `/_blob/images/${id}`;
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

    const form = await req.formData();
    const entry = {
      id: `e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: form.get('name') || '',
      category: form.get('category') || '',
      plz: form.get('plz') || '',
      city: form.get('ort') || '',
      street: form.get('strasse') || '',
      house: form.get('hausnr') || '',
      tel: form.get('tel') || '',
      website: form.get('website') || '',
      hours: [],      // kannst du befüllen
      images: [],
      thumbUrl: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      featured: false
    };

    // Adresse als ein String für Anzeige
    entry.address = [entry.street && `${entry.street} ${entry.house}`, entry.plz && entry.city].filter(Boolean).join(', ');

    // Bilder
    const files = form.getAll('menuImages').filter(f => typeof f === 'object');
    for (const f of files) {
      const url = await saveImage(f);
      entry.images.push(url);
    }
    entry.thumbUrl = entry.images[0] || '';

    const store = getStore('entries');
    await store.set(entry.id, JSON.stringify(entry));

    return json({ ok:true, id: entry.id });
  } catch (e) {
    console.error('entries-create error', e);
    return json({ error: 'create_failed' }, { status: 500 });
  }
};
