const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper to send outbound WhatsApp message with explicit error reporting
async function sendWhatsAppMessage(to, text) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

  console.log(`📤 ATTEMPTING OUTBOUND REPLY TO: ${to}`);
  console.log(`Using PHONE_NUMBER_ID: ${PHONE_NUMBER_ID}`);
  console.log(`Using TOKEN Present: ${!!WHATSAPP_TOKEN}`);

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ MISSING CONFIG: WHATSAPP_TOKEN or PHONE_NUMBER_ID environment variable is not set!');
    return;
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      }
    });
    console.log('✅ META API SUCCESS RESPONSE:', JSON.stringify(response.data));
  } catch (error) {
    console.error('❌ META API OUTBOUND ERROR:');
    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Error Details:', JSON.stringify(error.response.data));
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

// 1. Webhook Verification (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'pmajay_token')) {
    console.log('💬 WhatsApp Webhook Verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Incoming Messages Listener (POST)
router.post('/webhook', async (req, res) => {
  // Acknowledge Meta immediately to prevent re-delivery retries
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('ℹ️ Received Webhook Event without message (Status update / delivery receipt). Ignoring.');
      return;
    }

    const from = message.from;
    const messageType = message.type;

    console.log('====================================');
    console.log(`💬 INCOMING MSG FROM: ${from} | TYPE: ${messageType}`);
    console.log('====================================');

    if (messageType === 'text') {
      await sendWhatsAppMessage(
        from,
        "Namaste! Main Sahayak hoon. Kripya awaz (voice note) bhejkar batayein: Aapka naam aur gaon/shahar kya hai?"
      );
    } else if (messageType === 'audio') {
      await sendWhatsAppMessage(
        from,
        "Namaste! Aapka voice note mil gaya hai. PM-AJAY Sahayak aapke request ko process kar raha hai. Kripya thoda prateeksha karein."
      );
    } else {
      console.log(`ℹ️ Unhandled message type: ${messageType}`);
    }
  } catch (err) {
    console.error('❌ CRITICAL ERROR IN WHATSAPP WEBHOOK HANDLER:', err);
  }
});

module.exports = router;
