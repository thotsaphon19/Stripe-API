// Stripe Credit Card Charge — Account B (Belt/Industrial)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://siam-heritage-8a0c5.web.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { payment_method_id, amount, description, customer } = req.body;
  if (!payment_method_id || !amount) return res.status(400).json({ error: 'Missing payment_method_id or amount' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // บาท → สตางค์
      currency: 'thb',
      payment_method: payment_method_id,
      confirm: true,
      description: description || 'Siam Heritage Belt Order',
      metadata: {
        order_id: 'SH-B-' + Date.now(),
        customer_name: customer?.name || '',
        customer_email: customer?.email || ''
      },
      receipt_email: customer?.email || undefined,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' }
    });

    if (paymentIntent.status === 'succeeded') {
      return res.status(200).json({ success: true, id: paymentIntent.id, status: paymentIntent.status });
    }
    return res.status(400).json({ error: 'Payment not completed', status: paymentIntent.status });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
