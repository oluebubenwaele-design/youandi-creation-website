const crypto = require('crypto');

function supabase() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase server environment variables are not configured.');
  return { url, key };
}

function headers(extra = {}) {
  const { key } = supabase();
  return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
}

function progressForStatus(status) {
  return ({
    'Payment Pending': 0,
    'Paid': 1,
    'Processing': 2,
    'Ready for Delivery': 3,
    'Out for Delivery': 4,
    'Delivered': 5
  })[status] ?? 0;
}

function makeTrackingNumber() {
  return `YI-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

async function insertOrder(order) {
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(order)
  });
  if (!response.ok) throw new Error(`Unable to create order (${response.status}). ${await response.text()}`);
  const rows = await response.json();
  if (!rows[0]) throw new Error('Supabase did not return the created order.');
  return rows[0];
}

async function updateByTracking(trackingNumber, patch) {
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders?tracking_number=eq.${encodeURIComponent(trackingNumber)}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Unable to update order (${response.status}). ${await response.text()}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function updateByTxRef(txRef, patch) {
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders?t_ref=eq.${encodeURIComponent(txRef)}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Unable to update order (${response.status}). ${await response.text()}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function findPublicByTracking(trackingNumber) {
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders?select=tracking_number,order_status,payment_status,payment_method,created_at,updated_at,items&tracking_number=eq.${encodeURIComponent(trackingNumber)}&limit=1`, { headers: headers() });
  if (!response.ok) throw new Error(`Unable to find order (${response.status}).`);
  const rows = await response.json();
  if (!rows[0]) return null;
  const row = rows[0];
  // A card checkout that was abandoned/failed must not become a customer-visible order.
  // Manual bank-transfer orders remain visible while awaiting confirmation.
  const paid = String(row.payment_status || '').toLowerCase() === 'paid';
  const manualTransfer = String(row.payment_method || '').toLowerCase() === 'manual_transfer';
  if (!paid && !manualTransfer) return null;
  return {
    tracking_id: row.tracking_number,
    status: row.order_status,
    progress_step: progressForStatus(row.order_status),
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_summary: Array.isArray(row.items) ? row.items.map(x => `${x.name} × ${x.qty}`).join(', ') : 'YOU & I CREATION order'
  };
}

async function listAdminOrders() {
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders?select=*&order=created_at.desc`, { headers: headers() });
  if (!response.ok) throw new Error(`Unable to load orders (${response.status}).`);
  const rows = await response.json();
  // Do not show abandoned/failed card attempts as customer orders.
  // A card order becomes visible only after Flutterwave verification marks it paid.
  // Manual bank-transfer orders remain visible while payment is pending.
  const visibleRows = rows.filter(row => {
    const paid = String(row.payment_status || '').toLowerCase() === 'paid';
    const manualTransfer = String(row.payment_method || '').toLowerCase() === 'manual_transfer';
    return paid || manualTransfer;
  });
  return visibleRows.map(row => ({
    tracking_id: row.tracking_number,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    item_summary: Array.isArray(row.items) ? row.items.map(x => `${x.name} × ${x.qty}`).join(', ') : 'YOU & I CREATION Order',
    total_ngn: Number(row.total || 0),
    status: row.order_status,
    progress_step: progressForStatus(row.order_status),
    payment_status: row.payment_status,
    payment_method: row.payment_method || null,
    created_at: row.created_at
  }));
}

async function updateStatus(trackingNumber, status) {
  const allowed = ['Paid', 'Processing', 'Ready for Delivery', 'Out for Delivery', 'Delivered'];
  if (!allowed.includes(status)) throw new Error('Invalid order status.');
  const { url } = supabase();
  const response = await fetch(`${url}/rest/v1/Orders?tracking_number=eq.${encodeURIComponent(trackingNumber)}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ order_status: status, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Unable to update order (${response.status}). ${await response.text()}`);
  const rows = await response.json();
  if (!rows[0]) throw new Error('Order not found.');
  return rows[0];
}

module.exports = { progressForStatus, makeTrackingNumber, insertOrder, updateByTracking, updateByTxRef, findPublicByTracking, listAdminOrders, updateStatus };
