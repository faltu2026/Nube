/* NubeHost starter. Public frontend only; never put Netlify tokens here. */
const SUPABASE_URL = "sb_publishable_8hhCSqZg0tyHg-ynAv45dA_A4szED2e"; // Add your Supabase Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWZ6eHZ4a3pqdW90YnR2b3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQ1MTIsImV4cCI6MjEwNzg0MDUxMn0.SGRJLxZoYxGmmej6UQe-uK87WjjBOXwVN5g0BuKJzAg"; // Add your Supabase anon/publishable key (not service_role)
const sbReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const sb = sbReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
const authCard=$("authCard"), dashboard=$("dashboard"), logoutBtn=$("logoutBtn");
function message(id,text,error=false){const el=$(id);el.textContent=text;el.classList.toggle("error",error)}
function slugify(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)}
function showDashboard(session){authCard.hidden=true;dashboard.hidden=false;logoutBtn.hidden=false;$("welcomeText").textContent=session?.user?.email||"Tu cuenta";loadProjects()}
function showLoggedOut(){authCard.hidden=false;dashboard.hidden=true;logoutBtn.hidden=true}
async function ownerAllowed(session){
  const {data,error}=await sb.from("owners").select("user_id").eq("user_id",session.user.id).maybeSingle();
  if(error) throw error;
  return Boolean(data);
}
async function refreshAuth(){
 if(!sb){showLoggedOut();message("authMessage","Configuración pendiente: agregá la URL y la clave pública de Supabase en app.js.",true);return}
 const {data:{session}}=await sb.auth.getSession();
 if(session){try{if(await ownerAllowed(session)){showDashboard(session)}else{showLoggedOut();message("authMessage","Tu cuenta inició sesión, pero todavía no está autorizada como propietaria. Seguí la guía README para autorizarla.",true)}}catch(e){showLoggedOut();message("authMessage",e.message||"No se pudo verificar el acceso.",true)}}else showLoggedOut();
}
$("authForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb){message("authMessage","Primero configurá Supabase en app.js.",true);return}
 const btn=$("loginBtn");btn.disabled=true;message("authMessage","Iniciando sesión…");
 const {data,error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
 btn.disabled=false;if(error){message("authMessage",error.message,true);return}
 try{if(await ownerAllowed(data.session)){message("authMessage","Sesión iniciada.");showDashboard(data.session)}else{await sb.auth.signOut();message("authMessage","Cuenta sin permiso de propietaria. Seguí la guía de instalación.",true)}}catch(err){message("authMessage",err.message,true)}
});
$("signupBtn").addEventListener("click",async()=>{if(!sb){message("authMessage","Primero configurá Supabase en app.js.",true);return}
 const {data,error}=await sb.auth.signUp({email:$("email").value.trim(),password:$("password").value});
 if(error){message("authMessage",error.message,true);return}
 message("authMessage",data.session?"Cuenta creada. Todavía debés autorizarla como propietaria en la base de datos.":"Cuenta creada. Revisá tu correo si Supabase solicita confirmación; luego autorizá el usuario como propietario.")});
logoutBtn.addEventListener("click",async()=>{if(sb)await sb.auth.signOut();showLoggedOut();message("authMessage","Sesión cerrada.")});
document.querySelectorAll('input[name="uploadMode"]').forEach(r=>r.addEventListener("change",()=>{
 const zipMode=document.querySelector('input[name="uploadMode"]:checked').value==="zip";
 $("zipFile").disabled=!zipMode;$("individualFiles").disabled=zipMode;
}));
async function loadProjects(){
 if(!sb)return;
 const {data,error}=await sb.from("projects").select("id,name,site_url,created_at").order("created_at",{ascending:false});
 if(error){$("projectsList").innerHTML="";message("deployMessage","No se pudieron cargar los proyectos: "+error.message,true);return}
 $("projectCount").textContent=`${data.length} ${data.length===1?"sitio":"sitios"}`;
 $("projectsList").innerHTML=data.length?data.map(p=>`<article class="project-card"><div><h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.site_url||"URL pendiente")}</p></div><div class="project-actions">${p.site_url?`<a href="${safeUrl(p.site_url)}" target="_blank" rel="noopener">Visitar ↗</a><button data-copy="${escapeHtml(p.site_url)}">Copiar enlace</button>`:""}</div></article>`).join(""):'<div class="project-card"><div><h4>Aún no hay sitios</h4><p>Subí tu primer proyecto con el formulario de arriba.</p></div></div>';
 $("projectsList").querySelectorAll("[data-copy]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copiado ✓"}catch{message("deployMessage","No se pudo copiar automáticamente. Mantené presionado el enlace para copiarlo.",true)}}));
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function safeUrl(v){try{const u=new URL(v);return u.protocol==="https:"?u.href:"#"}catch{return "#"}}
$("deployForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!sb){message("deployMessage","Primero configurá Supabase en app.js.",true);return}
 const {data:{session}}=await sb.auth.getSession();if(!session){message("deployMessage","Iniciá sesión primero.",true);return}
 const mode=document.querySelector('input[name="uploadMode"]:checked').value;
 const zip=$("zipFile").files[0], selected=[...$("individualFiles").files];
 if(mode==="zip"&&!zip){message("deployMessage","Elegí un archivo ZIP.",true);return}
 if(mode==="files"&&!selected.length){message("deployMessage","Elegí uno o más archivos.",true);return}
 if(mode==="zip"&&zip.size>40*1024*1024){message("deployMessage","El ZIP supera el límite inicial de 40 MB.",true);return}
 if(mode==="files"&&selected.some(f=>f.size>10*1024*1024)){message("deployMessage","Un archivo supera el límite inicial de 10 MB.",true);return}
 const name=$("projectName").value.trim(),slug=slugify(name);if(!slug){message("deployMessage","Elegí un nombre válido.",true);return}
 const btn=$("deployBtn");btn.disabled=true;message("deployMessage","Preparando archivos…");
 try{
  let file;
  if(mode==="zip") file=zip;
  else {
   const fd=new FormData();selected.forEach(f=>fd.append("files",f,f.webkitRelativePath||f.name));
   message("deployMessage","Empaquetando archivos…");
   const zipBlob=await createZip(fd.getAll("files"));
   file=new File([zipBlob],slug+".zip",{type:"application/zip"});
  }
  const body=new FormData();body.append("file",file,slug+".zip");body.append("name",name);body.append("slug",slug);
  message("deployMessage","Publicando en el servicio de hosting. No cierres esta pantalla…");
  const response=await fetch("/.netlify/functions/deploy",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body});
  const result=await response.json().catch(()=>({error:"Respuesta no válida del servidor"}));
  if(!response.ok)throw new Error(result.error||"No se pudo publicar");
  message("deployMessage","¡Publicado! "+result.url);await loadProjects();
 }catch(err){message("deployMessage",err.message||"Falló la publicación.",true)}finally{btn.disabled=false}
});
async function createZip(files){
 // JSZip is loaded on demand; this keeps the main page lightweight.
 if(!window.JSZip){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";s.onload=resolve;s.onerror=()=>reject(new Error("No se pudo cargar el empaquetador ZIP. Revisá tu conexión."));document.head.appendChild(s)})}
 const zip=new JSZip();for(const f of files){let path=f.name.replace(/^\/+/,"");if(path.split("/").includes(".."))throw new Error("Ruta de archivo no permitida.");zip.file(path,f)}
 return await zip.generateAsync({type:"blob",compression:"DEFLATE"});
}
refreshAuth();
