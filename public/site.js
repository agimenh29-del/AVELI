const carouselStage = document.getElementById('carouselStage');
const musicPlayer = document.getElementById('musicPlayer');
const desktopOverlay = document.getElementById('desktopOverlay');
const productGrid = document.getElementById('productGrid');
const archiveGrid = document.getElementById('archiveGrid');
const productWindowTemplate = document.getElementById('productWindowTemplate');
const AUDIO_STATE_KEY = 'aveli_audio_state_v1';
const DESKTOP_POS_KEY = 'aveli_desktop_positions_v1';

const isVideo = (url) => /\.(mp4|mov|webm)$/i.test(url);
const isGif = (url = '') => /\.gif(\?|$)/i.test(url);

let playlist = [];
let currentTrackIndex = -1;
let timeSaveTick = 0;
let activeWindowDrag = null;
let topProductWindowZ = 2200;

const getProductMedia = (product) => {
  if (Array.isArray(product?.media) && product.media.length) return product.media;
  if (product?.imageUrl) return [product.imageUrl];
  return [];
};

const getProductPrimaryMedia = (product) => {
  const primary = String(product?.imageUrl || '').trim();
  if (primary) return primary;
  const media = getProductMedia(product);
  return media[0] || '';
};

const buildItem = (item) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'carousel-item';

  if (isVideo(item.url)) {
    const video = document.createElement('video');
    video.src = item.url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    wrapper.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.loading = 'eager';
    if (isGif(item.url)) {
      img.classList.add('is-gif');
      wrapper.classList.add('carousel-item-gif');
    }
    wrapper.appendChild(img);
  }

  return wrapper;
};

