const express = require('express');
const axios = require('axios');
const router = express.Router();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Helper to send outbound WhatsApp message
async function sendWhatsAppMessage(to, text) {
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
    console.log('✅ WhatsApp message sent successfully:', response.data);
  } catch (error) {
    console.error('❌ Meta API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
  }
}

// Verification endpoint
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'pmajay_token')) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Message handler
router.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const type = message.type;

    console.log(`💬 Incoming message type: ${type} from: ${from}`);

    if (type === 'text') {
      await sendWhatsAppMessage(
        from,
        "Namaste! Main Sahayak hoon. Kripya awaz (voice note) bhejkar batayein: Aapka naam aur gaon/shahar kya hai?"
      );
    } else if (type === 'audio') {
      await sendWhatsAppMessage(
        from,
        "Namaste! Aapka voice note mil gaya hai. PM-AJAY Sahayak aapke request ko process kar raha hai. Kripya thoda prateeksha karein."
      );
    }
  } catch (err) {
    console.error('❌ Error processing message:', err);
  }
});

module.exports = router;
