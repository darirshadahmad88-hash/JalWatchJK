// netlify/functions/crop-triage.js
//
// Serverless endpoint for the "Apple health check" photo-triage widget.
// See lib/crop-triage.js for the full scope notes, guardrails, and the
// required ANTHROPIC_API_KEY environment variable.
//
// Expects a POST body: { imageBase64, mediaType, lang }
// (imageBase64 is the raw base64 payload, no "data:image/...;base64," prefix)

const { runCropTriage } = require('../../lib/crop-triage');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use POST' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  try {
    const result = await runCropTriage(payload);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err.message || err) })
    };
  }
};
