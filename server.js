const express = require('express');

const app = express();

// Middleware to parse incoming JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. EXOTEL IVR WEBHOOK HANDLER
// ==========================================
// Handles both GET and POST requests sent by Exotel Passthru applet
app.all('/ivr/webhook', (req, res) => {
  const callData = req.method === 'POST' ? req.body : req.query;

  const callerNumber = callData.CallFrom || callData.From || callData.CustomField || 'Unknown Caller';
  const callSid = callData.CallSid || 'N/A';

  console.log('====================================');
  console.log('📞 INCOMING EXOTEL CALL DETECTED');
  console.log(`HTTP Method: ${req.method}`);
  console.log(`Caller Number: ${callerNumber}`);
  console.log(`Call SID: ${callSid}`);
  console.log('Full Received Payload:', callData);
  console.log('====================================');

  // Return a clean 200 OK plain text response required by Exotel Passthru
  return res.status(200).type('text/plain').send('OK');
});

// ==========================================
// 2. WHATSAPP WEBHOOK HANDLERS
// ==========================================
// Verification endpoint for Meta Cloud API Webhook setup
app.get('/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    console.log('💬 WhatsApp Webhook Verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Message listener endpoint for incoming WhatsApp messages / voice notes
app.post('/whatsapp/webhook', (req, res) => {
  console.log('====================================');
  console.log('💬 INCOMING WHATSAPP MESSAGE');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('====================================');

  // Acknowledge receipt to Meta immediately
  return res.status(200).send('EVENT_RECEIVED');
});

// ==========================================
// 3. RECOMMENDATION ENGINE & UTILITY ROUTES
// ==========================================
app.post('/api/recommend', (req, res) => {
  const { name_loc, interest } = req.body;
  if (!name_loc || !interest) {
    return res.status(400).json({ error: 'name_loc and interest are required fields' });
  }

  // Placeholder recommendation response
  res.json({
    status: 'success',
    recommendation: 'PMAJAY Skill Training & Infrastructure Support Scheme'
  });
});

app.get('/api/records', (req, res) => {
  res.json({ status: 'ok', records: [] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==========================================
// 4. SERVER INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`PM-AJAY Sahayak backend running on port ${PORT}`);
});
