const BACKGROUND = '#17251f';
const MAX_IMAGES = 24;
const MAX_DPR = 1.6;
const FRAME_INTERVAL = 1000 / 28;
const PALETTE = [[128, 155, 133], [172, 150, 108], [154, 111, 87], [184, 192, 168]];

function hash(value) {
  let seed = 2166136261;
  for (const char of String(value)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function localSource(work, baseURI) {
  const source = typeof work?.image === 'string' ? work.image.trim() : '';
  // This decoration only uses bundled raster artwork, never remote image URLs.
  if (!source || /^[a-z][a-z\d+.-]*:|^\/\/|\\/i.test(source)) return null;
  try {
    const base = new URL(baseURI);
    const url = new URL(source, base);
    if (url.origin !== base.origin || !/\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname)) return null;
    if (!url.pathname.includes('/assets/') || url.search || url.hash) return null;
    return { id: String(work.id || source), url: url.href };
  } catch {
    return null;
  }
}

function selectSources(works, baseURI) {
  const unique = new Map();
  for (const work of Array.isArray(works) ? works : []) {
    const source = localSource(work, baseURI);
    if (source && !unique.has(source.url)) unique.set(source.url, source);
  }
  return [...unique.values()].sort((a, b) => hash(`collection:${a.id}`) - hash(`collection:${b.id}`) || a.id.localeCompare(b.id)).slice(0, MAX_IMAGES);
}

function surface(document, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas, options) {
  try { return canvas.getContext('2d', options); }
  catch { return null; }
}

function makeGrain(document) {
  const tile = surface(document, 160, 160);
  const context = context2d(tile);
  if (!context?.createImageData) return null;
  const pixels = context.createImageData(160, 160);
  const next = random(hash('art-scene-grain'));
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const tone = next() > 0.52 ? 215 : 12;
    pixels.data[offset] = tone;
    pixels.data[offset + 1] = tone;
    pixels.data[offset + 2] = tone;
    pixels.data[offset + 3] = Math.round(8 + next() * 20);
  }
  context.putImageData(pixels, 0, 0);
  return tile;
}

function makeFog(document) {
  const tile = surface(document, 640, 640);
  const context = context2d(tile);
  if (!context) return null;
  const blooms = [[400, 170, 260, '107,136,114', 0.16], [210, 400, 250, '156,132,91', 0.13], [500, 490, 245, '138,98,77', 0.14]];
  for (const [x, y, radius, rgb, opacity] of blooms) {
    const bloom = context.createRadialGradient(x, y, 0, x, y, radius);
    bloom.addColorStop(0, `rgba(${rgb},${opacity})`);
    bloom.addColorStop(0.5, `rgba(${rgb},${opacity * 0.48})`);
    bloom.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = bloom;
    context.fillRect(0, 0, 640, 640);
  }
  return tile;
}

function makeParticles() {
  const next = random(hash('a-way-of-seeing-cloud'));
  const particles = [];
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(0.0001, next()))) * Math.cos(next() * Math.PI * 2);
  for (let index = 0; index < 1680; index++) {
    const group = index % 3;
    particles.push({
      group,
      x: gaussian() * (group === 1 ? 0.39 : 0.29),
      y: gaussian() * (group === 1 ? 0.29 : 0.37),
      phase: next() * Math.PI * 2,
      depth: 0.2 + next() * 0.8,
      size: next() > 0.97 ? 1.9 : 0.55 + next() * 0.65,
      opacity: 0.09 + next() * 0.26,
      color: index % PALETTE.length
    });
  }
  return particles;
}

