// src/ivr/ivrRoutes.js
//
// How this connects in the real world:
// 1. Buy/port a toll-free number on Exotel (or Knowlarity/Ozonetel).
// 2. In the Exotel dashboard, create a "Voicebot Applet" flow and set
//    its webhook URL to: https://<your-domain>/ivr/webhook
// 3. Exotel calls this webhook on: call start, and after every recording.
//    We reply with JSON telling Exotel what to say next and whether to
//    record the caller's next answer. Exotel plays our audio/text via
//    its own TTS or plays an audio file we generate via ttsService.
//
// NOTE: the exact webhook request/response schema differs slightly by
// provider (Exotel "Passthru"/"Voicebot" applet vs Knowlarity's
// call-webhook vs Ozonetel's KooKoo XML). This file implements the
// common Exotel Voicebot Applet contract; adapt parseIncoming() /
// buildResponse() if you use a different telephony vendor.

const express = require('express');
const router = express.Router();

const { getOrCreateSession, currentQuestion, recordAnswer, isComplete, resetSession } = require('../sessionStore');
const { buildRecommendation } = require('../recommendationEngine');
const { transcribeAudio } = require('../services/asrService');
const { synthesizeSpeech } = require('../services/ttsService');
const { saveRecord } = require('../db/records');

// Caller can select language via DTMF (keypad) before the interview starts.
// 1 = Hindi, 2 = Marathi, 3 = English — extend as needed.
const DTMF_LANG = { '1': 'hi-IN', '2': 'mr-IN', '3': 'en-IN' };

router.post('/webhook', async (req, res) => {
  try {
    const { CallSid, CallFrom, RecordingUrl, Digits, EventType } = req.body;
    const callerId = CallSid || CallFrom || 'unknown-caller';

    // First hit for this call: ask for language selection
    if (!Digits && !RecordingUrl && EventType !== 'answer_recorded') {
      return res.json(buildResponse({
        say: 'Namaste. PM-AJAY Sahayak me aapka swagat hai. Hindi ke liye 1, Marathi ke liye 2, English ke liye 3 dabayein.',
        gatherDigits: true
      }));
    }

    // Language selected via keypad — start the interview
    if (Digits && !RecordingUrl) {
      const lang = DTMF_LANG[Digits] || 'hi-IN';
      const session = getOrCreateSession(callerId, lang);
      const q = currentQuestion(session);
      return res.json(buildResponse({ say: q, record: true }));
    }

    // A recorded answer came back — transcribe it and advance the interview
    if (RecordingUrl) {
      const session = getOrCreateSession(callerId);
      const transcript = await transcribeAudio(RecordingUrl, session.lang);
      recordAnswer(session, transcript);

      if (isComplete(session)) {
        const recommendation = buildRecommendation(session.answers);
        saveRecord({ channel: 'ivr', contact: callerId, lang: session.lang, recommendation });

        const summary = formatSpokenSummary(recommendation, session.lang);
        const audioUrl = await synthesizeSpeech(summary, session.lang);
        resetSession(callerId);
        return res.json(buildResponse({ say: summary, audioUrl, hangup: true }));
      }

      const nextQ = currentQuestion(session);
      const audioUrl = await synthesizeSpeech(nextQ, session.lang);
      return res.json(buildResponse({ say: nextQ, audioUrl, record: true }));
    }

    return res.json(buildResponse({ say: 'Kuch samajh nahi aaya, dhanyavad.', hangup: true }));
  } catch (err) {
    console.error('[ivrRoutes] error:', err);
    return res.json(buildResponse({ say: 'Kshama karein, ek takniki samasya hui hai.', hangup: true }));
  }
});

function buildResponse({ say, audioUrl, record, gatherDigits, hangup }) {
  // Exotel Voicebot Applet expects a JSON instruction object.
  // If you generated real TTS audio, prefer "audio_url"; otherwise
  // Exotel's own TTS reads "text" aloud.
  const instruction = { text: say };
  if (audioUrl) instruction.audio_url = audioUrl;
  if (record) instruction.action = 'record';
  if (gatherDigits) instruction.action = 'gather_digits';
  if (hangup) instruction.action = 'hangup';
  return instruction;
}

function formatSpokenSummary(rec, lang) {
  const top = rec.recommendations[0];
  if (lang === 'en-IN') return `Based on your answers, we recommend: ${top.name}, NSQF level ${top.nsqfLevel}, duration ${top.duration}. A trainer will call you soon.`;
  return `Aapke jawabon ke aadhar par hum sujhav dete hain: ${top.name}. NSQF star ${top.nsqfLevel}. Avadhi ${top.duration}. Jald hi ek prashikshak aapko call karega. Dhanyavad.`;
}

module.exports = router;
