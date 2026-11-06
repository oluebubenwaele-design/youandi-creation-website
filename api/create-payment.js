const crypto = require('crypto');
const { makeTrackingNumber, insertOrder } = require('./_orders-store');

function supabase() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase server environment variables are not configured.');
  return { url, key };
}

function sanitizePhone(value) { return String(value || '').replace(/\D/g, ''); }
function bodyOf(req) { return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }

async function getProducts(ids) {
  const { url, key } = supabase();
  const filter = ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
  const response = await fetch(`${url}/rest/v1/Products?select=id,Name,Price,Stock&id=in.(${encodeURIComponent(filter)})`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key }
  });
  if (!response.ok) throw new Error(`Unable to load products (${response.status}).`);
  return response.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = bodyOf(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer || {};
    const paymentMethod = String(body.payment_method || 'card').trim().toLowerCase();
    const phone = sanitizePhone(customer.phone);
    const currency = String(body.currency || '').trim().toUpperCase();

    if (!items.length) return res.status(400).json({ error: 'Cart is empty.' });
    if (currency !== 'NGN') return res.status(400).json({ error: 'Only NGN payments are supported.' });
    if (!customer.name || !customer.email || !customer.address || !phone) return res.status(400).json({ error: 'Customer checkout information is incomplete.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) return res.status(400).json({ error: 'Invalid customer email address.' });
    if (!/^\d{7,15}$/.test(phone)) return res.status(400).json({ error: 'Invalid customer phone number.' });

    const ids = items.map(item => String(item.id));
    const products = await getProducts(ids);
    const byId = new Map(products.map(p => [String(p.id), p]));
    const orderItems = [];
    let totalNGN = 0;

    for (const item of items) {
      const product = byId.get(String(item.id));
      const qty = Number(item.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 100) return res.status(400).json({ error: 'Invalid cart item.' });
      const price = Number(product.Price || 0);
      if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: `Invalid price for ${product.Name}.` });
      totalNGN += Math.round(price) * qty;
      orderItems.push({ id: String(product.id), name: String(product.Name || ''), qty, unit_price_ngn: Math.round(price) });
    }

    totalNGN = Math.round(totalNGN);
    if (totalNGN <= 0) return res.status(400).json({ error: 'Invalid calculated order total.' });

    const tx_ref = `YIC-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const trackingNumber = makeTrackingNumber();
    await insertOrder({
      tracking_number: trackingNumber,
      t_ref: tx_ref,
      customer_name: String(customer.name).trim(),
      customer_email: String(customer.email).trim(),
      customer_phone: phone,
      items: orderItems,
      total: totalNGN,
      currency: 'NGN',
      payment_status: 'pending',
      payment_method: paymentMethod,
      order_status: 'Payment Pending'
    });

    // Manual bank transfer never goes through Flutterwave. The customer is given
    // the merchant's GTBank details on the website and the order remains pending
    // until the merchant confirms the transfer.
    if (paymentMethod === 'manual_transfer') {
      return res.status(200).json({
        tx_ref,
        amount: totalNGN,
        amount_ngn: totalNGN,
        currency: 'NGN',
        tracking_id: trackingNumber,
        payment_method: 'manual_transfer',
        manual_transfer: true
      });
    }

    if (paymentMethod !== 'card') {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }

    const secretKey = String(process.env.FLW_SECRET_KEY || '').trim();
    if (!secretKey) return res.status(500).json({ error: 'Flutterwave server key is not configured.' });

    const host = String(req.headers.host || '').split(',')[0].trim();
    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const redirectUrl = `${forwardedProto}://${host}/`;
    const fwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref,
        amount: totalNGN,
        currency: 'NGN',
        redirect_url: redirectUrl,
        // IMPORTANT: Card only. USSD and Flutterwave Bank Transfer are not requested.
        payment_options: 'card',
        customer: { email: String(customer.email).trim(), phonenumber: phone, name: String(customer.name).trim() },
        meta: { tracking_id: trackingNumber, address: String(customer.address).trim(), city: String(body.city || '').trim(), state: String(body.state || '').trim() },
        customizations: { title: 'YOU AND I CREATION', description: 'Secure card payment for your YOU AND I CREATION order' }
      })
    });
    const fw = await fwResponse.json();
    if (!fwResponse.ok || fw.status !== 'success' || !fw.data?.link) throw new Error(fw.message || 'Flutterwave did not return a payment link.');

    return res.status(200).json({ tx_ref, amount: totalNGN, amount_ngn: totalNGN, currency: 'NGN', tracking_id: trackingNumber, payment_link: fw.data.link, payment_method: 'card' });
  } catch (error) {
    console.error('create-payment error:', error);
    return res.status(500).json({ error: error.message || 'Unable to prepare payment.' });
  }
};
