// netlify/functions/farmer-brief.js
//
// Aggregates every indicator for one district (water/soil signal, mandi
// price, flood status) into a single JSON response, plus a ready-to-send
// `telegramMessage` string — built for automation tools like n8n to poll
// on a schedule and forward straight to a farmer's Telegram chat.
//
// Usage: GET /api/farmer-brief?district=pulwama
// Valid district ids: pampore, shopian, sopore, pulwama (see assets/data.js)
//
// All logic lives in lib/farmer-brief.js, shared with the Render/Express
// route in server.js, so behavior is identical on either platform.

const { buildFarmerBrief } = require('../../lib/farmer-brief');

exports.handler = async function (event) {
  const districtId = event.queryStringParameters && event.queryStringParameters.district;

  if (!districtId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'district query param is required, e.g. ?district=pulwama' })
    };
  }

  try {
    const brief = await buildFarmerBrief(districtId);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900' // 15 min — matches flood-level's cadence
      },
      body: JSON.stringify(brief)
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err.message || err) })
    };
  }
};
