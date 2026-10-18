
/* NubeHost - frontend
   Nunca pongas tokens secretos de Netlify aquí.
*/

const SUPABASE_URL = "https://ujafzxvxkzjuotbtvoxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqYWZ6eHZ4a3pqdW90YnR2b3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjQ1MTIsImV4cCI6MjEwNzg0MDUxMn0.SGRJLxZoYxGmmej6UQe-uK87WjjBOXwVN5g0BuKJzAg";

const $ = (id) => document.getElementById(id);

const authCard = $("authCard");
const dashboard = $("dashboard");
const logoutBtn = $("logoutBtn");

let sb = null;

function message(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", error);
}

function initSupabase() {
  if (
    !SUPABASE_URL.startsWith("https://") ||
    !SUPABASE_URL.includes(".supabase.co") ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes("PEGA_AQUI") ||
    !window.supabase
  ) {
    showLoggedOut();
    message(
      "authMessage",
      "Configuración incompleta. Revisa la URL, la clave pública y la biblioteca Supabase.",
      true
    );
    return false;
  }

  try {
    sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    return true;
  } catch (error) {
    message("authMessage", "No se pudo iniciar Supabase.", true);
    return false;
  }
}

function showLoggedOut() {
  if (authCard) authCard.hidden = false;
  if (dashboard) dashboard.hidden = true;
  if (logoutBtn) logoutBtn.hidden = true;
}

function showDashboard(session) {
  authCard.hidden = true;
  dashboard.hidden = false;
  logoutBtn.hidden = false;

  $("welcomeText").textContent =
    session?.user?.email || "Tu cuenta";

  loadProjects();
}

function slugify(value) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function ownerAllowed(session) {
  const { data, error } = await sb
    .from("owners")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function refreshAuth() {
  if (!sb) return;

  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      showLoggedOut();
      return;
    }

    if (await ownerAllowed(data.session)) {
      showDashboard(data.session);
    } else {
      await sb.auth.signOut();
      showLoggedOut();
      message(
        "authMessage",
        "Tu cuenta todavía no está autorizada como propietaria.",
        true
      );
    }
  } catch (error) {
    showLoggedOut();
    message(
      "authMessage",
      error.message || "No se pudo comprobar la sesión.",
      true
    );
  }
}

/* Inicio de sesión */
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!sb) {
    message("authMessage", "Supabase no está configurado.", true);
    return;
  }

  const button = $("loginBtn");
  button.disabled = true;
  message("authMessage", "Iniciando sesión...");

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    if (await ownerAllowed(data.session)) {
      showDashboard(data.session);
      message("authMessage", "Sesión iniciada.");
    } else {
      await sb.auth.signOut();
      showLoggedOut();
      message(
        "authMessage",
        "La cuenta no tiene permisos de propietaria.",
        true
      );
    }
  } catch (error) {
    message("authMessage", error.message || "Error al iniciar sesión.", true);
  } finally {
    button.disabled = false;
  }
});

/* Crear cuenta */
$("signupBtn").addEventListener("click", async () => {
  if (!sb) {
    message("authMessage", "Supabase no está configurado.", true);
    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("signupBtn");

  if (!email || !password) {
    message(
      "authMessage",
      "Escribe tu correo y contraseña antes de crear la cuenta.",
      true
    );
    return;
  }

  if (password.length < 8) {
    message(
      "authMessage",
      "La contraseña debe tener al menos 8 caracteres.",
      true
    );
    return;
  }

  button.disabled = true;
  message("authMessage", "Creando cuenta...");

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.session) {
      message(
        "authMessage",
        "Cuenta creada. Ahora hay que autorizar al propietario en la base de datos."
      );
    } else {
      message(
        "authMessage",
        "Solicitud de registro enviada. Revisa tu correo para confirmar la cuenta si es necesario."
      );
    }
  } catch (error) {
    console.error("Error de registro:", error);
    message(
      "authMessage",
      error.message || "No se pudo crear la cuenta. Revisa la conexión.",
      true
    );
  } finally {
    button.disabled = false;
  }
});

/* Cerrar sesión */
logoutBtn.addEventListener("click", async () => {
  try {
    if (sb) {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    }

    showLoggedOut();
    message("authMessage", "Sesión cerrada.");
  } catch (error) {
    message("authMessage", error.message, true);
  }
});

