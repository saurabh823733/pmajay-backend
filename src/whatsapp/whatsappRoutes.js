const express = require('express');
const axios = require('axios');
const router = express.Router();

// Meta Cloud API Credentials from Environment Variables
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Helper function to send message via Meta Graph API
async function sendWhatsAppMessage(to, text) {
  try {
    await axios({
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
    console.log(`✅ Message sent to ${to}`);
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response ? error.response.data : error.message);
  }
}

// 1. Webhook Verification (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'pmajay_token')) {
      console.log('💬 WhatsApp Webhook Verified Successfully');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// 2. Incoming Messages Listener (POST)
router.post('/webhook', async (req, res) => {
  // Return HTTP 200 immediately to Meta so it doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return; // Ignore status updates (sent, delivered, read)

    const from = message.from; // Sender phone number
    const messageType = message.type;

    console.log(`💬 Message received from: ${from} | Type: ${messageType}`);

    if (messageType === 'text') {
      const userText = message.text.body;
      console.log(`Text Body: ${userText}`);

      // Respond to text messages
      await sendWhatsAppMessage(
        from,
        "Namaste! Main Sahayak hoon. Kripya awaz (voice note) bhejkar batayein: Aapka naam aur gaon/shahar kya hai?"
      );

    } else if (messageType === 'audio') {
      const audioId = message.audio?.id;
      console.log(`Audio Media ID: ${audioId}`);

      // Respond to voice notes (Audio / Voice Notes)
      await sendWhatsAppMessage(
        from,
        "Namaste! Aapka voice note mil gaya hai. PM-AJAY Sahayak aapke request ko process kar raha hai. Kripya thoda prateeksha karein."
      );
    }
  } catch (err) {
    console.error('❌ Error processing WhatsApp webhook:', err);
  }
});

module.exports = router;
