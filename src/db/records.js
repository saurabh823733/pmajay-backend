// src/db/records.js
// Minimal file-based store so the prototype runs with zero DB setup.
// Replace with Postgres/MongoDB for a real deployment (schema is tiny —
// see saveRecord below — so migration is straightforward).

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'records.json');

function readAll() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8') || '[]');
}

function saveRecord({ channel, contact, lang, recommendation }) {
  const all = readAll();
  all.push({
    id: all.length + 1,
    channel,               // 'ivr' | 'whatsapp' | 'web'
    contact,                // phone number (masked in real deployment for privacy)
    lang,
    name: recommendation.profile.name_loc,
    topTrade: recommendation.recommendations[0]?.name,
    preference: recommendation.preference,
    status: 'Profiled',
    ts: Date.now()
  });
  fs.writeFileSync(DB_FILE, JSON.stringify(all, null, 2));
  return all[all.length - 1];
}

module.exports = { readAll, saveRecord };