/* Selector de archivos */
document.querySelectorAll('input[name="uploadMode"]')
  .forEach((radio) => {
    radio.addEventListener("change", () => {
      const selected = document.querySelector(
        'input[name="uploadMode"]:checked'
      );

      if (!selected) return;

      const zipMode = selected.value === "zip";
      $("zipFile").disabled = !zipMode;
      $("individualFiles").disabled = zipMode;
    });
  });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}

/* Lista de proyectos */
async function loadProjects() {
  if (!sb) return;

  try {
    const { data, error } = await sb
      .from("projects")
      .select("id,name,site_url,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    $("projectCount").textContent =
      `${data.length} ${data.length === 1 ? "sitio" : "sitios"}`;

    $("projectsList").innerHTML = data.length
      ? data.map((project) => `
        <article class="project-card">
          <div>
            <h4>${escapeHtml(project.name)}</h4>
            <p>${escapeHtml(project.site_url || "URL pendiente")}</p>
          </div>
          <div class="project-actions">
            ${project.site_url ? `
              <a href="${safeUrl(project.site_url)}"
                 target="_blank" rel="noopener">Visitar ↗</a>
              <button data-copy="${escapeHtml(project.site_url)}">
                Copiar enlace
              </button>` : ""}
          </div>
        </article>
      `).join("")
      : `<div class="project-card">
          <div><h4>Aún no hay sitios</h4>
          <p>Sube tu primer proyecto.</p></div>
        </div>`;

    $("projectsList").querySelectorAll("[data-copy]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = "Copiado ✓";
          } catch {
            message(
              "deployMessage",
              "No se pudo copiar. Mantén presionado el enlace.",
              true
            );
          }
        });
      });
  } catch (error) {
    message(
      "deployMessage",
      "No se pudieron cargar los proyectos: " + error.message,
      true
    );
  }
}

/* Publicación de sitios: conserva el endpoint existente */
$("deployForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!sb) {
    message("deployMessage", "Supabase no está configurado.", true);
    return;
  }

  const button = $("deployBtn");
  button.disabled = true;

  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    const session = data.session;
    if (!session) throw new Error("Inicia sesión primero.");

    if (!(await ownerAllowed(session))) {
      throw new Error("Tu cuenta no está autorizada como propietaria.");
    }

    const mode = document.querySelector(
      'input[name="uploadMode"]:checked'
    )?.value;

    const zip = $("zipFile").files[0];
    const selected = [...$("individualFiles").files];

    if (mode === "zip" && !zip) {
      throw new Error("Elige un archivo ZIP.");
    }

    if (mode === "files" && !selected.length) {
      throw new Error("Elige uno o más archivos.");
    }

    if (mode === "zip" && zip.size > 40 * 1024 * 1024) {
      throw new Error("El ZIP supera el límite de 40 MB.");
    }

    if (mode === "files" &&
        selected.some((file) => file.size > 10 * 1024 * 1024)) {
      throw new Error("Un archivo supera el límite de 10 MB.");
    }

    const name = $("projectName").value.trim();
    const slug = slugify(name);

    if (!slug) throw new Error("Elige un nombre válido.");

    let file;

    if (mode === "zip") {
      file = zip;
    } else {
      message("deployMessage", "Empaquetando archivos...");

      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
          script.onload = resolve;
          script.onerror = () =>
            reject(new Error("No se pudo cargar JSZip."));
          document.head.appendChild(script);
        });
      }

      const archive = new window.JSZip();

      for (const item of selected) {
        const path = (item.webkitRelativePath || item.name)
          .replace(/^\/+/, "");

        if (path.split("/").includes("..")) {
          throw new Error("Ruta de archivo no permitida.");
        }

        archive.file(path, item);
      }

      const blob = await archive.generateAsync({ type: "blob" });
      file = new File([blob], slug + ".zip", {
        type: "application/zip"
      });
    }

    const body = new FormData();
    body.append("file", file, slug + ".zip");
    body.append("name", name);
    body.append("slug", slug);

    message("deployMessage", "Publicando sitio...");

    const response = await fetch("/.netlify/functions/deploy", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token
      },
      body
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "No se pudo publicar.");
    }

    message("deployMessage", "Publicado: " + result.url);
    await loadProjects();
  } catch (error) {
    message(
      "deployMessage",
      error.message || "Falló la publicación.",
      true
    );
  } finally {
    button.disabled = false;
  }
});

/* Iniciar aplicación */
if (initSupabase()) {
  refreshAuth();
      }
        
