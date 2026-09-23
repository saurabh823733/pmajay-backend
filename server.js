const express = require('express');
const axios = require('axios');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Meta API Configuration
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '1417043398151987';

// Function to send WhatsApp message via Meta Graph API
async function sendWhatsAppMessage(to, text) {
  console.log(`\n====================================`);
  console.log(`📤 SENDING OUTBOUND REPLY TO: ${to}`);
  console.log(`Using PHONE_NUMBER_ID: ${PHONE_NUMBER_ID}`);
  console.log(`Token Present: ${!!WHATSAPP_TOKEN}`);

  if (!WHATSAPP_TOKEN) {
    console.error('❌ ERROR: WHATSAPP_TOKEN environment variable is not set in Render!');
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
    console.log('✅ META API SUCCESS:', response.data);
    console.log(`====================================\n`);
  } catch (error) {
    console.error('❌ META API OUTBOUND ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    } else {
      console.error('Error Message:', error.message);
    }
    console.log(`====================================\n`);
  }
}

// 1. EXOTEL IVR WEBHOOK
app.all('/ivr/webhook', (req, res) => {
  const callData = req.method === 'POST' ? req.body : req.query;
  console.log('📞 EXOTEL CALL DETECTED:', callData.CallFrom || callData.From);
  res.status(200).type('text/plain').send('OK');
});

// 2. WHATSAPP VERIFICATION (GET)
app.get('/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'pmajay_token')) {
    console.log('💬 WhatsApp Webhook Verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 3. WHATSAPP MESSAGE LISTENER (POST)
app.post('/whatsapp/webhook', async (req, res) => {
  // Acknowledge receipt to Meta immediately
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return; // Skip status updates

    const from = message.from;
    const messageType = message.type;

    console.log(`💬 Processing ${messageType} message from ${from}`);

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
    }
  } catch (err) {
    console.error('❌ Error in WhatsApp processor:', err);
  }
});

// Health & Rest Endpoints
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`PM-AJAY Sahayak backend running on port ${PORT}`);
});
