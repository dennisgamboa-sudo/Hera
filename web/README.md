# HERA Studio · web

La web de HERA Studio para `heraaistudio.com`. Es estática: HTML, CSS y JS propios, sin dependencias ni compilación.

## Qué hay

| Ruta | Para qué |
|---|---|
| `index.html` | Portada: servicios, método, laboratorio, quién firma, contacto y declaración de IA |
| `aviso-legal.html`, `privacidad.html` | Textos legales (LSSI y RGPD). **Tienen huecos marcados que hay que rellenar antes de publicar** |
| `404.html` | Página de error |
| `vercel.json` | Cabeceras de seguridad, URLs limpias y redirección de `/studio` a `/` |
| `llms.txt`, `robots.txt`, `sitemap.xml` | Para buscadores y asistentes de IA |
| `.well-known/security.txt` | Contacto para avisos de seguridad (caduca el 21 nov 2027: renovar) |
| `assets/` | Estilos, script, fuentes alojadas aquí (licencia OFL) y medios |

## Antes de publicar

1. Rellena en `aviso-legal.html` y `privacidad.html` todo lo marcado como `[...]`: nombre completo, NIF, domicilio profesional y proveedor del correo de `heraaistudio.com`.
2. Lee los textos. La declaración de IA dice que los revisaste tú: que sea verdad.

## Publicar en Vercel

1. Vercel → **Add New → Project** → importa `dennisgamboa-sudo/Hera`.
2. **Root Directory**: `web`. Framework: **Other**. Sin comando de build.
3. Deploy.

## Pasar el dominio de la web GEO a esta

El dominio sirve hoy la web GEO de Netlify, y además lleva el correo `denno@heraaistudio.com`. **No toques los registros MX, SPF, DKIM ni DMARC**, o dejarás de recibir correo.

1. En el proyecto nuevo de Vercel → **Settings → Domains** → añade `heraaistudio.com` y `www.heraaistudio.com` (que `www` redirija al dominio sin `www`).
2. En Netlify → sitio `radiant-sprite-512b2b` → **Domain management** → quita `heraaistudio.com` y `www`. La web GEO sigue viva en `radiant-sprite-512b2b.netlify.app`.
3. Donde gestiones el DNS del dominio, cambia **solo** el registro `A` de `@` y el `CNAME` de `www` por los valores que te enseñe Vercel en la pantalla de Domains. Si el DNS lo lleva Netlify, se cambia en Netlify → **Domains → heraaistudio.com → DNS records**.
4. Espera a que Vercel marque el dominio como válido y emita el certificado.
5. Comprueba: la web abre en `https://heraaistudio.com`, te llega un correo de prueba a `denno@heraaistudio.com`, y `https://radiant-sprite-512b2b.netlify.app` sigue funcionando.

En la web GEO, cambia cualquier referencia a `heraaistudio.com` (canonical, enlaces, textos) por su dirección de Netlify.

## Seguridad

- CSP estricta: solo carga recursos del propio dominio, sin scripts en línea ni terceros, y con Trusted Types.
- HSTS de un año con subdominios. Cuando lleves unas semanas sin problemas, puedes añadir `preload` y darlo de alta en hstspreload.org (cuesta revertirlo).
- Sin cookies, sin analítica, sin formularios: el contacto es por correo.
- Fuentes alojadas aquí, sin Google Fonts (evita enviar la IP de cada visita a Google).
