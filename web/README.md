# HERA Studio · web

La web de HERA Studio para `heraaistudio.com`. Es estática: HTML, CSS y JS propios, sin compilación. La portada es una superficie de piel en WebGL (`assets/skin.js`) con una lupa; el scroll suave usa Lenis, alojado en `assets/vendor/`.

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

El dominio se compró en Netlify (registrador Name.com) y su DNS está en Netlify (servidores `dns1`–`dns4.p07.nsone.net`). Se gestiona en Netlify → Domains → heraaistudio.com.

**No cambies los servidores DNS ni toques estos registros, o deja de funcionar `denno@heraaistudio.com` (iCloud+):**

| Tipo | Nombre | Valor |
|---|---|---|
| MX | @ | mx01.mail.icloud.com (10) |
| MX | @ | mx02.mail.icloud.com (10) |
| TXT | @ | v=spf1 include:icloud.com ~all |
| TXT | @ | apple-domain=VOxsvWWmiphwFBqz |
| CNAME | sig1._domainkey | sig1.dkim.heraaistudio.com.at.icloudmailadmin.com |

**Los informes ya enviados (`heraaistudio.com/r/...`) siguen funcionando:** `vercel.json` los redirige a la misma ruta en `radiant-sprite-512b2b.netlify.app`, donde siguen alojados.

Pasos:

1. Vercel → proyecto `hera-studio` → Settings → Domains: `heraaistudio.com` (Production) y `www.heraaistudio.com` (redirige a `heraaistudio.com`).
2. Netlify → sitio `radiant-sprite-512b2b` → Domain management: quita `heraaistudio.com` y `www.heraaistudio.com` como dominios del sitio.
3. Netlify → Domains → heraaistudio.com → DNS records:
   - Borra solo los registros de la web: los de tipo `NETLIFY` (o `A`/`ALIAS`) para `heraaistudio.com` y `www`.
   - Añade `A` · nombre vacío o `@` · `216.198.79.1`.
   - Añade `CNAME` · `www` · el valor que muestre Vercel para `www` (normalmente `cname.vercel-dns.com`).
4. Espera a que Vercel marque los dos dominios como válidos y emita el certificado (de minutos a unas horas).
5. Comprueba: `https://heraaistudio.com` abre la web nueva, un enlace `/r/...` antiguo abre su informe, y te llega un correo de prueba a `denno@heraaistudio.com`.

## Seguridad

- CSP estricta: solo carga recursos del propio dominio, sin scripts en línea ni terceros, y con Trusted Types. Lenis y las fuentes están alojados aquí.
- HSTS de un año con subdominios. Cuando lleves unas semanas sin problemas, puedes añadir `preload` y darlo de alta en hstspreload.org (cuesta revertirlo).
- Sin cookies, sin analítica, sin formularios: el contacto es por correo.
- Fuentes alojadas aquí, sin Google Fonts (evita enviar la IP de cada visita a Google).
