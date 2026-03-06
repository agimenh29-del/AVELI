const loginPanel = document.getElementById('loginPanel');
const uploadPanel = document.getElementById('uploadPanel');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const mediaFilesInput = document.getElementById('mediaFiles');
const musicFilesInput = document.getElementById('musicFiles');
const uploadMediaBtn = document.getElementById('uploadMediaBtn');
const uploadMusicBtn = document.getElementById('uploadMusicBtn');
const uploadStatus = document.getElementById('uploadStatus');
const logoutBtn = document.getElementById('logoutBtn');
const mediaLibrary = document.getElementById('mediaLibrary');
const musicLibrary = document.getElementById('musicLibrary');
const refreshLibraryBtn = document.getElementById('refreshLibraryBtn');
const selectAllMediaBtn = document.getElementById('selectAllMediaBtn');
const removeSelectedMediaBtn = document.getElementById('removeSelectedMediaBtn');
const clearMediaBtn = document.getElementById('clearMediaBtn');
const selectAllMusicBtn = document.getElementById('selectAllMusicBtn');
const removeSelectedMusicBtn = document.getElementById('removeSelectedMusicBtn');
const clearMusicBtn = document.getElementById('clearMusicBtn');
const productNameInput = document.getElementById('productName');
const productPriceInput = document.getElementById('productPrice');
const productDescriptionInput = document.getElementById('productDescription');
const productStripeUrlInput = document.getElementById('productStripeUrl');
const productStatusInput = document.getElementById('productStatus');
const productMediaInput = document.getElementById('productMedia');
const addProductBtn = document.getElementById('addProductBtn');
const productLibrary = document.getElementById('productLibrary');
const adminTabs = [...document.querySelectorAll('.admin-tab')];
const adminTabPanels = [...document.querySelectorAll('.admin-tab-panel')];

let mediaItems = [];
let musicItems = [];
let productItems = [];

const setAuthView = (isAuthed) => {
  loginPanel.style.display = isAuthed ? 'none' : 'block';
  uploadPanel.style.display = isAuthed ? 'block' : 'none';
};

