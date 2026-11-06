/* You And I Creation — fixed, gently waving fabric background.
   A tiny WebGL shader: a soft height field of folds, lit so the crease
   highlights catch a warm champagne light. Rendered at low resolution and
   upscaled (fabric is soft, so it stays smooth), capped at 30fps, paused
   when the tab is hidden, and a still frame for reduced-motion users. */
(function () {
  'use strict';
  var canvas = document.createElement('canvas');
  canvas.id = 'clothBg';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return; // body background colour remains as the fallback
  document.body.insertBefore(canvas, document.body.firstChild);

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform vec2 r;uniform float t;',
    // height of the cloth: layered, slowly drifting folds with a gentle domain warp
    'float h(vec2 q){',
    '  q.x+=.18*sin(q.y*1.1+t*.21);',
    '  q.y+=.12*sin(q.x*.9-t*.17);',
    '  float v=.55*sin(q.x*1.6+q.y*.55+t*.32);',
    '  v+=.32*sin(q.x*2.9-q.y*1.05+t*.24+1.3);',
    '  v+=.16*sin(q.x*4.7+q.y*2.3-t*.38+.7);',
    '  v+=.08*sin(q.y*6.3+q.x*1.4+t*.45);',
    '  return v;}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/r;',
    '  vec2 q=(gl_FragCoord.xy-.5*r)/r.y*2.2;',
    '  float e=.012;',
    '  float c=h(q);',
    '  vec3 n=normalize(vec3(c-h(q+vec2(e,0.)),c-h(q+vec2(0.,e)),e*1.6));',
    '  vec3 l=normalize(vec3(-.45,.55,.7));',
    '  float d=max(dot(n,l),0.);',
    '  vec3 hv=normalize(l+vec3(0.,0.,1.));',
    '  float s=pow(max(dot(n,hv),0.),36.);',
    '  vec3 base=vec3(.082,.061,.052);',
    '  vec3 shade=vec3(.035,.026,.022);',
    '  vec3 gold=vec3(.86,.70,.42);',
    '  vec3 col=mix(shade,base,smoothstep(.2,.95,d));',
    '  col+=gold*s*.22+gold*pow(d,6.)*.05;',
    '  float vig=smoothstep(1.25,.25,length(uv-.5));',
    '  col*=.72+.28*vig;',
    '  gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');

  // Render well below screen resolution; the CSS upscale reads as soft fabric.
  var SCALE = 0.33;
  function resize() {
    var w = Math.max(160, Math.round(window.innerWidth * SCALE));
    var hgt = Math.max(160, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w; canvas.height = hgt;
      gl.viewport(0, 0, w, hgt);
      gl.uniform2f(uR, w, hgt);
    }
  }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(last); }, 150); });
  resize();

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var start = performance.now(), last = 6, prev = 0, raf = 0;
  function draw(sec) { gl.uniform1f(uT, sec); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - prev < 33) return; // ~30fps is plenty for slow cloth
    prev = now;
    last = 6 + (now - start) / 1000;
    draw(last);
  }
  function play() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  draw(last);
  requestAnimationFrame(function () { canvas.classList.add('is-ready'); });
  play();
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); canvas.style.display = 'none'; });
})();
