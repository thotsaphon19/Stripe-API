// Stripe Webhook → Update Firestore order status — Account B
import Stripe from 'stripe';
import admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).json({ error: `Webhook signature failed: ${e.message}` });
  }

  const db = admin.firestore();

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderNumber = pi.metadata?.order_number;
      const orderSnap = await db.collection('orders')
        .where('orderNumber', '==', orderNumber).limit(1).get();

      if (!orderSnap.empty) {
        const order = orderSnap.docs[0].data();
        await orderSnap.docs[0].ref.update({
          paymentStatus: 'paid',
          status: 'confirmed',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          stripePaymentIntentId: pi.id
        });
        if (order.userId) {
          await db.collection('notifications').add({
            userId: order.userId,
            type: 'order_paid',
            title: '💳 ชำระเงินสำเร็จ',
            message: `ยืนยันชำระเงิน ฿${(order.total || 0).toLocaleString()} สำเร็จ`,
            data: { orderId: orderSnap.docs[0].id, orderNumber: order.orderNumber },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const orderSnap = await db.collection('orders')
        .where('orderNumber', '==', pi.metadata?.order_number).limit(1).get();
      if (!orderSnap.empty) {
        await orderSnap.docs[0].ref.update({ paymentStatus: 'failed', status: 'payment_failed' });
      }
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
