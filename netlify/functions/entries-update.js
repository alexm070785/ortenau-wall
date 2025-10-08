// Helper:
const getJsonCompat = (store, key) =>
  typeof store.getJSON === "function" ? store.getJSON(key) : store.get(key, { type: "json" });

const setJsonCompat = (store, key, obj) =>
  typeof store.setJSON === "function"
    ? store.setJSON(key, obj)
    : store.set(key, JSON.stringify(obj), { contentType: "application/json" });

// beim Lesen:
const item = await getJsonCompat(store, id);

// beim Speichern:
await setJsonCompat(store, id, item);