const loadAudioState = () => {
  try {
    const raw = localStorage.getItem(AUDIO_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveAudioState = () => {
  if (!musicPlayer || !playlist.length || currentTrackIndex < 0) return;
  const payload = {
    trackIndex: currentTrackIndex,
    trackUrl: playlist[currentTrackIndex]?.url || '',
    currentTime: Number.isFinite(musicPlayer.currentTime) ? musicPlayer.currentTime : 0,
    isPlaying: !musicPlayer.paused,
    playlist: playlist.map((track) => track?.url || '').join('|')
  };
  try {
    localStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(payload));
  } catch {}
};

const samePlaylist = (state) => {
  if (!state || !Array.isArray(playlist)) return false;
  const current = playlist.map((track) => track?.url || '').join('|');
  return current && current === state.playlist;
};

const renderCarousel = (items) => {
  if (!carouselStage) return;
  carouselStage.innerHTML = '';

  if (!items.length) {
    carouselStage.innerHTML = '<p class="carousel-empty">no media uploaded yet.</p>';
    return;
  }

  const track = document.createElement('div');
  track.className = 'carousel-track';

  const sequence = [...items, ...items];
  sequence.forEach((item) => {
    track.appendChild(buildItem(item));
  });

  const duration = Math.max(140, items.length * 36);
  track.style.animationDuration = `${duration}s`;

  carouselStage.appendChild(track);
};

const setTrack = (index, options = {}) => {
  if (!playlist.length || !musicPlayer) return;
  const shouldPlay = Boolean(options.shouldPlay);
  const startAt = Number(options.startAt || 0);

  currentTrackIndex = (index + playlist.length) % playlist.length;
  const track = playlist[currentTrackIndex];

  musicPlayer.src = track.url;
  musicPlayer.load();
  const playSafely = () => musicPlayer.play().catch(() => {});

  if (startAt > 0) {
    const applyStartAndMaybePlay = () => {
      try {
        musicPlayer.currentTime = startAt;
      } catch {}
      if (shouldPlay) playSafely();
    };
    if (musicPlayer.readyState >= 1) {
      applyStartAndMaybePlay();
    } else {
      musicPlayer.addEventListener('loadedmetadata', applyStartAndMaybePlay, { once: true });
    }
    return;
  }

  if (shouldPlay) playSafely();
};

const renderMusic = (tracks) => {
  if (!musicPlayer) return;
  playlist = tracks;

  if (!playlist.length) {
    currentTrackIndex = -1;
    musicPlayer.removeAttribute('src');
    musicPlayer.load();
    return;
  }

  const savedState = loadAudioState();
  if (savedState && samePlaylist(savedState)) {
    let restoredIndex = Number.isInteger(savedState.trackIndex) ? savedState.trackIndex : 0;
    if (savedState.trackUrl) {
      const byUrl = playlist.findIndex((track) => track?.url === savedState.trackUrl);
      if (byUrl >= 0) restoredIndex = byUrl;
    }
    setTrack(restoredIndex, {
      shouldPlay: Boolean(savedState.isPlaying),
      startAt: Number(savedState.currentTime || 0)
    });
  } else {
    setTrack(0, { shouldPlay: true });
  }

  // Retry playback on first user interaction if autoplay is blocked.
  const unlock = () => {
    musicPlayer.play().catch(() => {});
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
};

const renderProductGrid = (grid, products, emptyText) => {
  if (!grid) return;
  grid.innerHTML = '';
  if (!products?.length) {
    grid.innerHTML = `<p class="sound-title">${emptyText}</p>`;
    return;
  }

  products.forEach((product) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'product-card';
    card.setAttribute('aria-label', `open ${product.name || 'product'}`);

    const icon = document.createElement('div');
    icon.className = 'product-icon';
    const primaryMedia = getProductPrimaryMedia(product);
    if (primaryMedia) {
      const img = document.createElement('img');
      img.src = primaryMedia;
      img.alt = product.name || 'product image';
      img.className = 'product-preview';
      if (isGif(primaryMedia)) img.classList.add('is-gif');
      icon.appendChild(img);
    }
    card.appendChild(icon);

    const name = document.createElement('p');
    name.className = 'product-name';
    name.textContent = product.name || 'untitled';

    const meta = document.createElement('p');
    meta.className = 'sound-title';
    meta.textContent = [product.price, product.description].filter(Boolean).join(' • ');

    card.appendChild(name);
    card.appendChild(meta);
    card.addEventListener('click', () => openProductModal(product, card.getBoundingClientRect()));
    grid.appendChild(card);
  });
};

const loadDesktopPositions = () => {
  try {
    const raw = localStorage.getItem(DESKTOP_POS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveDesktopPositions = (positions) => {
  try {
    localStorage.setItem(DESKTOP_POS_KEY, JSON.stringify(positions));
  } catch {}
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const renderDesktopProducts = (products) => {
  if (!desktopOverlay) return;
  desktopOverlay.innerHTML = '';

  if (!products?.length) return;

  const positions = loadDesktopPositions();
  const overlayRect = desktopOverlay.getBoundingClientRect();
  const iconWidth = 112;
  const iconHeight = 132;
  const margin = 12;
  const cols = Math.max(1, Math.floor((overlayRect.width - margin * 2) / 120));

  const persistCardPosition = (card, productId) => {
    const maxLeft = Math.max(1, desktopOverlay.clientWidth - card.offsetWidth);
    const maxTop = Math.max(1, desktopOverlay.clientHeight - card.offsetHeight);
    positions[productId] = {
      x: clamp(parseFloat(card.style.left) / maxLeft, 0, 1),
      y: clamp(parseFloat(card.style.top) / maxTop, 0, 1)
    };
    saveDesktopPositions(positions);
  };

  products.forEach((product, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'product-card';
    card.setAttribute('aria-label', `open ${product.name || 'product'}`);

    const icon = document.createElement('div');
    icon.className = 'product-icon';
    const primaryMedia = getProductPrimaryMedia(product);
    if (primaryMedia) {
      const img = document.createElement('img');
      img.src = primaryMedia;
      img.alt = product.name || 'product image';
      img.className = 'product-preview';
      if (isGif(primaryMedia)) img.classList.add('is-gif');
      icon.appendChild(img);
    }
    card.appendChild(icon);

    const name = document.createElement('p');
    name.className = 'product-name';
    name.textContent = product.name || 'untitled';
    card.appendChild(name);
    desktopOverlay.appendChild(card);

    const saved = positions[product.id];
    const maxLeft = Math.max(0, desktopOverlay.clientWidth - iconWidth);
    const maxTop = Math.max(0, desktopOverlay.clientHeight - iconHeight);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      card.style.left = `${clamp(saved.x, 0, 1) * maxLeft}px`;
      card.style.top = `${clamp(saved.y, 0, 1) * maxTop}px`;
    } else {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const left = margin + col * 120;
      const top = 120 + row * 140;
      card.style.left = `${clamp(left, 0, maxLeft)}px`;
      card.style.top = `${clamp(top, 0, maxTop)}px`;
      persistCardPosition(card, product.id);
    }

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let moved = false;

    card.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      card.setPointerCapture(pointerId);
      card.classList.add('is-dragging');
      startX = event.clientX;
      startY = event.clientY;
      originLeft = parseFloat(card.style.left) || 0;
      originTop = parseFloat(card.style.top) || 0;
      moved = false;
      event.preventDefault();
    });

    card.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

      const maxCardLeft = Math.max(0, desktopOverlay.clientWidth - card.offsetWidth);
      const maxCardTop = Math.max(0, desktopOverlay.clientHeight - card.offsetHeight);
      const nextLeft = clamp(originLeft + dx, 0, maxCardLeft);
      const nextTop = clamp(originTop + dy, 0, maxCardTop);
      card.style.left = `${nextLeft}px`;
      card.style.top = `${nextTop}px`;
    });

    const finishPointer = (event) => {
      if (pointerId !== event.pointerId) return;
      card.releasePointerCapture(pointerId);
      card.classList.remove('is-dragging');
      pointerId = null;
      if (!moved) {
        openProductModal(product, card.getBoundingClientRect());
      } else {
        persistCardPosition(card, product.id);
      }
    };

    card.addEventListener('pointerup', finishPointer);
    card.addEventListener('pointercancel', finishPointer);
  });
};

const renderProducts = (products) => {
  const allProducts = Array.isArray(products) ? products : [];
  const liveProducts = allProducts.filter((product) => (product?.status || 'live') !== 'archive');
  const archivedProducts = allProducts.filter((product) => (product?.status || 'live') === 'archive');
  if (desktopOverlay) {
    renderDesktopProducts(liveProducts);
  } else {
    renderProductGrid(productGrid, liveProducts, 'no live products yet.');
  }
  renderProductGrid(archiveGrid, archivedProducts, 'no archived products yet.');
};

const scrollToSectionForPath = (path) => {
  const normalized = path === '/' ? '/' : String(path || '').replace(/\/+$/, '');
  if (normalized === '/product') {
    const section = document.getElementById('product');
    if (!section) return false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  if (normalized === '/archive') {
    const section = document.getElementById('archive');
    if (!section) return false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  if (normalized === '/') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  return false;
};

const setupMenuRouting = () => {
  const targets = new Set(['/', '/product', '/archive']);
  document.querySelectorAll('.top-nav a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!targets.has(href)) return;
    link.addEventListener('click', (event) => {
      if (!scrollToSectionForPath(href)) return;
      event.preventDefault();
      if (window.location.pathname !== href) {
        history.pushState({}, '', href);
      }
    });
  });

  window.addEventListener('popstate', () => {
    scrollToSectionForPath(window.location.pathname);
  });
};

const getOpenProductWindows = () => Array.from(document.querySelectorAll('.product-window[data-window-instance="true"]'));

const bringProductWindowToFront = (windowEl) => {
  if (!windowEl) return;
  topProductWindowZ += 1;
  windowEl.style.zIndex = `${topProductWindowZ}`;
};

const positionProductWindow = (windowEl, sourceRect) => {
  if (!windowEl) return;
  const pad = 10;
  const width = windowEl.offsetWidth || 460;
  const height = windowEl.offsetHeight || 320;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const openCount = getOpenProductWindows().length;

  let left = 24;
  let top = 110;
  if (sourceRect) {
    left = sourceRect.left + 18 + openCount * 16;
    top = sourceRect.top + 18 + openCount * 14;
  } else {
    left += openCount * 16;
    top += openCount * 14;
  }

  const maxLeft = Math.max(pad, viewportWidth - width - pad);
  const maxTop = Math.max(pad, viewportHeight - height - pad);
  windowEl.style.left = `${clamp(left, pad, maxLeft)}px`;
  windowEl.style.top = `${clamp(top, pad, maxTop)}px`;
};

const openProductModal = (product, sourceRect = null) => {
  if (!productWindowTemplate) return;
  const productWindow = productWindowTemplate.cloneNode(true);
  productWindow.removeAttribute('id');
  productWindow.dataset.windowInstance = 'true';
  productWindow.hidden = false;

  const windowHeader = productWindow.querySelector('.product-window-header');
  const windowTitle = productWindow.querySelector('.product-modal-title');
  const windowMeta = productWindow.querySelector('.product-modal-meta');
  const windowMedia = productWindow.querySelector('.product-modal-media');
  const windowBuy = productWindow.querySelector('.product-modal-buy');
  const windowClose = productWindow.querySelector('.product-modal-close');

  if (!windowHeader || !windowTitle || !windowMeta || !windowMedia || !windowBuy || !windowClose) return;

  const mediaItems = getProductMedia(product);
  windowTitle.textContent = product.name || 'untitled';
  windowMeta.textContent = [product.price, product.description].filter(Boolean).join(' • ') || 'no details';
  windowMedia.innerHTML = '';

  if (!mediaItems.length) {
    windowMedia.innerHTML = '<p class="sound-title">no media available.</p>';
  } else {
    mediaItems.forEach((url) => {
      const item = document.createElement('div');
      item.className = 'product-modal-item';

      if (isVideo(url)) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        item.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = product.name || 'product media';
        img.loading = 'lazy';
        if (isGif(url)) img.classList.add('is-gif');
        item.appendChild(img);
      }

      windowMedia.appendChild(item);
    });
  }

  if (product.stripeUrl) {
    windowBuy.hidden = false;
    windowBuy.href = product.stripeUrl;
  } else {
    windowBuy.hidden = true;
    windowBuy.removeAttribute('href');
  }

  windowClose.addEventListener('click', () => {
    if (activeWindowDrag?.windowEl === productWindow) activeWindowDrag = null;
    productWindow.remove();
  });

  windowHeader.addEventListener('pointerdown', (event) => {
    const targetTag = event.target?.tagName?.toLowerCase();
    if (targetTag === 'button' || targetTag === 'a') return;
    const startLeft = parseFloat(productWindow.style.left) || productWindow.getBoundingClientRect().left;
    const startTop = parseFloat(productWindow.style.top) || productWindow.getBoundingClientRect().top;
    activeWindowDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: startLeft,
      top: startTop,
      windowEl: productWindow,
      headerEl: windowHeader
    };
    bringProductWindowToFront(productWindow);
    windowHeader.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  windowHeader.addEventListener('pointermove', (event) => {
    if (!activeWindowDrag || activeWindowDrag.pointerId !== event.pointerId || activeWindowDrag.windowEl !== productWindow) return;
    const dx = event.clientX - activeWindowDrag.startX;
    const dy = event.clientY - activeWindowDrag.startY;
    const width = productWindow.offsetWidth || 460;
    const height = productWindow.offsetHeight || 320;
    const maxLeft = Math.max(10, window.innerWidth - width - 10);
    const maxTop = Math.max(10, window.innerHeight - height - 10);
    const left = clamp(activeWindowDrag.left + dx, 10, maxLeft);
    const top = clamp(activeWindowDrag.top + dy, 10, maxTop);
    productWindow.style.left = `${left}px`;
    productWindow.style.top = `${top}px`;
  });

  const endDrag = (event) => {
    if (!activeWindowDrag || activeWindowDrag.pointerId !== event.pointerId || activeWindowDrag.windowEl !== productWindow) return;
    activeWindowDrag.headerEl.releasePointerCapture(event.pointerId);
    activeWindowDrag = null;
  };
  windowHeader.addEventListener('pointerup', endDrag);
  windowHeader.addEventListener('pointercancel', endDrag);

  productWindow.addEventListener('pointerdown', () => bringProductWindowToFront(productWindow));

  document.body.appendChild(productWindow);
  bringProductWindowToFront(productWindow);
  positionProductWindow(productWindow, sourceRect);
  windowClose.focus();
};

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const windows = getOpenProductWindows();
  if (!windows.length) return;
  const topWindow = windows
    .slice()
    .sort((a, b) => (parseInt(a.style.zIndex || '0', 10) || 0) - (parseInt(b.style.zIndex || '0', 10) || 0))
    .pop();
  if (topWindow) topWindow.remove();
});

if (musicPlayer) {
  musicPlayer.addEventListener('ended', () => {
    if (!playlist.length) return;
    setTrack(currentTrackIndex + 1, { shouldPlay: true });
  });
  musicPlayer.addEventListener('play', saveAudioState);
  musicPlayer.addEventListener('pause', saveAudioState);
  musicPlayer.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - timeSaveTick < 1000) return;
    timeSaveTick = now;
    saveAudioState();
  });
}

window.addEventListener('pagehide', saveAudioState);
window.addEventListener('beforeunload', saveAudioState);

const loadContent = async () => {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();
    renderCarousel(data.media || []);
    renderMusic(data.music || []);
    renderProducts(data.products || []);
  } catch {
    if (carouselStage) carouselStage.innerHTML = '<p class="carousel-empty">unable to load media.</p>';
    if (productGrid) productGrid.innerHTML = '<p class="sound-title">unable to load products.</p>';
    if (archiveGrid) archiveGrid.innerHTML = '<p class="sound-title">unable to load archive.</p>';
  }
};

loadContent();
setupMenuRouting();
