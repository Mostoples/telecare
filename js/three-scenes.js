/* ============================================================
   TeleCare — three-scenes.js
   1) Latar hero  : "data sphere" partikel + cincin telemetri + pita EKG 3D
   2) Viewer produk: memuat GLB hasil Blender (TeleBand / TeleRing)
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════════
   1. HERO — data sphere
   ══════════════════════════════════════════════════════════ */
function initHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const root = new THREE.Group();
  scene.add(root);

  const COL_A = new THREE.Color('#28B87A');
  const COL_B = new THREE.Color('#7CC3E8');
  const COL_C = new THREE.Color('#A9E5C8');

  /* --- titik-titik pada bola (distribusi Fibonacci) --- */
  const N = 1400, R = 6.4;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const siz = new Float32Array(N);
  const seed = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tmp = new THREE.Color();

  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const jitter = 0.94 + Math.random() * 0.14;
    pos[i * 3]     = Math.cos(th) * r * R * jitter;
    pos[i * 3 + 1] = y * R * jitter;
    pos[i * 3 + 2] = Math.sin(th) * r * R * jitter;

    tmp.copy(COL_A).lerp(COL_B, (y + 1) / 2);
    if (Math.random() < 0.09) tmp.copy(COL_C);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    siz[i] = Math.random() < 0.08 ? 3.4 : 1.35 + Math.random() * 1.1;
    seed[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize;
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vTwinkle;
      void main(){
        vColor = color;
        vTwinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed);
        vec3 p = position;
        // denyut radial halus, seperti gelombang telemetri
        float pulse = sin(uTime * 0.85 + p.y * 0.32 + aSeed * 0.35) * 0.22;
        p *= 1.0 + pulse * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uScale * (110.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vTwinkle;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.02, d);
        gl_FragColor = vec4(vColor, a * vTwinkle * 0.92);
      }`,
    vertexColors: true
  });
  root.add(new THREE.Points(geo, mat));

  /* --- garis penghubung antar titik terdekat (sinapsis data) --- */
  const linkPos = [];
  for (let i = 0; i < N; i += 7) {
    const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2];
    for (let j = i + 1; j < Math.min(N, i + 46); j++) {
      const bx = pos[j * 3], by = pos[j * 3 + 1], bz = pos[j * 3 + 2];
      const d2 = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
      if (d2 < 1.5) { linkPos.push(ax, ay, az, bx, by, bz); break; }
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkPos, 3));
  root.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({
    color: 0x2FA77E, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
  })));

  /* --- cincin orbit --- */
  const rings = new THREE.Group();
  [[7.9, 0.012, 0x28B87A, 0.5], [9.1, 0.009, 0x7CC3E8, 0.34], [10.4, 0.007, 0xA9E5C8, 0.2]]
    .forEach(([rad, tube, c, o], i) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(rad, tube, 6, 200),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o })
      );
      m.rotation.x = Math.PI / 2 + (i - 1) * 0.34;
      m.rotation.y = i * 0.42;
      m.userData.spin = 0.05 + i * 0.035;
      rings.add(m);
    });
  root.add(rings);

  /* --- pita EKG 3D melingkari bola --- */
  const ecgPts = [];
  const SEG = 520;
  function ecgAt(p) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((p - c) / w, 2));
    return g(0.18, 0.035, 0.13) - g(0.36, 0.012, 0.11) + g(0.40, 0.011, 1.0)
         - g(0.44, 0.016, 0.24) + g(0.66, 0.062, 0.29);
  }
  for (let i = 0; i < SEG; i++) {
    const t = i / SEG;
    const ang = t * Math.PI * 2;
    const beat = ((t * 7) % 1);
    const rad = 8.55 + ecgAt(beat) * 1.5;
    ecgPts.push(new THREE.Vector3(
      Math.cos(ang) * rad,
      Math.sin(ang * 2) * 0.9 + ecgAt(beat) * 0.5,
      Math.sin(ang) * rad
    ));
  }
  const ecgCurve = new THREE.CatmullRomCurve3(ecgPts, true);
  const ecgMesh = new THREE.Mesh(
    new THREE.TubeGeometry(ecgCurve, 700, 0.035, 6, true),
    new THREE.MeshBasicMaterial({ color: 0x6FD3A6, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ecgMesh.rotation.x = -0.42;
  root.add(ecgMesh);

  /* --- interaksi & resize --- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const s = Math.min(1.35, Math.max(0.62, w / 1400));
    mat.uniforms.uScale.value = s;
    // pada layar sempit, geser bola agar tidak menutupi teks
    root.position.x = w < 900 ? 0 : 3.1;
    root.position.y = w < 900 ? 1.2 : 0;
    camera.position.z = w < 900 ? 19 : 16;
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 })
    .observe(canvas);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    mat.uniforms.uTime.value = t;

    if (!reduceMotion) {
      root.rotation.y = t * 0.085;
      root.rotation.x = Math.sin(t * 0.22) * 0.10;
      rings.children.forEach(m => { m.rotation.z += m.userData.spin * 0.01; });
      ecgMesh.rotation.y = -t * 0.16;
    }
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    camera.position.x = mouse.x * 1.5;
    camera.position.y = -mouse.y * 1.1;
    camera.lookAt(root.position.x * 0.45, 0, 0);

    renderer.render(scene, camera);
  })();
}

/* ══════════════════════════════════════════════════════════
   2. VIEWER PRODUK — GLB dari Blender
   ══════════════════════════════════════════════════════════ */
function initViewer() {
  const host = document.getElementById('viewer');
  if (!host) return;
  const loaderEl = document.getElementById('viewerLoader');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 1.6, 11);

  // lingkungan studio agar material metalik punya pantulan
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(5, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6FD3A6, 1.5);
  rim.position.set(-6, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x7CC3E8, 0.8);
  fill.position.set(-4, -3, 5); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xE8F5EF, 0.55));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 5.5;
  controls.maxDistance = 20;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 1.5;

  const pivot = new THREE.Group();
  scene.add(pivot);

  const cache = {};
  const gltfLoader = new GLTFLoader();
  let current = null;

  function fitTo(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = (maxDim / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.75;
    camera.position.set(0, maxDim * 0.22, dist);
    controls.target.set(0, 0, 0);
    controls.minDistance = dist * 0.55;
    controls.maxDistance = dist * 2.1;
    controls.update();
  }

  function show(key) {
    if (current) pivot.remove(current);
    const obj = cache[key];
    if (!obj) return;
    current = obj;
    pivot.add(obj);
    fitTo(obj);
    if (loaderEl) loaderEl.classList.add('is-hidden');
  }

  function load(key) {
    if (cache[key]) { show(key); return; }
    if (loaderEl) loaderEl.classList.remove('is-hidden');
    gltfLoader.load(
      `assets/models/${key}.glb`,
      (gltf) => {
        const obj = gltf.scene;
        obj.traverse((n) => {
          if (n.isMesh && n.material) {
            n.material.envMapIntensity = 1.15;
            if (n.material.emissiveIntensity !== undefined && n.material.emissive) {
              n.material.emissiveIntensity = Math.max(n.material.emissiveIntensity, 1.0);
            }
          }
        });
        cache[key] = obj;
        show(key);
      },
      undefined,
      () => {
        // GLB tidak tersedia → tampilkan placeholder geometris, bukan layar kosong
        const g = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color: 0x9AA6A4, metalness: 1, roughness: 0.24 });
        if (key === 'telering') {
          g.add(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.38, 40, 140), m));
        } else {
          const c = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.4, 0.55), m);
          const s = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.0, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x04372A, emissive: 0x1E7A55, emissiveIntensity: 1.4 }));
          s.position.z = 0.3; g.add(c, s);
        }
        cache[key] = g;
        show(key);
      }
    );
  }

  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('telecare:model', (e) => load(e.detail));

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 })
    .observe(host);

  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    controls.update();
    if (current && !reduceMotion) {
      current.rotation.x = Math.sin(Date.now() * 0.0004) * 0.06;
    }
    renderer.render(scene, camera);
  })();

  load('teleband');
}


/* ══════════════════════════════════════════════════════════
   3. HOLO — "kembar digital" fisiologis, gaya klinis putih
   ══════════════════════════════════════════════════════════ */
function initHolo() {
  const canvas = document.getElementById('holo-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.6, 12.4);

  const root = new THREE.Group();
  scene.add(root);

  const GREEN = 0x049A5B, BLUE = 0x0E7FB8, MINT = 0x28B87A;

  /* --- rangka wireframe utama --- */
  const shellGeo = new THREE.IcosahedronGeometry(3.5, 2);
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(shellGeo),
    new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.16 })
  );
  root.add(shell);

  /* --- rangka dalam yang berputar berlawanan --- */
  const inner = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.35, 1)),
    new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.22 })
  );
  root.add(inner);

  /* --- simpul data pada verteks --- */
  const nodeGeo = new THREE.SphereGeometry(0.062, 12, 10);
  const nodeMat = new THREE.MeshBasicMaterial({ color: MINT });
  const nodes = [];
  const vpos = new THREE.IcosahedronGeometry(3.5, 1).attributes.position;
  const seen = new Set();
  for (let i = 0; i < vpos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(vpos, i);
    const k = v.toArray().map(n => n.toFixed(2)).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    const m = new THREE.Mesh(nodeGeo, nodeMat.clone());
    m.position.copy(v);
    m.userData.ph = Math.random() * Math.PI * 2;
    nodes.push(m);
    root.add(m);
  }
  const holoNodeEl = document.getElementById('holoNode');
  if (holoNodeEl) holoNodeEl.textContent = String(nodes.length);

  /* --- cincin orbit tipis --- */
  const orbits = new THREE.Group();
  [[4.35, 0x049A5B, 0.30], [5.05, 0x0E7FB8, 0.20], [5.75, 0x28B87A, 0.13]]
    .forEach(([r, c, o], i) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.006, 6, 220),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o })
      );
      m.rotation.x = Math.PI / 2 + (i - 1) * 0.42;
      m.rotation.y = i * 0.5;
      m.userData.spin = 0.12 + i * 0.06;
      orbits.add(m);
    });
  root.add(orbits);

  /* --- bidang pemindai yang naik-turun --- */
  const scanRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.52, 0.014, 6, 200),
    new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.55 })
  );
  scanRing.rotation.x = Math.PI / 2;
  root.add(scanRing);

  /* --- pita EKG melingkar --- */
  function ecgAt(p) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((p - c) / w, 2));
    return g(0.18, 0.035, 0.13) - g(0.36, 0.012, 0.11) + g(0.40, 0.011, 1.0)
         - g(0.44, 0.016, 0.24) + g(0.66, 0.062, 0.29);
  }
  const ring = [];
  for (let i = 0; i < 420; i++) {
    const t = i / 420, a = t * Math.PI * 2;
    const r = 4.72 + ecgAt((t * 6) % 1) * 0.6;
    ring.push(new THREE.Vector3(Math.cos(a) * r, ecgAt((t * 6) % 1) * 0.28, Math.sin(a) * r));
  }
  const ecgLine = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 560, 0.019, 5, true),
    new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.5 })
  );
  ecgLine.rotation.x = -0.34;
  root.add(ecgLine);

  /* --- partikel halus di dalam rangka --- */
  const P = 260;
  const pp = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    const r = 3.3 * Math.cbrt(Math.random());
    pp[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pp[i * 3 + 2] = r * Math.cos(ph);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: 0x0E7FB8, size: 0.05, transparent: true, opacity: 0.35, sizeAttenuation: true
  }));
  root.add(dust);

  /* --- interaksi & resize --- */
  const host = document.getElementById('holoStage');
  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  if (host) {
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      m.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      m.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 })
    .observe(canvas);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();

    if (!reduceMotion) {
      root.rotation.y = t * 0.11;
      shell.rotation.y = t * 0.05;
      inner.rotation.y = -t * 0.22;
      inner.rotation.x = Math.sin(t * 0.3) * 0.22;
      orbits.children.forEach(o => { o.rotation.z += o.userData.spin * 0.01; });
      ecgLine.rotation.y = -t * 0.19;
      dust.rotation.y = t * 0.06;

      // cincin pemindai menyapu naik-turun, simpul berdenyut saat dilewati
      const sy = Math.sin(t * 0.62) * 3.1;
      scanRing.position.y = sy;
      const k = Math.sqrt(Math.max(0.001, 3.5 * 3.5 - sy * sy)) / 3.5;
      scanRing.scale.setScalar(k);
      nodes.forEach(n => {
        const near = 1 - Math.min(1, Math.abs(n.position.y - sy) / 0.85);
        const s = 1 + near * 2.4 + Math.sin(t * 2.1 + n.userData.ph) * 0.12;
        n.scale.setScalar(s);
        n.material.opacity = 0.45 + near * 0.55;
        n.material.transparent = true;
      });
    }

    m.x += (m.tx - m.x) * 0.055;
    m.y += (m.ty - m.y) * 0.055;
    root.rotation.x = -m.y * 0.24;
    camera.position.x = m.x * 1.1;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  })();
}

/* ---------------- bootstrap ---------------- */
try { initHero(); } catch (err) { console.warn('[TeleCare] hero 3D dilewati:', err); }
try { initViewer(); } catch (err) { console.warn('[TeleCare] viewer 3D dilewati:', err); }
try { initHolo(); } catch (err) { console.warn('[TeleCare] holo 3D dilewati:', err); }