const setAdminTab = (tabName) => {
  const target = String(tabName || 'library').trim().toLowerCase();
  adminTabs.forEach((tab) => {
    const isActive = tab.dataset.tabTarget === target;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  adminTabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === target;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
};

const showStatus = (el, text) => {
  el.textContent = text;
};

const postJson = async (url, payload = {}) => {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

const parseError = async (res, fallback) => {
  try {
    const body = await res.json();
    return body?.error ? `${fallback} (${body.error.toLowerCase()})` : fallback;
  } catch {
    return fallback;
  }
};

const isVideoMedia = (url = '') => /\.(mp4|mov|webm)(\?|$)/i.test(url);

const getCheckedNames = (kind) => {
  const selector = kind === 'media' ? 'input[data-kind="media"]:checked' : 'input[data-kind="music"]:checked';
  return [...document.querySelectorAll(selector)].map((input) => input.value);
};

const setAllChecked = (kind, checked) => {
  const selector = kind === 'media' ? 'input[data-kind="media"]' : 'input[data-kind="music"]';
  document.querySelectorAll(selector).forEach((input) => {
    input.checked = checked;
  });
};

const createLibraryItem = (item, kind, deleteEndpoint, onDone) => {
  const row = document.createElement('div');
  row.className = 'library-item';
  if (kind === 'media') row.classList.add('library-item-media');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'library-check';
  check.value = item.name;
  check.dataset.kind = kind;

  const name = document.createElement('span');
  name.className = 'library-name';
  name.textContent = item.name;

  const mediaPreview = document.createElement('a');
  mediaPreview.className = 'library-preview';
  mediaPreview.href = item.url || '#';
  mediaPreview.target = '_blank';
  mediaPreview.rel = 'noopener noreferrer';
  mediaPreview.setAttribute('aria-label', item.name || 'media preview');
  mediaPreview.hidden = kind !== 'media' || !item.url;
  if (!mediaPreview.hidden) {
    if (isVideoMedia(item.url)) {
      const video = document.createElement('video');
      video.src = item.url;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'metadata';
      mediaPreview.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name || 'media preview';
      img.loading = 'lazy';
      mediaPreview.appendChild(img);
    }
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'danger-btn';
  removeBtn.textContent = 'remove';

  removeBtn.addEventListener('click', async () => {
    removeBtn.disabled = true;
    showStatus(uploadStatus, `removing ${item.name}...`);

    const res = await postJson(deleteEndpoint, { name: item.name });
    if (!res.ok) {
      const message = await parseError(res, `failed to remove ${item.name}.`);
      showStatus(uploadStatus, message);
      removeBtn.disabled = false;
      return;
    }

    showStatus(uploadStatus, `${item.name} removed.`);
    await onDone();
  });

  row.appendChild(check);
  row.appendChild(mediaPreview);
  row.appendChild(name);
  row.appendChild(removeBtn);
  return row;
};

const renderLibrary = (data) => {
  mediaLibrary.innerHTML = '';
  musicLibrary.innerHTML = '';
  productLibrary.innerHTML = '';

  mediaItems = data.media || [];
  musicItems = data.music || [];
  productItems = data.products || [];

  if (!mediaItems.length) {
    mediaLibrary.innerHTML = '<p class="muted">no media files.</p>';
  } else {
    mediaItems.forEach((item) => {
      mediaLibrary.appendChild(createLibraryItem(item, 'media', '/api/admin/delete-media', loadLibrary));
    });
  }

  if (!musicItems.length) {
    musicLibrary.innerHTML = '<p class="muted">no music files.</p>';
  } else {
    musicItems.forEach((item) => {
      musicLibrary.appendChild(createLibraryItem(item, 'music', '/api/admin/delete-music', loadLibrary));
    });
  }

  if (!productItems.length) {
    productLibrary.innerHTML = '<p class="muted">no products yet.</p>';
  } else {
    productItems.forEach((product) => {
      const row = document.createElement('div');
      row.className = 'library-item product-row';

      const header = document.createElement('div');
      header.className = 'product-row-header';

      const title = document.createElement('strong');
      title.className = 'product-row-title';
      title.textContent = product.name || 'untitled';

      const meta = document.createElement('span');
      meta.className = 'product-row-meta';
      meta.textContent = `id: ${String(product.id || '').slice(0, 12)}`;

      header.appendChild(title);
      header.appendChild(meta);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = product.name || '';
      nameInput.placeholder = 'product name';
      nameInput.dataset.liveEdit = 'true';
      nameInput.addEventListener('input', () => {
        title.textContent = nameInput.value.trim() || 'untitled';
      });

      const priceInput = document.createElement('input');
      priceInput.type = 'text';
      priceInput.value = product.price || '';
      priceInput.placeholder = 'price';
      priceInput.dataset.liveEdit = 'true';

      const descriptionInput = document.createElement('input');
      descriptionInput.type = 'text';
      descriptionInput.value = product.description || '';
      descriptionInput.placeholder = 'description';
      descriptionInput.dataset.liveEdit = 'true';

      const stripeInput = document.createElement('input');
      stripeInput.type = 'url';
      stripeInput.value = product.stripeUrl || '';
      stripeInput.placeholder = 'stripe checkout url';
      stripeInput.dataset.liveEdit = 'true';

      const statusSelect = document.createElement('select');
      statusSelect.innerHTML = '<option value="live">live</option><option value="archive">archive</option>';
      statusSelect.value = product.status === 'archive' ? 'archive' : 'live';

      const mediaInput = document.createElement('input');
      mediaInput.type = 'file';
      mediaInput.accept = 'image/*,video/*';
      mediaInput.multiple = true;
      mediaInput.dataset.liveEdit = 'true';

      const mediaList = document.createElement('div');
      mediaList.className = 'product-media-list';
      let mediaOrder = Array.isArray(product.media) ? [...product.media] : product.imageUrl ? [product.imageUrl] : [];
      let autosaveTimer = null;
      let autosaveController = null;
      let autosaveNonce = 0;
      const getCurrentMediaOrder = () => {
        const urls = [...mediaList.querySelectorAll('.product-media-item[data-media-url]')]
          .map((item) => String(item.dataset.mediaUrl || '').trim())
          .filter(Boolean);
        return urls.length ? urls : mediaOrder;
      };

      const autosaveMediaOrder = async (order) => {
        if (statusSelect.value !== 'live') return;
        if (autosaveController) autosaveController.abort();
        autosaveController = new AbortController();
        autosaveNonce += 1;
        const requestNonce = autosaveNonce;
        const currentOrder = Array.isArray(order) ? order : getCurrentMediaOrder();
        const form = new FormData();
        form.append('id', product.id);
        form.append('status', statusSelect.value);
        form.append('mediaOrder', JSON.stringify(currentOrder));
        if (currentOrder[0]) form.append('primaryMedia', currentOrder[0]);

        try {
          const res = await fetch('/api/admin/products/update', {
            method: 'POST',
            body: form,
            signal: autosaveController.signal
          });
          if (requestNonce !== autosaveNonce) return;
          if (!res.ok) {
            const message = await parseError(res, `failed to save media order for ${product.name}.`);
            showStatus(uploadStatus, message);
            return;
          }
          showStatus(uploadStatus, `${product.name} media order saved.`);
        } catch (error) {
          if (error?.name !== 'AbortError') {
            showStatus(uploadStatus, `failed to save media order for ${product.name}.`);
          }
        }
      };

      const queueAutosaveMediaOrder = () => {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        const currentOrder = [...mediaOrder];
        autosaveTimer = setTimeout(() => {
          autosaveMediaOrder(currentOrder);
        }, 220);
      };

      const renderMediaEditor = () => {
        mediaList.innerHTML = '';
        if (!mediaOrder.length) {
          mediaList.innerHTML = '<span class="muted">no product media</span>';
          return;
        }

        let draggedIndex = -1;

        mediaOrder.forEach((url, index) => {
          const item = document.createElement('div');
          item.className = 'product-media-item';
          item.draggable = statusSelect.value === 'live';
          item.dataset.index = String(index);
          item.dataset.mediaUrl = url;

          const preview = document.createElement('a');
          preview.href = url;
          preview.target = '_blank';
          preview.rel = 'noopener noreferrer';
          preview.className = 'product-media-preview';
          if (isVideoMedia(url)) {
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            preview.appendChild(video);
          } else {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `media ${index + 1}`;
            img.loading = 'lazy';
            preview.appendChild(img);
          }

          const label = document.createElement('span');
          label.className = 'product-media-label';
          label.textContent = `media ${index + 1}`;

          const actions = document.createElement('div');
          actions.className = 'product-media-actions';
          actions.innerHTML = '<button type="button">up</button><button type="button">down</button><button type="button">remove</button>';
          const [upBtn, downBtn, removeBtnItem] = [...actions.querySelectorAll('button')];

          upBtn.disabled = index === 0;
          downBtn.disabled = index === mediaOrder.length - 1;

          upBtn.addEventListener('click', () => {
            if (statusSelect.value !== 'live') return;
            const next = [...mediaOrder];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            mediaOrder = next;
            renderMediaEditor();
            queueAutosaveMediaOrder();
          });

          downBtn.addEventListener('click', () => {
            if (statusSelect.value !== 'live') return;
            const next = [...mediaOrder];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            mediaOrder = next;
            renderMediaEditor();
            queueAutosaveMediaOrder();
          });

          removeBtnItem.addEventListener('click', () => {
            if (statusSelect.value !== 'live') return;
            mediaOrder = mediaOrder.filter((_, itemIndex) => itemIndex !== index);
            renderMediaEditor();
            queueAutosaveMediaOrder();
          });

          item.addEventListener('dragstart', (event) => {
            if (statusSelect.value !== 'live') return;
            draggedIndex = Number(item.dataset.index);
            item.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(draggedIndex));
          });

          item.addEventListener('dragend', () => {
            item.classList.remove('is-dragging');
            mediaList.querySelectorAll('.product-media-item').forEach((el) => el.classList.remove('is-drop-target'));
          });

          item.addEventListener('dragover', (event) => {
            if (statusSelect.value !== 'live') return;
            event.preventDefault();
            item.classList.add('is-drop-target');
          });

          item.addEventListener('dragleave', () => {
            item.classList.remove('is-drop-target');
          });

          item.addEventListener('drop', (event) => {
            if (statusSelect.value !== 'live') return;
            event.preventDefault();
            item.classList.remove('is-drop-target');
            const targetIndex = Number(item.dataset.index);
            if (!Number.isInteger(draggedIndex) || draggedIndex < 0 || draggedIndex === targetIndex) return;

            const next = [...mediaOrder];
            const [moved] = next.splice(draggedIndex, 1);
            next.splice(targetIndex, 0, moved);
            mediaOrder = next;
            renderMediaEditor();
            queueAutosaveMediaOrder();
          });

          item.appendChild(preview);
          item.appendChild(label);
          item.appendChild(actions);
          mediaList.appendChild(item);
        });
      };

      renderMediaEditor();

      const controls = document.createElement('div');
      controls.className = 'product-row-controls';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'save';

      const link = document.createElement('a');
      link.href = product.stripeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'sound-title';
      link.textContent = 'stripe';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'danger-btn';
      removeBtn.textContent = 'remove';

      const setLiveEditState = () => {
        const editable = statusSelect.value === 'live';
        [nameInput, priceInput, descriptionInput, stripeInput, mediaInput].forEach((el) => {
          el.disabled = !editable;
        });
        mediaList.classList.toggle('is-locked', !editable);
        row.classList.toggle('is-archive', !editable);
        row.classList.toggle('is-live', editable);
      };

      statusSelect.addEventListener('change', setLiveEditState);
      setLiveEditState();

      saveBtn.addEventListener('click', async () => {
        if (autosaveTimer) {
          clearTimeout(autosaveTimer);
          autosaveTimer = null;
        }
        if (autosaveController) {
          autosaveController.abort();
          autosaveController = null;
        }
        mediaOrder = getCurrentMediaOrder();
        const form = new FormData();
        form.append('id', product.id);
        form.append('status', statusSelect.value);

        if (statusSelect.value === 'live') {
          form.append('name', nameInput.value.trim());
          form.append('price', priceInput.value.trim());
          form.append('description', descriptionInput.value.trim());
          form.append('stripeUrl', stripeInput.value.trim());
          form.append('mediaOrder', JSON.stringify(mediaOrder));
          if (mediaOrder[0]) form.append('primaryMedia', mediaOrder[0]);
          [...(mediaInput.files || [])].forEach((file) => form.append('media', file));
        }

        showStatus(uploadStatus, `saving ${product.name}...`);
        const res = await fetch('/api/admin/products/update', { method: 'POST', body: form });
        if (!res.ok) {
          const message = await parseError(res, `failed to update ${product.name}.`);
          showStatus(uploadStatus, message);
          return;
        }
        showStatus(uploadStatus, `${product.name} updated.`);
        await loadLibrary();
      });

      removeBtn.addEventListener('click', async () => {
        const res = await postJson('/api/admin/products/delete', { id: product.id });
        if (!res.ok) {
          const message = await parseError(res, `failed to remove ${product.name}.`);
          showStatus(uploadStatus, message);
          return;
        }
        showStatus(uploadStatus, `${product.name} removed.`);
        await loadLibrary();
      });

      row.appendChild(header);
      row.appendChild(nameInput);
      row.appendChild(priceInput);
      row.appendChild(descriptionInput);
      row.appendChild(stripeInput);
      row.appendChild(statusSelect);
      row.appendChild(mediaInput);
      row.appendChild(mediaList);
      controls.appendChild(saveBtn);
      controls.appendChild(link);
      controls.appendChild(removeBtn);
      row.appendChild(controls);
      productLibrary.appendChild(row);
    });
  }
};

async function loadLibrary() {
  const res = await fetch('/api/content');
  const data = await res.json();
  renderLibrary(data);
}

const removeSelected = async (kind) => {
  const names = getCheckedNames(kind);
  if (!names.length) {
    showStatus(uploadStatus, `select ${kind} files first.`);
    return;
  }

  const endpoint = kind === 'media' ? '/api/admin/delete-media-bulk' : '/api/admin/delete-music-bulk';
  showStatus(uploadStatus, `removing ${names.length} ${kind} file(s)...`);
  const res = await postJson(endpoint, { names });

  if (!res.ok) {
    const message = await parseError(res, `failed to remove selected ${kind}.`);
    showStatus(uploadStatus, message);
    return;
  }

  showStatus(uploadStatus, `removed selected ${kind}.`);
  await loadLibrary();
};

const clearAll = async (kind) => {
  const count = kind === 'media' ? mediaItems.length : musicItems.length;
  if (!count) {
    showStatus(uploadStatus, `no ${kind} files to clear.`);
    return;
  }

  const confirmed = window.confirm(`clear all ${count} ${kind} file(s)?`);
  if (!confirmed) return;

  const endpoint = kind === 'media' ? '/api/admin/clear-media' : '/api/admin/clear-music';
  showStatus(uploadStatus, `clearing all ${kind}...`);
  const res = await postJson(endpoint);

  if (!res.ok) {
    const message = await parseError(res, `failed to clear ${kind}.`);
    showStatus(uploadStatus, message);
    return;
  }

  showStatus(uploadStatus, `all ${kind} cleared.`);
  await loadLibrary();
};

const checkSession = async () => {
  try {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    const isAuthed = Boolean(data.authenticated);
    setAuthView(isAuthed);
    if (isAuthed) {
      setAdminTab('library');
      await loadLibrary();
    }
  } catch {
    setAuthView(false);
  }
};

loginBtn.addEventListener('click', async () => {
  showStatus(loginStatus, 'checking password...');
  const res = await postJson('/api/login', { password: passwordInput.value });

  if (!res.ok) {
    const message = await parseError(res, 'invalid password.');
    showStatus(loginStatus, message);
    return;
  }

  passwordInput.value = '';
  showStatus(loginStatus, 'access granted.');
  setAuthView(true);
  setAdminTab('library');
  await loadLibrary();
});

adminTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setAdminTab(tab.dataset.tabTarget || 'library');
  });
});

