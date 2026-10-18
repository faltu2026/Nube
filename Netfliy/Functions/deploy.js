const Busboy = require("busboy");
const { createClient } = require("@supabase/supabase-js");

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  body: JSON.stringify(body)
});
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) return reject(new Error("Se esperaba una subida multipart/form-data."));
    const bb = Busboy({ headers: { "content-type": contentType }, limits: { fileSize: 40 * 1024 * 1024, files: 1, fields: 3 } });
    const fields = {}; let upload = null; let tooLarge = false;
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (name, stream, info) => {
      if (name !== "file") { stream.resume(); return; }
      const chunks = [];
      stream.on("limit", () => { tooLarge = true; });
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => { upload = { filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }; });
    });
    bb.on("error", reject);
    bb.on("finish", () => {
      if (tooLarge) return reject(new Error("El ZIP supera el límite de 40 MB."));
      if (!upload || !upload.buffer.length) return reject(new Error("No se recibió ningún archivo."));
      if (!upload.filename.toLowerCase().endsWith(".zip")) return reject(new Error("Solo se permiten archivos ZIP en el servidor."));
      resolve({ fields, upload });
    });
    try { bb.end(Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8")); } catch (e) { reject(e); }
  });
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });
  const { SUPABASE_URL, SUPABASE_ANON_KEY, NETLIFY_AUTH_TOKEN, NETLIFY_ACCOUNT_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !NETLIFY_AUTH_TOKEN || !NETLIFY_ACCOUNT_ID) {
    return json(503, { error: "Falta configurar SUPABASE_URL, SUPABASE_ANON_KEY, NETLIFY_AUTH_TOKEN o NETLIFY_ACCOUNT_ID en las variables privadas de Netlify." });
  }
  try {
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json(401, { error: "Iniciá sesión para publicar." });
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "Sesión inválida. Volvé a iniciar sesión." });
    const { data: owner, error: ownerErr } = await supabase.from("owners").select("user_id").eq("user_id", user.id).maybeSingle();
    if (ownerErr) return json(500, { error: "No se pudo comprobar el permiso de propietario." });
    if (!owner) return json(403, { error: "Tu cuenta no tiene permiso de propietaria." });

    const { fields, upload } = await parseMultipart(event);
    const name = String(fields.name || "").trim().slice(0, 40);
    const slug = String(fields.slug || "").toLowerCase();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) return json(400, { error: "Nombre de proyecto no válido." });
    if (upload.buffer.length > 40 * 1024 * 1024) return json(413, { error: "El ZIP supera los 40 MB." });

    const headers = { Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`, "Content-Type": "application/json" };
    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST", headers, body: JSON.stringify({ name: `nubehost-${slug}-${Date.now().toString(36)}`, account_slug: NETLIFY_ACCOUNT_ID })
    });
    const site = await createRes.json();
    if (!createRes.ok) return json(502, { error: "Netlify no pudo crear el sitio: " + (site.message || createRes.status) });

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(site.id)}/deploys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`, "Content-Type": "application/zip" },
      body: upload.buffer
    });
    const deploy = await deployRes.json();
    if (!deployRes.ok) {
      await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(site.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}` } }).catch(()=>{});
      return json(502, { error: "Netlify no pudo desplegar el ZIP: " + (deploy.message || deployRes.status) });
    }
    const siteUrl = site.ssl_url || site.url || (site.name ? `https://${site.name}.netlify.app` : null);
    const { error: saveErr } = await supabase.from("projects").insert({
      owner_id: user.id, name, slug, netlify_site_id: site.id, site_url: siteUrl, deploy_id: deploy.id || null
    });
    if (saveErr) {
      return json(502, { error: "El sitio fue enviado a Netlify, pero no se pudo guardar en la base de datos. Contactá al administrador con el nombre: " + site.name });
    }
    return json(200, { ok: true, name, url: siteUrl, deployId: deploy.id || null });
  } catch (err) {
    return json(400, { error: err.message || "Error procesando la publicación." });
  }
};
