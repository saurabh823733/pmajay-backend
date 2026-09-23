// server.js — main entry point
require('dotenv').config();
const express = require('express');
const path = require('path');

const ivrRoutes = require('./src/ivr/ivrRoutes');
const whatsappRoutes = require('./src/whatsapp/whatsappRoutes');
const { readAll } = require('./src/db/records');
const { buildRecommendation } = require('./src/recommendationEngine');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Exotel posts form-encoded

app.use('/ivr', ivrRoutes);
app.use('/whatsapp', whatsappRoutes);

// Same recommendation engine, exposed as a plain REST API — this is what
// the web prototype (or any future client) can call directly instead of
// re-implementing the scoring logic client-side.
app.post('/api/recommend', (req, res) => {
  const { name_loc, education, family_occ, current_work, interest, mobility, emp_pref } = req.body;
  if (!name_loc || !interest) {
    return res.status(400).json({ error: 'name_loc and interest are required fields' });
  }
  const recommendation = buildRecommendation({ name_loc, education, family_occ, current_work, interest, mobility, emp_pref });
  res.json(recommendation);
});

// Powers the coordinator dashboard shown in the earlier web prototype
app.get('/api/records', (req, res) => {
  res.json(readAll());
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PM-AJAY Sahayak backend running on port ${PORT}`));
