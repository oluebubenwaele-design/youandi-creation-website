const { updateByTxRef } = require('./_orders-store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secretKey = String(process.env.FLW_SECRET_KEY || '').trim();
  if (!secretKey) return res.status(500).json({ verified: false, error: 'FLW_SECRET_KEY is not configured on the server.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const transactionId = body.transaction_id;
    const txRef = String(body.tx_ref || '').trim();
    const expectedAmount = Number(body.expected_amount);
    const expectedCurrency = String(body.expected_currency || '').trim().toUpperCase();
    if (!transactionId || !txRef || !Number.isFinite(expectedAmount) || expectedAmount <= 0 || expectedCurrency !== 'NGN') return res.status(400).json({ verified: false, error: 'Invalid transaction verification details.' });

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, { method: 'GET', headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (!response.ok || result.status !== 'success' || !result.data) return res.status(400).json({ verified: false, error: 'Flutterwave could not verify this transaction.' });

    const data = result.data;
    const verified = data.status === 'successful' && data.tx_ref === txRef && String(data.currency || '').toUpperCase() === 'NGN' && Number(data.amount) >= expectedAmount;
    if (!verified) return res.status(400).json({ verified: false, error: 'Transaction details did not match the expected order.' });

    const order = await updateByTxRef(txRef, { payment_status: 'paid', order_status: 'Paid' });
    if (!order) return res.status(404).json({ verified: false, error: 'Payment verified, but the order could not be found.' });

    return res.status(200).json({ verified: true, transaction_id: data.id, tx_ref: data.tx_ref, amount: Number(data.amount), currency: 'NGN', payment_type: data.payment_type || null, tracking_id: order.tracking_number, order: { tracking_id: order.tracking_number, status: order.order_status } });
  } catch (error) {
    console.error('verify-payment error:', error);
    return res.status(500).json({ verified: false, error: 'Unable to verify payment.' });
  }
};
