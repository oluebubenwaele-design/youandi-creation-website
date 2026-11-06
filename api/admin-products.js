const crypto = require('crypto');
const { getProducts, createProduct, updateProduct, deleteProduct, uploadImage } = require('./_product-store');

function b64url(value) { return Buffer.from(value).toString('base64url'); }
function sign(payload) {
  return crypto.createHmac('sha256', String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY || '')).update(payload).digest('base64url');
}
function issueToken() {
  const payload = b64url(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload)}`;
}
function validToken(token) {
  if (!token || !(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY)) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function bodyOf(req) { return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
function cleanProduct(input, id) {
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const category = String(input.category || 'furniture').trim().toLowerCase();
  const stock = String(input.stock || 'In Stock').trim();
  const priceNGN = Number(input.priceNGN);
  if (!name || !description || !Number.isFinite(priceNGN) || priceNGN <= 0) throw new Error('Product name, description and a valid NGN price are required.');
  return { id, name, description, category, stock, priceNGN: Math.round(priceNGN), image: String(input.image || '').trim() };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json({ products: await getProducts() });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = bodyOf(req);
    if (body.action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const adminPassword = String(process.env.ADMIN_PASSWORD || '');
      if (!adminEmail || !adminPassword || !(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY)) return res.status(500).json({ error: 'Admin environment variables are not configured.' });
      if (email !== adminEmail || password !== adminPassword) return res.status(401).json({ error: 'Incorrect admin email or password.' });
      return res.status(200).json({ token: issueToken() });
    }

    if (!validToken(body.token)) return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });

    if (body.action === 'create') {
      let product = cleanProduct(body.product || {});
      if (body.imageDataUrl) product.image = await uploadImage(body.imageDataUrl, `new-${Date.now()}`);
      if (!product.image) throw new Error('Please upload a product image or provide an image URL.');
      await createProduct(product);
    } else if (body.action === 'update') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'Product ID is required.' });
      let product = cleanProduct(body.product || {}, id);
      if (body.imageDataUrl) product.image = await uploadImage(body.imageDataUrl, id);
      else if (!product.image) throw new Error('Please keep the existing image or provide a new image URL.');
      await updateProduct(id, product);
    } else if (body.action === 'delete') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'Product ID is required.' });
      await deleteProduct(id);
    } else {
      return res.status(400).json({ error: 'Unknown admin action.' });
    }

    return res.status(200).json({ products: await getProducts() });
  } catch (error) {
    console.error('admin-products error:', error);
    return res.status(500).json({ error: error.message || 'Unable to update product catalog.' });
  }
};
