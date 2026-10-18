# NubeHost — guía de instalación desde Android

Este starter prepara una interfaz oscura, autenticación Supabase y una función Netlify para crear un sitio y enviarle un ZIP mediante la API de Netlify. Es una base inicial: probala primero con un proyecto de prueba y no la anuncies como hosting público multiusuario sin completar pruebas, límites y revisión de seguridad.

## Qué admite
- Inicio de sesión/cuenta Supabase.
- Panel privado para una cuenta propietaria autorizada.
- Subida de ZIP (máximo inicial 40 MB) o selección de archivos individuales que el navegador empaqueta en ZIP.
- Publicación de sitios estáticos por la API de Netlify.
- Lista de sitios publicados y enlace público.

No ejecuta servidores Node/Python de los usuarios, bases de datos de sus proyectos ni aplicaciones backend arbitrarias. Está pensado para webs estáticas HTML/CSS/JS. Los sitios publicados tendrán URLs `*.netlify.app`; un dominio propio es opcional.

## Paso 1 — Subir el proyecto a Netlify
1. Descomprimí `nubehost.zip` en el teléfono usando el administrador de archivos.
2. En tu navegador Android, entrá a https://app.netlify.com/ e iniciá sesión.
3. Podés usar GitHub para importar el proyecto (recomendado) o desplegar la carpeta manualmente. Para cambios posteriores, GitHub es más cómodo.
4. En Netlify, abrí el sitio de NubeHost y verificá que la configuración de build use `publish = "."`, funciones `netlify/functions`, y que `package.json` se instale durante el build. Si la carga manual no instala dependencias, conectalo a un repositorio Git.

## Paso 2 — Crear Supabase
1. Abrí https://supabase.com/ y creá un proyecto.
2. En Project Settings > API (o Connect), copiá la Project URL y la clave pública `anon`/publishable. No uses `service_role` en el navegador.
3. Abrí `app.js` y reemplazá las dos cadenas vacías al comienzo:
   - `SUPABASE_URL = "https://TU-PROYECTO.supabase.co"`
   - `SUPABASE_ANON_KEY = "TU_CLAVE_PUBLICA"`
4. En Supabase > SQL Editor, ejecutá todo el contenido de `supabase/schema.sql`.
5. En Authentication > Users, creá una cuenta para vos o usá el formulario de la web. Si activaste confirmación de correo, confirmalo primero.

## Paso 3 — Autorizar tu cuenta como propietaria
1. En Supabase > Authentication > Users, copiá el UUID del usuario que va a administrar NubeHost.
2. En SQL Editor ejecutá, reemplazando el UUID:
   `insert into public.owners (user_id) values ('UUID-DE-TU-USUARIO');`
3. No autorices a otras cuentas a menos que realmente quieras darles el control de este panel.

## Paso 4 — Configurar secretos en Netlify
En Netlify: Site configuration > Environment variables (el nombre exacto puede variar) agregá:
- `SUPABASE_URL`: la Project URL de Supabase.
- `SUPABASE_ANON_KEY`: la misma clave pública de Supabase.
- `NETLIFY_AUTH_TOKEN`: token personal de Netlify creado en User settings > Applications > Personal access tokens.
- `NETLIFY_ACCOUNT_ID`: el slug/ID de tu cuenta Netlify. Revisá el valor en la configuración de tu cuenta; la función usa `account_slug` en la API.

**Nunca compartas el token ni lo pongas en `app.js`, HTML, capturas públicas o repositorios.** Si se filtra, revocalo y creá uno nuevo. El token de Netlify permite administrar sitios bajo tu cuenta.

## Paso 5 — Volver a desplegar y probar
1. Volvé a desplegar NubeHost después de guardar las variables.
2. Iniciá sesión con la cuenta autorizada.
3. Prepará un ZIP pequeño que tenga `index.html` en la raíz. Probá publicarlo.
4. Abrí la URL generada en una pestaña nueva.
5. Probá con una cuenta no autorizada: debe bloquear la publicación.

## Importante sobre archivos individuales
El navegador los empaqueta con JSZip antes de enviarlos. Para conservar carpetas, seleccioná los archivos con rutas relativas si tu navegador lo permite. Para proyectos grandes, usá un ZIP.

## Límites y seguridad que faltan antes de abrirlo al público
- La función crea un sitio nuevo por publicación; aún no implementa actualización, borrado del sitio remoto, cuotas, pagos, dominio personalizado ni control de abuso.
- La API de Netlify puede cambiar sus requisitos de despliegue; si la API rechaza el ZIP, revisá la respuesta en la función y la documentación vigente de Netlify.
- Hay que añadir límites de frecuencia, cuota por propietario, validación profunda del ZIP (traversal, symlinks, cantidad de archivos y tamaño descomprimido), política de privacidad, términos y gestión de costos.
- La función usa el body de Netlify Functions, por lo que el límite práctico de carga puede ser menor que 40 MB según el tamaño del evento. Para cargas grandes conviene un flujo directo de subida.
- El panel es para propietario único, no un servicio público multiusuario listo para producción.

## Estructura
- `index.html`: interfaz.
- `styles.css`: diseño adaptable oscuro.
- `app.js`: Supabase Auth, lista y subida.
- `netlify/functions/deploy.js`: publicación segura del lado del servidor.
- `supabase/schema.sql`: tablas y políticas.
- `netlify.toml`: configuración Netlify.