function makePlanes(sources) {
  const next = random(hash('artwork-orbits-v1'));
  // Primary works remain large and separated. The rest form receding layers.
  const primary = [
    { x: 0.68, y: 0.205, size: 206, depth: 0.91, angle: -0.045 },
    { x: 0.895, y: 0.355, size: 192, depth: 0.85, angle: 0.048 },
    { x: 0.705, y: 0.655, size: 228, depth: 1, angle: -0.025 },
    { x: 0.91, y: 0.84, size: 190, depth: 0.94, angle: 0.035 },
    { x: 0.535, y: 0.475, size: 151, depth: 0.77, angle: 0.025 },
    { x: 0.57, y: 0.93, size: 150, depth: 0.74, angle: -0.04 }
  ];
  const planes = primary.map((position, index) => ({ ...position, index, layer: 2, phase: next() * Math.PI * 2 }));
  for (let index = 0; index < 12; index++) {
    const angle = index * 2.399963;
    const radius = 0.35 + Math.sqrt((index + 1) / 12) * 0.62;
    planes.push({
      index: index + 6,
      x: 0.79 + Math.cos(angle) * radius * 0.24,
      y: 0.5 + Math.sin(angle) * radius * 0.49,
      size: 73 + next() * 47,
      depth: 0.37 + next() * 0.21,
      angle: (next() - 0.5) * 0.17,
      phase: next() * Math.PI * 2,
      layer: 1
    });
  }
  for (let index = 0; index < 17; index++) {
    planes.push({
      index: index + 18,
      x: 0.56 + next() * 0.49,
      y: -0.04 + next() * 1.08,
      size: 27 + next() * 35,
      depth: 0.12 + next() * 0.16,
      angle: (next() - 0.5) * 0.26,
      phase: next() * Math.PI * 2,
      layer: 0
    });
  }
  return sources.length ? planes.sort((a, b) => a.depth - b.depth) : [];
}