const uploadFiles = async (endpoint, input, fieldName) => {
  const files = input.files;
  if (!files || !files.length) {
    showStatus(uploadStatus, 'pick at least one file.');
    return;
  }

  const form = new FormData();
  [...files].forEach((file) => form.append(fieldName, file));

  showStatus(uploadStatus, 'uploading...');
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const message = await parseError(res, 'upload failed. check auth and file type.');
    showStatus(uploadStatus, message);
    return;
  }

  input.value = '';
  showStatus(uploadStatus, 'upload complete.');
  await loadLibrary();
};

uploadMediaBtn.addEventListener('click', async () => {
  await uploadFiles('/api/admin/upload-media', mediaFilesInput, 'media');
});

uploadMusicBtn.addEventListener('click', async () => {
  await uploadFiles('/api/admin/upload-music', musicFilesInput, 'music');
});

addProductBtn.addEventListener('click', async () => {
  const name = productNameInput.value.trim();
  const stripeUrl = productStripeUrlInput.value.trim();
  const price = productPriceInput.value.trim();
  const description = productDescriptionInput.value.trim();
  const status = productStatusInput.value === 'archive' ? 'archive' : 'live';

  if (!name || !stripeUrl) {
    showStatus(uploadStatus, 'product name and stripe url are required.');
    return;
  }

  const form = new FormData();
  form.append('name', name);
  form.append('stripeUrl', stripeUrl);
  form.append('status', status);
  if (price) form.append('price', price);
  if (description) form.append('description', description);
  [...(productMediaInput.files || [])].forEach((file) => form.append('media', file));

  showStatus(uploadStatus, 'adding product...');
  const res = await fetch('/api/admin/products', { method: 'POST', body: form });
  if (!res.ok) {
    const message = await parseError(res, 'failed to add product.');
    showStatus(uploadStatus, message);
    return;
  }

  productNameInput.value = '';
  productPriceInput.value = '';
  productDescriptionInput.value = '';
  productStripeUrlInput.value = '';
  productStatusInput.value = 'live';
  productMediaInput.value = '';
  showStatus(uploadStatus, 'product added.');
  await loadLibrary();
});

refreshLibraryBtn.addEventListener('click', async () => {
  showStatus(uploadStatus, 'refreshing library...');
  await loadLibrary();
  showStatus(uploadStatus, 'library refreshed.');
});

selectAllMediaBtn.addEventListener('click', () => {
  setAllChecked('media', true);
});

removeSelectedMediaBtn.addEventListener('click', async () => {
  await removeSelected('media');
});

clearMediaBtn.addEventListener('click', async () => {
  await clearAll('media');
});

selectAllMusicBtn.addEventListener('click', () => {
  setAllChecked('music', true);
});

removeSelectedMusicBtn.addEventListener('click', async () => {
  await removeSelected('music');
});

clearMusicBtn.addEventListener('click', async () => {
  await clearAll('music');
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  showStatus(uploadStatus, 'logged out.');
  setAuthView(false);
});

checkSession();
