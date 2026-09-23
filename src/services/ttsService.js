// src/services/ttsService.js
// Pluggable text-to-speech. Returns a URL to an audio file the caller
// can play (IVR) or that can be uploaded/sent as WhatsApp voice media.

const axios = require('axios');

async function synthesizeSpeech(text, langCode = 'hi-IN') {
  const provider = process.env.TTS_PROVIDER || 'mock';

  if (provider === 'bhashini') {
    const res = await axios.post(
      process.env.BHASHINI_TTS_ENDPOINT,
      { input: [{ source: text }], config: { language: { sourceLanguage: langCode.split('-')[0] } } },
      { headers: { Authorization: process.env.BHASHINI_API_KEY } }
    );
    return res.data.audioUrl; // returns base64 audio in real Bhashini response — store to a temp file/CDN and return the URL
  }

  if (provider === 'google') {
    const res = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_KEY}`,
      { input: { text }, voice: { languageCode: langCode }, audioConfig: { audioEncoding: 'MP3' } }
    );
    // audioContent is base64 — in production, write to storage (S3/GCS) and return a public URL
    return `data:audio/mp3;base64,${res.data.audioContent}`;
  }

  console.warn(`[ttsService] TTS_PROVIDER=mock — no audio generated for: "${text.slice(0, 40)}..."`);
  return null; // IVR/WhatsApp handlers fall back to sending text when this is null
}

module.exports = { synthesizeSpeech };
