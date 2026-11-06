const DEFAULT_PRODUCTS = [];

const url = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = 'site-assets';

function headers() {
  const k = key();
  return { Authorization: `Bearer ${k}`, apikey: k };
}

function requireSupabase() {
  const u = url(), k = key();
  if (!u || !k) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
  return { u, k };
}

function mapRow(row) {
  return {
    id: String(row.id),
    name: String(row.Name || ''),
    priceNGN: Number(row.Price || 0),
    image: String(row['Image url'] || ''),
    category: String(row.Category || 'furniture'),
    stock: String(row.Stock || 'In Stock'),
    description: String(row.Description || '')
  };
}

function dbPayload(product) {
  return {
    Name: String(product.name || '').trim(),
    Price: Math.round(Number(product.priceNGN)),
    'Image url': String(product.image || '').trim(),
    Category: String(product.category || 'furniture').trim().toLowerCase(),
    Stock: String(product.stock || 'In Stock').trim(),
    Description: String(product.description || '').trim()
  };
}

async function ensureBucket() {
  const { u, k } = requireSupabase();
  const check = await fetch(`${u}/storage/v1/bucket/${bucket}`, { headers: { Authorization: `Bearer ${k}`, apikey: k } });
  if (check.ok) return true;
  const create = await fetch(`${u}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, apikey: k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, public: true })
  });
  return create.ok || create.status === 409;
}

async function getProducts() {
  const { u } = requireSupabase();
  const pageSize = 1000;
  const allRows = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${u}/rest/v1/Products?select=id,Name,Price,"Image%20url",Category,Stock,Description&order=created_at.desc&limit=${pageSize}&offset=${offset}`, {
      headers: { ...headers(), Prefer: 'return=representation' }
    });
    if (!response.ok) throw new Error(`Unable to load product catalog (${response.status}).`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < pageSize) break;
  }
  return allRows.length ? allRows.map(mapRow) : DEFAULT_PRODUCTS;
}

async function createProduct(product) {
  const { u } = requireSupabase();
  const response = await fetch(`${u}/rest/v1/Products`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(dbPayload(product))
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to create product (${response.status}). ${detail}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Supabase did not return the created product.');
  return mapRow(rows[0]);
}

async function updateProduct(id, product) {
  const { u } = requireSupabase();
  const response = await fetch(`${u}/rest/v1/Products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(dbPayload(product))
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to update product (${response.status}). ${detail}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Product not found.');
  return mapRow(rows[0]);
}

async function deleteProduct(id) {
  const { u } = requireSupabase();
  const response = await fetch(`${u}/rest/v1/Products?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=representation' }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to delete product (${response.status}). ${detail}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Product not found.');
  return mapRow(rows[0]);
}

async function uploadImage(dataUrl, id) {
  const { u, k } = requireSupabase();
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) throw new Error('Please choose a JPG, PNG, WEBP or GIF image.');
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Image must be 4 MB or smaller.');
  await ensureBucket();
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const path = `products/${id}-${Date.now()}.${ext}`;
  const response = await fetch(`${u}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, apikey: k, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '31536000' },
    body: bytes
  });
  if (!response.ok) throw new Error(`Unable to upload image (${response.status}).`);
  return `${u}/storage/v1/object/public/${bucket}/${path}`;
}

module.exports = { DEFAULT_PRODUCTS, getProducts, createProduct, updateProduct, deleteProduct, uploadImage };
