// netlify/functions/entries-update.js
import { getStore } from "@netlify/blobs";

export const config = { path: "/.netlify/functions/entries-update" };

export default async (req, context) => {
  // ---- CORS / Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // ---- Nur eingeloggte Benutzer
  const user = context.clientContext?.user || null;
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const roles = user.app_metadata?.roles || [];
  const isAdmin = roles.includes("admin");
  // Wenn NUR Admins dürfen, nächstes if einkommentieren:
  // if (!isAdmin) return json({ error: "Forbidden" }, 403);

  // ---- ID aus Query oder Pfad
  const url = new URL(req.url);
  const qid = url.searchParams.get("id");
  const pid = url.pathname.split("/").pop();
  const rawId = qid || pid;
  if (!rawId) return json({ error: "Missing id" }, 400);

  // ---- Body lesen (bei PATCH)
  let body = {};
  if (req.method === "PATCH" || req.method === "POST") {
    try { body = await req.json(); } catch {}
  }

  try {
    const store = getStore("entries");

    // ID-Varianten durchprobieren
    const candidates = [
      rawId,
      `entries/${rawId}`,
      rawId.replace(/^entries\//, "")
    ];

    console.log("[entries-update] rawId =", rawId);
    console.log("[entries-update] candidates =", candidates);

    let existing = null;
    let keyUsed = null;
    for (const k of candidates) {
      try {
        const item = await store.getJSON(k);
        if (item) { existing = item; keyUsed = k; break; }
      } catch (e) {
        // ignorieren, nächste Variante probieren
      }
    }

    if (!existing) {
      // Zum Debuggen: zeig die verfügbaren Keys einmal im Log
      const ls = await store.list();
      console.log(
        "[entries-update] keys in store:",
        ls.blobs?.map(b => b.key) ?? []
      );
      return json({ error: "Not found", id: rawId }, 404);
    }

    // ---- Aktualisieren / Aktionen
    if (body.action === "approve") {
      existing.status = "approved";
      existing.approvedAt = Date.now();
    } else if (body.action === "reject") {
      existing.status = "rejected";
      existing.rejectedAt = Date.now();
      // Optional: wirklich löschen
      // await store.delete(keyUsed);
      // return json({ ok: true, id: rawId, deleted: true });
    } else {
      if (typeof body.menuText === "string") existing.menuText = body.menuText;
      if (typeof body.featured === "boolean") existing.featured = body.featured;
      existing.updatedAt = Date.now();
    }

    await store.setJSON(keyUsed, existing);

    return new Response(JSON.stringify({ ok: true, id: rawId, keyUsed, item: existing }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    });
  } catch (e) {
    console.error("[entries-update] error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
  };
}