/** Decorative collection scene. Viewing it never writes profile or study data. */
export function createTitleScene({ app, getWorks }) {
  if (!app || typeof getWorks !== 'function') throw new TypeError('createTitleScene requires app and getWorks.');
  const document = app.ownerDocument;
  const window = document?.defaultView;
  if (!window) return { sync() {}, destroy() {} };

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const tiles = new Map();
  const particles = makeParticles();
  const grain = makeGrain(document);
  const fog = makeFog(document);
  let userPaused = null;
  let mounted = null;
  let destroyed = false;

  const readSources = () => {
    try { return selectSources(getWorks(), document.baseURI); }
    catch { return []; }
  };

  function mount(canvas) {
    const context = context2d(canvas, { alpha: false, desynchronized: true }) || context2d(canvas);

    const state = {
      canvas, context, sources: [], signature: null, planes: [], pending: new Map(), failed: new Set(),
      controls: [], width: 0, height: 0, dpr: 1, visible: true, alive: true,
      frame: 0, clock: 0, clockStart: null, lastPaint: -Infinity,
      resizeObserver: null, intersectionObserver: null, background: null, grainPattern: null
    };
    canvas.classList.add('art-scene');
    canvas.dataset.sceneState = context ? 'loading' : 'unavailable';
    const now = () => window.performance?.now() ?? Date.now();
    const time = () => state.clock + (state.clockStart === null ? 0 : (now() - state.clockStart) / 1000);
    const paused = () => userPaused ?? !!reducedMotion?.matches;
    const canPaint = () => state.alive && !!context && state.width > 0 && state.height > 0 && !document.hidden && state.visible;
    const canAnimate = () => canPaint() && !paused();

    function updateStatus() {
      canvas.dataset.sceneImages = String(state.sources.filter(source => tiles.has(source.url)).length);
      canvas.dataset.sceneStatus = !context ? 'static' : !canPaint() ? 'suspended' : !paused() ? 'running' : userPaused === null && reducedMotion?.matches ? 'static' : 'paused';
    }

    function updateControls() {
      for (const control of state.controls) {
        control.textContent = context ? (paused() ? 'Play motion' : 'Pause motion') : 'Motion unavailable';
        control.setAttribute('aria-label', control.textContent);
        control.removeAttribute('aria-pressed');
        control.disabled = !context;
      }
      canvas.dataset.sceneMotion = paused() || !context ? 'paused' : 'playing';
      updateStatus();
    }

    function stop() {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      state.frame = 0;
      if (state.clockStart !== null) {
        state.clock = time();
        state.clockStart = null;
      }
    }

    function frame(timestamp) {
      state.frame = 0;
      if (!canAnimate()) { stop(); return; }
      if (timestamp - state.lastPaint >= FRAME_INTERVAL) {
        draw(time());
        state.lastPaint = Number.isFinite(state.lastPaint) ? timestamp - (timestamp - state.lastPaint) % FRAME_INTERVAL : timestamp;
      }
      state.frame = window.requestAnimationFrame(frame);
    }

    function refreshMotion() {
      updateControls();
      if (!canAnimate()) {
        stop();
        if (canPaint()) draw(time());
        return;
      }
      if (state.clockStart === null) state.clockStart = now();
      if (!state.frame) state.frame = window.requestAnimationFrame(frame);
    }

    function motionClick(event) {
      event.preventDefault();
      event.stopPropagation();
      userPaused = !paused();
      refreshMotion();
    }

    function bindControls() {
      const controls = [...app.querySelectorAll('[data-scene-motion]')];
      if (controls.length === state.controls.length && controls.every((control, index) => control === state.controls[index])) return;
      for (const control of state.controls) control.removeEventListener('click', motionClick);
      state.controls = controls;
      for (const control of controls) control.addEventListener('click', motionClick);
      updateControls();
    }

    function drawParticles(t, foreground) {
      const mobile = state.width < 700;
      const count = mobile ? 770 : particles.length;
      const clusterX = mobile ? [0.82, 0.66, 0.95] : [0.79, 0.72, 0.95];
      const clusterY = mobile ? [0.15, 0.89, 0.73] : [0.25, 0.63, 0.77];
      const radiusX = state.width * (mobile ? 0.44 : 0.32);
      const radiusY = state.height * (mobile ? 0.25 : 0.36);
      for (let index = foreground ? 0 : 1; index < count; index += foreground ? 9 : 1) {
        const point = particles[index];
        if (!foreground && index % 9 === 0) continue;
        const drift = t * (0.011 + point.depth * 0.008);
        const cos = Math.cos(drift), sin = Math.sin(drift);
        const px = point.x * cos - point.y * sin * 0.21;
        const py = point.y * cos + point.x * sin * 0.25;
        const x = state.width * clusterX[point.group] + px * radiusX + Math.sin(t * 0.07 + point.phase) * 3;
        const y = state.height * clusterY[point.group] + py * radiusY + Math.cos(t * 0.06 + point.phase) * 4;
        if (x < state.width * (mobile ? 0.1 : 0.43) || x > state.width || y < 0 || y > state.height) continue;
        const [red, green, blue] = PALETTE[point.color];
        context.fillStyle = `rgba(${red},${green},${blue},${point.opacity * (foreground ? 0.7 : 0.8)})`;
        context.fillRect(x, y, point.size, point.size);
      }
    }

    function drawPlane(plane, t) {
      const source = state.sources[plane.index % state.sources.length];
      const tile = tiles.get(source?.url);
      if (!tile) return;
      const mobile = state.width < 700;
      if (mobile && plane.layer === 2 && plane.index > 3) return;
      if (mobile && plane.layer === 0 && plane.index % 2) return;
      const desktopScale = clamp(Math.min(state.width / 1340, state.height / 850), 0.72, 1.16);
      const mobilePositions = [[0.73, 0.145, 152], [0.88, 0.725, 121], [0.53, 0.89, 183], [0.11, 0.97, 115]];
      let x = state.width * plane.x;
      let y = state.height * plane.y;
      let edge = plane.size * desktopScale;
      if (mobile) {
        if (plane.layer === 2) {
          const position = mobilePositions[plane.index];
          x = state.width * position[0];
          y = state.height * position[1];
          edge = Math.min(position[2], state.width * 0.43);
        } else {
          x = state.width * (0.30 + (plane.x - 0.5) * 1.2);
          y = state.height * (plane.y < 0.5 ? plane.y * 0.43 : 0.76 + (plane.y - 0.5) * 0.5);
          edge *= 0.66;
        }
      }
      const orbit = plane.phase + t * (0.031 + plane.depth * 0.013);
      const breathing = 1 + Math.sin(orbit) * 0.035;
      edge *= breathing;
      const ratio = tile.width / tile.height;
      const width = ratio >= 1 ? edge : edge * ratio;
      const height = ratio >= 1 ? edge / ratio : edge;
      x += Math.sin(orbit) * (mobile ? 7 : 12 + plane.depth * 8);
      y += Math.cos(orbit * 0.83) * (mobile ? 6 : 9 + plane.depth * 8);
      // Keep every primary work whole, including narrow and tall canvases.
      if (plane.layer === 2) {
        const margin = 15 + edge * 0.045;
        x = clamp(x, width / 2 + margin, state.width - width / 2 - margin);
        y = clamp(y, height / 2 + margin, state.height - height / 2 - margin);
      }
      context.save();
      context.translate(x, y);
      context.rotate(plane.angle + Math.sin(orbit * 0.6) * 0.012);
      context.globalAlpha = plane.layer === 2 ? 0.84 + plane.depth * 0.1 : plane.layer === 1 ? 0.28 + plane.depth * 0.23 : 0.12 + plane.depth * 0.22;
      if (plane.layer === 2) {
        context.shadowColor = 'rgba(3,12,8,0.30)';
        context.shadowBlur = 18;
        context.shadowOffsetY = 7;
      }
      context.drawImage(tile, -width / 2, -height / 2, width, height);
      context.restore();
    }

    function draw(t) {
      if (!canPaint()) return;
      const { width, height, dpr } = state;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.globalAlpha = 1;
      context.fillStyle = state.background || BACKGROUND;
      context.fillRect(0, 0, width, height);
      if (fog) {
        context.globalAlpha = 0.8;
        const offset = Math.sin(t * 0.025) * 24;
        context.drawImage(fog, width * 0.36 + offset, -height * 0.1, width * 0.77, height * 1.22);
        context.globalAlpha = 1;
      }
      drawParticles(t, false);
      for (const plane of state.planes) drawPlane(plane, t);
      drawParticles(t, true);

      // This veil keeps the text area quiet without putting the collection in a box.
      const veil = context.createLinearGradient(0, 0, width, 0);
      const stops = width < 700 ? [[0, 0.54], [0.45, 0.15], [1, 0.04]] : [[0, 1], [0.35, 1], [0.43, 0.96], [0.52, 0.60], [0.64, 0.04], [1, 0]];
      for (const [position, opacity] of stops) veil.addColorStop(position, `rgba(23,37,31,${opacity})`);
      context.fillStyle = veil;
      context.fillRect(0, 0, width, height);
      if (width < 700) {
        const centre = context.createLinearGradient(0, 0, 0, height);
        for (const [position, opacity] of [[0, 0.05], [0.24, 0.38], [0.34, 0.96], [0.63, 0.97], [0.77, 0.12], [1, 0.03]]) centre.addColorStop(position, `rgba(23,37,31,${opacity})`);
        context.fillStyle = centre;
        context.fillRect(0, 0, width, height);
      }
      if (state.grainPattern) {
        context.globalAlpha = 0.30;
        context.fillStyle = state.grainPattern;
        context.fillRect(0, 0, width, height);
        context.globalAlpha = 1;
      }
    }

    function resize() {
      if (!state.alive) return;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(0, Math.round(bounds.width));
      const height = Math.max(0, Math.round(bounds.height));
      const dpr = clamp(Number(window.devicePixelRatio) || 1, 1, MAX_DPR);
      const wasVisible = state.visible;
      if (!window.IntersectionObserver) state.visible = bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth;
      if (state.width === width && state.height === height && state.dpr === dpr) {
        if (wasVisible !== state.visible) refreshMotion();
        return;
      }
      state.width = width;
      state.height = height;
      state.dpr = dpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (context) {
        state.background = context.createLinearGradient(0, 0, width, height);
        state.background.addColorStop(0, BACKGROUND);
        state.background.addColorStop(0.55, '#1b2b23');
        state.background.addColorStop(1, '#14231d');
        state.grainPattern = grain ? context.createPattern(grain, 'repeat') : null;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
      }
      refreshMotion();
    }

    function cancelImage(entry) {
      entry.image.onload = null;
      entry.image.onerror = null;
      entry.image.removeAttribute('src');
    }

    function refreshSources() {
      const sources = readSources();
      const signature = sources.map(source => `${source.id}|${source.url}`).join('\n');
      if (signature === state.signature) return;
      state.signature = signature;
      state.sources = sources;
      state.planes = makePlanes(sources);
      const wanted = new Set(sources.map(source => source.url));
      for (const [url, entry] of state.pending) {
        if (!wanted.has(url)) { cancelImage(entry); state.pending.delete(url); }
      }
      for (const url of tiles.keys()) if (!wanted.has(url)) tiles.delete(url);
      if (!context) return;
      for (const source of sources) {
        if (tiles.has(source.url) || state.pending.has(source.url) || state.failed.has(source.url)) continue;
        const image = new window.Image();
        image.decoding = 'async';
        const entry = { image };
        state.pending.set(source.url, entry);
        image.onload = () => {
          if (!state.alive || !state.pending.has(source.url)) return;
          const width = image.naturalWidth, height = image.naturalHeight;
          if (width > 0 && height > 0) {
            // A bounded, downsampled tile avoids repeatedly scaling decoded museum files.
            const scale = Math.min(1, 480 / Math.max(width, height));
            const tile = surface(document, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
            const tileContext = context2d(tile);
            if (tileContext) {
              tileContext.filter = 'saturate(0.82) brightness(0.97)';
              tileContext.drawImage(image, 0, 0, tile.width, tile.height);
              tiles.set(source.url, tile);
            }
          }
          state.pending.delete(source.url);
          cancelImage(entry);
          canvas.dataset.sceneState = tiles.size ? 'ready' : 'atmosphere';
          updateStatus();
          if (canPaint() && !canAnimate()) draw(time());
        };
        image.onerror = () => {
          if (!state.alive) return;
          state.pending.delete(source.url);
          state.failed.add(source.url);
          cancelImage(entry);
          if (!state.pending.size) canvas.dataset.sceneState = tiles.size ? 'ready' : 'atmosphere';
          updateStatus();
        };
        image.src = source.url;
      }
      if (!sources.length) canvas.dataset.sceneState = 'atmosphere';
      else if (sources.every(source => tiles.has(source.url))) canvas.dataset.sceneState = 'ready';
      updateStatus();
      if (canPaint() && !canAnimate()) draw(time());
    }

    const visibilityChange = () => { state.lastPaint = -Infinity; refreshMotion(); };
    const preferenceChange = () => refreshMotion();
    const scrollVisibility = () => {
      const bounds = canvas.getBoundingClientRect();
      const visible = bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth;
      if (visible !== state.visible) { state.visible = visible; refreshMotion(); }
    };
    document.addEventListener('visibilitychange', visibilityChange);
    if (reducedMotion?.addEventListener) reducedMotion.addEventListener('change', preferenceChange);
    else reducedMotion?.addListener?.(preferenceChange);
    if (window.ResizeObserver) {
      state.resizeObserver = new window.ResizeObserver(resize);
      state.resizeObserver.observe(canvas);
    }
    // Window resize also catches a DPR change when the CSS dimensions stay the same.
    window.addEventListener('resize', resize, { passive: true });
    if (window.IntersectionObserver) {
      state.intersectionObserver = new window.IntersectionObserver(entries => {
        if (!state.alive) return;
        const entry = entries.find(item => item.target === canvas);
        if (!entry) return;
        state.visible = entry.isIntersecting;
        state.lastPaint = -Infinity;
        refreshMotion();
      }, { threshold: 0 });
      state.intersectionObserver.observe(canvas);
    } else window.addEventListener('scroll', scrollVisibility, { passive: true, capture: true });
    bindControls();
    resize();
    refreshSources();

    return {
      canvas,
      sync() { bindControls(); resize(); refreshSources(); },
      destroy() {
        if (!state.alive) return;
        stop();
        state.alive = false;
        state.resizeObserver?.disconnect();
        state.intersectionObserver?.disconnect();
        document.removeEventListener('visibilitychange', visibilityChange);
        window.removeEventListener('resize', resize);
        if (!window.IntersectionObserver) window.removeEventListener('scroll', scrollVisibility, true);
        if (reducedMotion?.removeEventListener) reducedMotion.removeEventListener('change', preferenceChange);
        else reducedMotion?.removeListener?.(preferenceChange);
        for (const control of state.controls) control.removeEventListener('click', motionClick);
        for (const entry of state.pending.values()) cancelImage(entry);
        state.pending.clear();
        state.sources = [];
        state.planes = [];
        state.controls = [];
        // Release the previous viewport buffer as soon as the title leaves the DOM.
        canvas.width = 1;
        canvas.height = 1;
        state.background = null;
        state.grainPattern = null;
      }
    };
  }

  function sync() {
    if (destroyed) return;
    const canvas = app.querySelector('canvas[data-art-scene]');
    if (canvas !== mounted?.canvas) {
      mounted?.destroy();
      mounted = canvas ? mount(canvas) : null;
    } else mounted?.sync();
  }

  // App screens are replaced at the direct-child boundary. Do not observe the
  // full subtree, where control labels and study interactions also change.
  const observer = window.MutationObserver ? new window.MutationObserver(sync) : null;
  observer?.observe(app, { childList: true });
  sync();

  return {
    sync,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      mounted?.destroy();
      mounted = null;
      tiles.clear();
      if (grain) grain.width = grain.height = 1;
      if (fog) fog.width = fog.height = 1;
    }
  };
}
