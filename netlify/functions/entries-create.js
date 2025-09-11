import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method === "OPTIONS") return ok();
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) return json(400, { error: "multipart/form-data expected" });

  const form = await req.formData();
  const name = form.get("name");
  const category = form.get("category");
  const city = form.get("city") || "";
  const address = form.get("address") || "";
  const website = form.get("website") || "";
  const phone = form.get("phone") || "";
  const hours_json = form.get("hours_json") || "[]";
  if (!name || !category) return json(400, { error: "name & category required" });

  const images = getStore("images");
  const entries = getStore("entries");

  let imageUrl = "";
  const file = form.get("image");
  if (file && typeof file === "object") {
    const ext = (file.type && file.type.split("/")[1]) || "jpg";
    const key = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    await images.set(key, await file.arrayBuffer(), { contentType: file.type || "image/jpeg" });
    imageUrl = await images.getPublicUrl(key);
  }

  const id = `e_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const entry = {
    id, status: "pending",
    name, category, city, address, website, phone,
    hours: JSON.parse(hours_json),
    imageUrl,
    featured: false,
    createdAt: new Date().toISOString()
  };

  await entries.setJSON(id, entry);
  return json(200, { ok: true, id });
};

const ok = () => new Response(null, { status: 204, headers: cors() });
const json = (s, b) => new Response(JSON.stringify(b), { status: s, headers: { "content-type":"application/json", ...cors() }});
const cors = () => ({
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"Content-Type, Authorization",
  "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS"
});
