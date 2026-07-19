# HERA LAB — Cómo activar el "Realismo de Piel" (estilo Magnific)

El efecto de IA necesita un servidor con tu API key de Replicate (la key nunca
puede ir en el navegador). Aquí tienes las 2 formas de usarlo.

---

## ⭐ OPCIÓN A — Desde tu iPhone (recomendada) · Desplegar en Vercel

Una vez hecho esto **UNA vez**, funciona desde el teléfono sin encender nada.

### 1. Sube el código a tu GitHub
Ya está en tu repo `holadennogamboa-art/hera`, rama `claude/instagram-growth-strategy-kWtSQ`.
(Si quieres, haz merge a `main` primero.)

### 2. Crea cuenta en Vercel
- Entra a **https://vercel.com** → "Sign Up" → **Continue with GitHub**.

### 3. Importa el proyecto
- Botón **"Add New… → Project"**.
- Elige el repo **hera**.
- ⚠️ En **"Root Directory"** pulsa **Edit** y selecciona la carpeta **`lab`**.
  (El proyecto vive dentro de `lab/`, no en la raíz.)

### 4. Añade tu API key (paso clave)
- Antes de desplegar, abre **"Environment Variables"**.
- Name: `REPLICATE_API_KEY`
- Value: tu key de Replicate (la que empieza por `r8_...`)
- Pulsa **Add**.

### 5. Deploy
- Pulsa **Deploy**. Espera ~1 minuto.
- Vercel te da una URL tipo **`https://hera-xxxx.vercel.app`**.

### 6. Úsalo en el iPhone
- Abre esa URL en Safari.
- Sube foto → Motores → **FINAL** → **REALISMO DE PIEL** → elige intensidad → **GENERAR**.
- ✅ Funciona sin computadora, desde el teléfono.

> 💡 Cada vez que hagas cambios y los subas a GitHub, Vercel redepliega solo.

---

## 🖥️ OPCIÓN B — En tu Mac (para probar/desarrollar)

### 1. Trae el código a tu Mac (solo la primera vez)
```bash
cd ~
git clone https://github.com/holadennogamboa-art/hera.git Hera
cd Hera/lab
```

### 2. Instala dependencias (solo la primera vez)
```bash
npm install
cd server && npm install && cd ..
```

### 3. Pon tu API key
Crea el archivo `Hera/lab/server/.env.local` con este contenido:
```
REPLICATE_API_KEY=r8_tu_key_real_aqui
PORT=5000
```
> Este archivo está ignorado por git a propósito — tu key nunca se sube.

### 4. Enciende las dos partes (dos pestañas de terminal)

**Terminal 1 — el cerebro IA:**
```bash
cd ~/Hera/lab
npm run server
```
Debe decir: `API key: ✅ configured`

**Terminal 2 — la app:**
```bash
cd ~/Hera/lab
npm run dev
```
Abre la URL que muestre (normalmente `http://localhost:5173`).

### 5. Úsalo
Sube foto → Motores → **FINAL** → **REALISMO DE PIEL** → **GENERAR**.

---

## ❓ Preguntas rápidas

**¿Por qué necesito un servidor y no solo el navegador?**
Replicate cobra por uso y no permite llamadas directas desde el navegador
(expondría tu key a cualquiera). El servidor guarda la key en secreto.

**¿Cuánto cuesta?**
~$0.015 USD por imagen. Las primeras pruebas suelen ser gratis con el crédito
inicial de Replicate.

**¿Qué modelo usa?**
`philz1337x/clarity-upscaler` — el clon open-source del motor "Sharpy" de
Magnific. Reconstruye poros y micro-textura con difusión.

**Regeneré mi key, ¿qué hago?**
- En Vercel: Settings → Environment Variables → edita `REPLICATE_API_KEY` → Redeploy.
- En Mac: edita `server/.env.local` y reinicia `npm run server`.

---

## 🔐 Seguridad
Tu API key va SOLO en:
- Vercel → Environment Variables (encriptada), o
- Tu Mac → `server/.env.local` (ignorado por git).

Nunca en el código ni en el navegador. Si alguna vez la pegaste en un chat o
captura, regenérala en https://replicate.com/account/api-tokens.
