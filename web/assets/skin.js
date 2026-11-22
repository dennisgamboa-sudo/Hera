// HERA · piel en tiempo real (WebGL 1, sin librerías).
// Fuera de la lupa: el acabado «cera» de una imagen generada. Dentro: la piel con las seis correcciones.
// Al hacer scroll, uFix recorre las seis correcciones (canales, poro, foco, óptica, grano, luz).
(() => {
  const canvas = document.getElementById('skin-gl');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.documentElement.classList.add('no-gl'); return; }

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uLensR;
uniform float uLensOn; uniform float uFix; uniform float uDark;

float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec3 ramp(float x){
  vec3 c0=vec3(.118,.129,.282),c1=vec3(.435,.482,.753),c2=vec3(.663,.698,.886),c3=vec3(.894,.906,.965);
  x=clamp(x,0.,1.);
  return x<.35?mix(c0,c1,x/.35):x<.6?mix(c1,c2,(x-.35)/.25):x<.85?mix(c2,c3,(x-.6)/.25):mix(c3,vec3(1.),(x-.85)/.15);
}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}

// poro: celdas de Worley. var=0 -> patrón repetido (cera); var=1 -> tamaño y reparto cambian por zona
float pores(vec2 p,float var){
  float dens=mix(18.,mix(12.,30.,fbm(p*.45+3.)),var);
  vec2 q=p*dens; vec2 i=floor(q),f=fract(q); float acc=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 o=vec2(float(x),float(y)); vec2 r=h22(i+o);
    vec2 c=o+mix(vec2(.5),r,mix(.15,.9,var))-f;
    float rad=mix(.12,mix(.05,.17,h21(i+o+7.)),var);
    acc=max(acc,(1.-smoothstep(rad*.2,rad,length(c*vec2(1.,mix(1.,1.12,var)))))*mix(1.,.55+.45*h21(i+o+3.),var));
  }
  return acc;
}

// microrrelieve: red fina de surcos en dos direcciones, como la piel de verdad
float grooves(vec2 p){
  // red poligonal de la piel: bordes de celdas de Voronoi (F2-F1), finos y algo irregulares
  vec2 q=p*3.2+vec2(fbm(p*1.3),fbm(p*1.3+5.))*.35; vec2 i=floor(q),f=fract(q);
  float f1=8.,f2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));float d=length(o+h22(i+o)*.85-f);
    if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}}
  return smoothstep(.07,0.,f2-f1)*(.6+.4*vnoise(p*6.));
}
float height(vec2 p,float wPore,float detail){
  float relief=fbm(p*2.2)*.35+fbm(p*11.)*.12*detail;
  float pr=pores(p,wPore)*mix(.4,1.,wPore);
  return relief-pr*.5*detail-grooves(p)*.16*wPore*detail;
}

