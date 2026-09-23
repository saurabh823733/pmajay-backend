// src/sessionStore.js
// Tracks each caller/WhatsApp user's position in the interview across
// stateless webhook calls. Swap the Map for Redis in production so
// sessions survive server restarts and scale across instances.

const { FIELDS } = require('./recommendationEngine');

const QUESTIONS = {
  'hi-IN': [
    'नमस्ते! मैं सहायक हूँ। आपका नाम और गाँव/शहर क्या है?',
    'आपकी शिक्षा का स्तर क्या है?',
    'क्या आपके परिवार का कोई पारंपरिक पेशा है?',
    'अभी आप अपनी आजीविका के लिए क्या काम करते हैं?',
    'आपकी रुचि किस काम में सबसे ज़्यादा है?',
    'क्या आपको आने-जाने में कोई दिक्कत है?',
    'क्या आप स्वरोज़गार पसंद करेंगे या नौकरी?'
  ],
  'mr-IN': [
    'नमस्कार! मी सहायक आहे. तुमचं नाव आणि गाव/शहर सांगा.',
    'तुमचं शिक्षण किती झालं आहे?',
    'तुमच्या कुटुंबाचा पारंपरिक व्यवसाय आहे का?',
    'सध्या उदरनिर्वाहासाठी तुम्ही काय काम करता?',
    'तुम्हाला कोणत्या कामात सर्वात जास्त रस आहे?',
    'प्रवासाची काही अडचण आहे का?',
    'तुम्हाला स्वयंरोजगार आवडेल की पगारी नोकरी?'
  ],
  'en-IN': [
    'Hi! I am Sahayak. What is your name and village/town?',
    'What is your highest education level?',
    'Does your family have a traditional occupation?',
    'What work do you currently do to earn a living?',
    'What skills or work interest you most?',
    'Do you have any mobility constraint?',
    'Would you prefer self-employment or wage employment?'
  ]
};

// key -> { lang, step, answers }
const sessions = new Map();

function getOrCreateSession(key, lang = 'hi-IN') {
  if (!sessions.has(key)) {
    sessions.set(key, { lang, step: 0, answers: {}, startedAt: Date.now() });
  }
  return sessions.get(key);
}

function currentQuestion(session) {
  const bank = QUESTIONS[session.lang] || QUESTIONS['hi-IN'];
  return bank[session.step];
}

function recordAnswer(session, text) {
  const field = FIELDS[session.step];
  session.answers[field] = text;
  session.step += 1;
}

function isComplete(session) {
  return session.step >= FIELDS.length;
}

function resetSession(key) {
  sessions.delete(key);
}

module.exports = { getOrCreateSession, currentQuestion, recordAnswer, isComplete, resetSession, QUESTIONS };
