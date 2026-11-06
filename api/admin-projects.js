const crypto = require('crypto');

const BUCKET = 'site-assets';
const INDEX_PATH = 'projects/projects.json';

function b64url(value) { return Buffer.from(value).toString('base64url'); }
function sign(payload) { return crypto.createHmac('sha256', String(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY || '')).update(payload).digest('base64url'); }
function validToken(token) {
  if (!token || !(process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET_KEY)) return false;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function supabase() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase server environment variables are not configured.');
  return { url, key };
}
function headers(extra={}) { const {key}=supabase(); return { Authorization:`Bearer ${key}`, apikey:key, ...extra }; }
async function ensureBucket() {
  const {url}=supabase();
  const check=await fetch(`${url}/storage/v1/bucket/${BUCKET}`,{headers:headers()});
  if(check.ok) return;
  const create=await fetch(`${url}/storage/v1/bucket`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({id:BUCKET,name:BUCKET,public:true})});
  if(!create.ok && create.status!==409) throw new Error('Unable to prepare project image storage.');
}
function dedupeProjects(projects) {
  const seen = new Set();
  return (Array.isArray(projects) ? projects : []).filter(project => {
    const p = project || {};
    // Treat exact duplicate records as one project. This also cleans up
    // older duplicate uploads without deleting genuinely different projects.
    const key = [
      String(p.name || '').trim().toLowerCase(),
      String(p.category || '').trim().toLowerCase(),
      String(p.desc || '').trim(),
      String(p.image || '').trim()
    ].join('\u001f');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function readProjects() {
  const {url}=supabase();
  const r=await fetch(`${url}/storage/v1/object/${BUCKET}/${INDEX_PATH}?v=${Date.now()}`, {headers: headers()});
  if(r.status===404) return [];
  if(!r.ok) throw new Error(`Unable to load projects (${r.status}).`);
  const data=await r.json();
  return dedupeProjects(data);
}
async function writeProjects(projects) {
  const {url}=supabase();
  const r=await fetch(`${url}/storage/v1/object/${BUCKET}/${INDEX_PATH}`,{method:'POST',headers:headers({'Content-Type':'application/json','x-upsert':'true','cache-control':'no-cache'}),body:JSON.stringify(projects)});
  if(!r.ok) throw new Error(`Unable to save projects (${r.status}).`);
}
async function uploadImage(dataUrl,id) {
  const {url}=supabase();
  const match=String(dataUrl||'').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if(!match) throw new Error('Please choose a JPG, PNG, WEBP or GIF image.');
  const mime=match[1].toLowerCase();
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length>4*1024*1024) throw new Error('Image must be 4 MB or smaller.');
  const ext=mime.split('/')[1].replace('jpeg','jpg');
  const path=`projects/${id}.${ext}`;
  const r=await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:headers({'Content-Type':mime,'x-upsert':'true','cache-control':'31536000'}),body:bytes});
  if(!r.ok) throw new Error(`Unable to upload project image (${r.status}).`);
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}
function bodyOf(req){return typeof req.body==='string'?JSON.parse(req.body):(req.body||{});}
function cleanProject(input){
  const name=String(input.name||'').trim();
  const category=String(input.category||'residential').trim().toLowerCase();
  const desc=String(input.description||'').trim();
  if(!name||!desc) throw new Error('Project name and description are required.');
  if(!['residential','commercial'].includes(category)) throw new Error('Invalid project category.');
  return {name,category,desc};
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='GET'){ await ensureBucket(); return res.status(200).json({projects:await readProjects()}); }
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const body=bodyOf(req);
    if(!validToken(body.token)) return res.status(401).json({error:'Admin session expired. Please sign in again.'});
    await ensureBucket();
    let projects=await readProjects();
    if(body.action==='create'){
      if(!body.imageDataUrl) throw new Error('Please choose a project image.');
      const id=`prj-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      const project=cleanProject(body.project||{});
      project.id=id; project.image=await uploadImage(body.imageDataUrl,id);
      projects=[project,...projects];
      await writeProjects(projects);
    } else if(body.action==='delete'){
      const id=String(body.id||'');
      const target=projects.find(p=>String(p.id)===id);
      if(!target) return res.status(404).json({error:'Project not found.'});
      projects=projects.filter(p=>String(p.id)!==id);
      await writeProjects(projects);
    } else return res.status(400).json({error:'Unknown project action.'});
    return res.status(200).json({projects});
  }catch(error){
    console.error('admin-projects error:',error);
    return res.status(500).json({error:error.message||'Unable to update projects.'});
  }
};
