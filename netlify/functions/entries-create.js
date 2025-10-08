// … oben: import { getStore } from "@netlify/blobs";

const setJsonCompat = async (store, key, obj) => {
  if (typeof store.setJSON === "function") return store.setJSON(key, obj);
  return store.set(key, JSON.stringify(obj), { contentType: "application/json" });
};

// dort wo gespeichert wird:
await setJsonCompat(store, id, entry);