void main(){
  vec2 frag=gl_FragCoord.xy;
  vec2 uv=frag/uRes;
  float dl=distance(frag,uMouse);
  float lens=(1.-smoothstep(uLensR-1.5,uLensR+1.5,dl))*uLensOn;
  // la lupa amplía 1,7x
  vec2 src=mix(frag,uMouse+(frag-uMouse)/1.7,lens);
  vec2 p=(src-.5*uRes)/uRes.y*3.4+vec2(uTime*.006,uTime*.002);

  float w1=max(clamp(uFix,0.,1.),lens);
  float w2=max(clamp(uFix-1.,0.,1.),lens);
  float w3=max(clamp(uFix-2.,0.,1.),lens);
  float w4=max(clamp(uFix-3.,0.,1.),lens);
  float w5=max(clamp(uFix-4.,0.,1.),lens);
  float w6=max(clamp(uFix-5.,0.,1.),lens);

  vec2 cuv=uv-.5; float r2=dot(cuv,cuv)*1.6;
  float detail=mix(.55,1.,w2)*mix(1.,1.-.65*r2,w3);

  float e=1.5/uRes.y*3.4;
  float h=height(p,w2,detail);
  float hx=height(p+vec2(e,0.),w2,detail);
  float hy=height(p+vec2(0.,e),w2,detail);
  vec2 g=vec2(hx-h,hy-h)/e;
  vec3 n=normalize(vec3(-g*mix(.007,.014,w2),1.));

  // superficie en Luminous Blue: la piel se sombrea en luminancia y se tiñe con una rampa fría
  float tone=mix(.64,.56,fbm(p*.6))-.05*smoothstep(.45,.8,fbm(p*.9+11.))*w2;
  vec3 L=normalize(vec3(-.45,.55,.7));
  vec3 V=vec3(0.,0.,1.);
  float diff=clamp(dot(n,L),0.,1.)*.95+.25;
  float rough=mix(.5,.18,w2);
  float spec=pow(clamp(dot(reflect(-L,n),V),0.,1.),mix(10.,48.,w2));
  spec*=mix(.45,.55*(.4+.9*vnoise(p*14.)),w2);

  // 01 · canales: el rojo lleva menos detalle que el verde
  vec3 chan=mix(vec3(1.),vec3(.62,1.,.88),w1);
  float pr=pores(p,w2)*mix(.35,1.,w2)*detail;
  vec3 lv=vec3(tone)*mix(vec3(1.),vec3(diff),chan)*(1.-pr*.42*chan);
  vec3 col=vec3(ramp(lv.r).r,ramp(lv.g).g,ramp(lv.b).b);

  // 04 · óptica: borde teñido (aproximación de primer orden) y caída de luz en esquinas
  vec2 dir=normalize(cuv+1e-4);
  float fr=clamp(dot(g,dir)*e*r2*7.,-.04,.04);
  col.r+=fr*w4; col.b-=fr*w4;
  col*=mix(1.,1.-.38*r2,w4);

  col+=vec3(.94,.95,1.)*spec*(1.-rough*.6);

  // 06 · luz: hombro de película frente a recorte plano
  vec3 clipd=clamp(col*1.08,0.,1.);
  vec3 film=1.-exp(-col*1.25);
  film/=1.-exp(-1.25);
  col=mix(clipd,film,w6);

  // 05 · grano: plano y uniforme frente a grano en medios tonos, más en el azul
  float lum=dot(col,vec3(.299,.587,.114));
  float t=floor(uTime*24.);
  vec3 gr=vec3(h21(frag+t),h21(frag+t+31.),h21(frag+t+57.))-.5;
  float mid=4.*lum*(1.-lum);
  col+=gr*mix(vec3(.022),vec3(.045,.055,.07)*mid,w5);

  // hilo de luz vertical que atraviesa la lupa
  float bx=abs(frag.x-uMouse.x);
  col+=vec3(.97,.98,1.)*(exp(-bx/1.1)*.55+exp(-bx/38.)*.05)*uLensOn;

  // aro de la lupa: bisel claro por dentro, filo oscuro por fuera
  float dd=dl-uLensR;
  col=mix(col,vec3(.99,.99,1.),(1.-smoothstep(0.,2.4,abs(dd+2.2)))*.85*uLensOn);
  col=mix(col,vec3(.36,.39,.58),(1.-smoothstep(0.,1.4,abs(dd+.2)))*.7*uLensOn);
  col=mix(col,vec3(.62,.66,.84),(1.-smoothstep(0.,6.,abs(dd-5.)))*.35*uLensOn);

  col=mix(col,vec3(.949,.953,.969),uDark);
  gl_FragColor=vec4(col,1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.documentElement.classList.add('no-gl'); return; }
  const pg = gl.createProgram(); gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) { document.documentElement.classList.add('no-gl'); return; }
  gl.useProgram(pg);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pg, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes', 'uTime', 'uMouse', 'uLensR', 'uLensOn', 'uFix', 'uDark'].forEach((k) => { U[k] = gl.getUniformLocation(pg, k); });

  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { fix: 0, dark: 0, lensOn: 1, mx: 0, my: 0, tx: 0, ty: 0, user: false, lastMove: 0, visible: true, dpr: 1 };
  window.heraSkin = state; // site.js escribe aquí el progreso del scroll

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, innerWidth < 760 ? 1.25 : 1.5);
    const w = Math.round(canvas.clientWidth * state.dpr), h = Math.round(canvas.clientHeight * state.dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    if (!state.user) { state.tx = state.mx = w * .68; state.ty = state.my = h * .48; }
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  function point(x, y) {
    const r = canvas.getBoundingClientRect();
    state.tx = (x - r.left) * state.dpr; state.ty = (r.bottom - y) * state.dpr;
    state.user = true; state.lastMove = performance.now();
    document.documentElement.classList.add('lens-used');
  }
  const stage = canvas.parentElement;
  stage.addEventListener('pointerenter', (e) => { point(e.clientX, e.clientY); state.mx = state.tx; state.my = state.ty; }, { passive: true });
  stage.addEventListener('pointermove', (e) => point(e.clientX, e.clientY), { passive: true });
  stage.addEventListener('pointerdown', (e) => point(e.clientX, e.clientY), { passive: true });

  new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; if (state.visible) loop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  let raf = 0; const t0 = performance.now();
  function frame(now) {
    raf = 0;
    const t = (now - t0) / 1000;
    if (!state.user || now - state.lastMove > 6000) {
      // la lupa pasea sola cuando nadie la mueve
      const w = canvas.width, h = canvas.height;
      state.tx = w * (.62 + .2 * Math.sin(t * .23)); state.ty = h * (.5 + .18 * Math.sin(t * .37));
    }
    const k = quiet ? 1 : (state.user && now - state.lastMove < 6000 ? .32 : .1);
    state.mx += (state.tx - state.mx) * k; state.my += (state.ty - state.my) * k;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, quiet ? 0 : t);
    gl.uniform2f(U.uMouse, state.mx, state.my);
    gl.uniform1f(U.uLensR, Math.min(canvas.width, canvas.height) * (innerWidth < 760 ? .2 : .16));
    gl.uniform1f(U.uLensOn, state.lensOn);
    gl.uniform1f(U.uFix, state.fix);
    gl.uniform1f(U.uDark, state.dark);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!quiet) loop();
  }
  function loop() { if (!raf && state.visible && !document.hidden) raf = requestAnimationFrame(frame); }
  state.redraw = () => { if (quiet) requestAnimationFrame(frame); else loop(); };
  loop();
})();
