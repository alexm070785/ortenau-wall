// /netlify/functions/entries.js
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-token",
};

// Blob-Store "seiten" – mit SiteID + Token aus den Environment Variables
const store = getStore("seiten", {
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN,
});

const KEY = "data"; // hier liegt das Array als JSON

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS };
  }

  const ok = (body) => ({
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const bad = (code, msg) => ({
    statusCode: code,
    headers: CORS,
    body: JSON.stringify({ error: msg })
