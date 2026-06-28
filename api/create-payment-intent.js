// Stripe PromptPay QR — Account B (Belt/Industrial)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://siam-heritage-8a0c5.web.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, orderNumber } = req.body;
  if (!amount) return res.status(400).json({ error: 'Missing amount' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'thb',
      payment_method_types: ['promptpay'],
      metadata: { order_number: orderNumber || 'SH-B-' + Date.now() }
    });
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: { type: 'promptpay' }
    });
    return res.status(200).json({
      id: confirmed.id,
      status: confirmed.status,
      qr_image_url: confirmed.next_action?.promptpay_display_qr_code?.image_url_png,
      qr_data: confirmed.next_action?.promptpay_display_qr_code?.data
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
