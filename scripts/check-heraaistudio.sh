#!/usr/bin/env bash
# Revisión de heraaistudio.com (web nueva de HERA Studio en Vercel).
# Uso: bash scripts/check-heraaistudio.sh   · Sale con código 1 si algo falla.
# Comprueba: web viva, cabeceras de seguridad, redirecciones (www, /studio, /r/ a Netlify),
# archivos públicos, medios, textos legales y que el correo de iCloud siga intacto.
set -u
D="https://heraaistudio.com"
fail=0; warn=0
ok()   { printf 'PASS  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; fail=$((fail+1)); }
note() { printf 'WARN  %s\n' "$1"; warn=$((warn+1)); }
code() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$1"; }
loc()  { curl -s -o /dev/null -m 20 -w '%{redirect_url}' "$1"; }

# 1 · portada
html=$(curl -s -m 20 "$D/")
[ "$(code "$D/")" = 200 ] && ok "portada responde 200" || bad "portada no responde 200"
grep -q '<title>HERA Studio</title>' <<<"$html" && ok "título HERA Studio" || bad "falta el título HERA Studio"
grep -q 'Imagen que aguanta' <<<"$html" && ok "titular de la portada" || bad "falta el titular «Imagen que aguanta»"
grep -q 'id="skin-gl"' <<<"$html" && ok "lienzo de la piel (lupa)" || bad "falta el lienzo de la piel"
grep -q 'lucky.mp4' <<<"$html" && ok "LUCKY en Trabajo" || bad "falta LUCKY en Trabajo"

# 2 · cabeceras de seguridad
h=$(curl -sI -m 20 "$D/" | tr -d '\r' | tr 'A-Z' 'a-z')
grep -q "content-security-policy: default-src 'none'" <<<"$h" && ok "CSP estricta" || bad "falta la CSP estricta"
grep -q 'strict-transport-security: max-age=' <<<"$h" && ok "HSTS" || bad "falta HSTS"
grep -q 'x-frame-options: deny' <<<"$h" && ok "X-Frame-Options" || bad "falta X-Frame-Options"
grep -q 'set-cookie' <<<"$h" && bad "la portada pone cookies (no debería)" || ok "sin cookies"

# 3 · redirecciones
[[ "$(loc "https://www.heraaistudio.com/")" == "$D/"* ]] && ok "www redirige a heraaistudio.com" || bad "www no redirige a heraaistudio.com"
[[ "$(loc "$D/studio")" == "$D/"* || "$(loc "$D/studio")" == "/" ]] && ok "/studio redirige a la portada" || bad "/studio no redirige"
[[ "$(loc "$D/r/prueba")" == https://radiant-sprite-512b2b.netlify.app/r/prueba* ]] && ok "/r/ redirige a los informes de Netlify" || bad "/r/ no redirige a Netlify: los informes enviados a clientes se romperían"
[ "$(code "https://radiant-sprite-512b2b.netlify.app/")" = 200 ] && ok "web GEO viva en Netlify" || bad "la web GEO de Netlify no responde"

# 4 · archivos públicos y medios
for p in /aviso-legal /privacidad /robots.txt /sitemap.xml /llms.txt /.well-known/security.txt \
         /assets/site.css /assets/site.js /assets/skin.js /assets/vendor/lenis.min.js \
         /assets/media/lucky.mp4 /assets/media/versionado.mp4 /assets/media/showreel.mp4; do
  c=$(code "$D$p"); [ "$c" = 200 ] && ok "$p" || bad "$p responde $c"
done
exp=$(curl -s -m 20 "$D/.well-known/security.txt" | sed -n 's/^Expires: \([0-9-]*\).*/\1/p')
if [ -n "$exp" ]; then
  left=$(( ( $(date -d "$exp" +%s 2>/dev/null || date -j -f %Y-%m-%d "$exp" +%s) - $(date +%s) ) / 86400 ))
  [ "$left" -gt 30 ] && ok "security.txt caduca en $left días" || note "security.txt caduca en $left días: renovar Expires"
fi

# 5 · textos legales
curl -s -m 20 "$D/aviso-legal" | grep -q 'class="falta"' && note "el aviso legal tiene huecos sin rellenar (NIF, domicilio)" || ok "aviso legal completo"

# 6 · correo de iCloud (no debe cambiar)
if command -v dig >/dev/null; then
  mx=$(dig +short MX heraaistudio.com)
  grep -q 'mx01.mail.icloud.com' <<<"$mx" && grep -q 'mx02.mail.icloud.com' <<<"$mx" && ok "MX de iCloud intactos" || bad "los MX de iCloud han cambiado: el correo puede no llegar"
  dig +short TXT heraaistudio.com | grep -q 'v=spf1 include:icloud.com' && ok "SPF de iCloud" || bad "falta el SPF de iCloud"
  dig +short TXT heraaistudio.com | grep -q 'apple-domain=' && ok "verificación de Apple" || bad "falta el TXT apple-domain"
  dig +short CNAME sig1._domainkey.heraaistudio.com | grep -q icloudmailadmin && ok "DKIM de iCloud" || bad "falta el DKIM de iCloud"
  dig +short A heraaistudio.com | grep -q '216.198.79.1' && ok "A apunta a Vercel" || bad "el registro A ya no apunta a Vercel"
else
  note "sin dig: no se comprobó el DNS del correo"
fi

printf '\n%s\n' "Resultado: $fail fallos, $warn avisos"
[ "$fail" -eq 0 ]
