// src/whatsapp/whatsappRoutes.js
//
// Real-world setup:
// 1. Create a Meta app + WhatsApp product at developers.facebook.com,
//    get a permanent access token + a phone_number_id.
// 2. Set the webhook URL to https://<your-domain>/whatsapp/webhook and
//    verify it (Meta calls GET with a challenge — handled below).
// 3. Beneficiary sends a WhatsApp voice note to your business number.
//    Meta POSTs the message here; we download the audio, transcribe it,
//    run it through the same session/recommendation engine as IVR, and
//    reply with a voice note (TTS) + a short text summary.

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { getOrCreateSession, currentQuestion, recordAnswer, isComplete, resetSession } = require('../sessionStore');
const { buildRecommendation } = require('../recommendationEngine');
const { transcribeAudio } = require('../services/asrService');
const { synthesizeSpeech } = require('../services/ttsService');
const { saveRecord } = require('../db/records');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// --- Step 1: Meta's webhook verification handshake ---
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Step 2: incoming messages ---
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack immediately — WhatsApp requires a fast 200

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return; // status callbacks etc — ignore

    const from = message.from; // sender's WhatsApp number
    const session = getOrCreateSession(from, 'hi-IN');

    // First message from a new user: greet + ask them to send a voice note
    if (session.step === 0 && !session.answers._greeted) {
      session.answers._greeted = true;
      await sendText(from, 'Namaste! Main Sahayak hoon. Kripya awaz (voice note) bhejkar batayein:');
      await sendText(from, currentQuestion(session));
      return;
    }

    if (message.type !== 'audio') {
      await sendText(from, 'Kripya apna jawab voice note (🎤) me bhejein.');
      return;
    }

    // Download the voice note from Meta's media API
    const mediaUrl = await resolveMediaUrl(message.audio.id);
    const transcript = await transcribeAudio(mediaUrl, session.lang);
    recordAnswer(session, transcript);

    if (isComplete(session)) {
      const recommendation = buildRecommendation(session.answers);
      saveRecord({ channel: 'whatsapp', contact: from, lang: session.lang, recommendation });

      const summaryText = formatTextSummary(recommendation);
      await sendText(from, summaryText);

      const audioUrl = await synthesizeSpeech(summaryText, session.lang);
      if (audioUrl) await sendVoiceNote(from, audioUrl);

      resetSession(from);
      return;
    }

    await sendText(from, currentQuestion(session));
  } catch (err) {
    console.error('[whatsappRoutes] error:', err);
  }
});

async function resolveMediaUrl(mediaId) {
  const meta = await axios.get(`${GRAPH_API}/${mediaId}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return meta.data.url; // requires the same auth header to actually download the bytes
}

async function sendText(to, body) {
  return axios.post(
    `${GRAPH_API}/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

async function sendVoiceNote(to, audioUrl) {
  // Production flow: upload the generated audio to Meta's media endpoint
  // first (POST /PHONE_NUMBER_ID/media) to get a media id, then reference
  // that id here. Direct link-based sending is shown for brevity.
  return axios.post(
    `${GRAPH_API}/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: audioUrl } },
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
}

function formatTextSummary(rec) {
  const top = rec.recommendations[0];
  return `Aapke liye sujhav:\n1. ${top.name} (NSQF Level ${top.nsqfLevel}, ${top.duration})\n2. ${rec.recommendations[1]?.name}\n3. ${rec.recommendations[2]?.name}\n\nEk prashikshak jald hi aapse sampark karega.`;
}

module.exports = router;
