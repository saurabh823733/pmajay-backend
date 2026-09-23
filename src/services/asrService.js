// src/services/asrService.js
// Pluggable speech-to-text. Swap the implementation for whichever
// provider you have credentials for — the rest of the app only calls
// transcribeAudio() and never knows which vendor is behind it.

const axios = require('axios');

async function transcribeAudio(audioUrl, langCode = 'hi-IN') {
  const provider = process.env.ASR_PROVIDER || 'mock';

  if (provider === 'bhashini') {
    // Bhashini (Digital India Bhashini Division) ASR — free/subsidised for
    // Indian regional languages & dialects, best fit for this use case.
    // 1. Get a pipeline/session via https://bhashini.gov.in (ULCA APIs)
    // 2. POST the audio (base64) to the ASR compute endpoint with the
    //    serviceId for langCode, get back the transcript.
    const res = await axios.post(
      process.env.BHASHINI_ASR_ENDPOINT,
      { audioUrl, config: { language: { sourceLanguage: langCode.split('-')[0] } } },
      { headers: { Authorization: process.env.BHASHINI_API_KEY } }
    );
    return res.data.transcript || res.data.output?.[0]?.source || '';
  }

  if (provider === 'google') {
    // Google Cloud Speech-to-Text — wide Indic language coverage.
    const res = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_ASR_KEY}`,
      { config: { languageCode: langCode, encoding: 'OGG_OPUS', sampleRateHertz: 16000 },
        audio: { uri: audioUrl } }
    );
    return res.data.results?.[0]?.alternatives?.[0]?.transcript || '';
  }

  // Mock mode: lets you test the full call/WhatsApp flow end-to-end
  // without any paid ASR account. Replace with a real provider before
  // going live — this always returns a placeholder.
  console.warn(`[asrService] ASR_PROVIDER=mock — returning placeholder transcript for ${audioUrl}`);
  return '[voice reply captured — connect a real ASR provider to transcribe]';
}

module.exports = { transcribeAudio };
