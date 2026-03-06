const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Alyx1017!';
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-this-secret';

const mediaDir = path.join(__dirname, 'uploads', 'media');
const musicDir = path.join(__dirname, 'uploads', 'music');
const productMediaDir = path.join(__dirname, 'uploads', 'products');
const dataDir = path.join(__dirname, 'data');
const productsFile = path.join(dataDir, 'products.json');

for (const dir of [mediaDir, musicDir, productMediaDir, dataDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, '[]', 'utf8');

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  })
);

const sanitizeFileName = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');

const storageFor = (targetDir) =>
  multer.diskStorage({
    destination: (_, __, cb) => cb(null, targetDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      cb(null, `${Date.now()}-${sanitizeFileName(base)}${ext.toLowerCase()}`);
    }
  });

const uploadMedia = multer({ storage: storageFor(mediaDir) });
const uploadMusic = multer({ storage: storageFor(musicDir) });
const uploadProductMedia = multer({ storage: storageFor(productMediaDir) });
const PRODUCT_STATUSES = new Set(['live', 'archive']);

const isAllowedMedia = (file) => {
  const ext = path.extname(file).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm'].includes(ext);
};

const isAllowedMusic = (file) => {
  const ext = path.extname(file).toLowerCase();
  return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
};

const normalizeProductStatus = (rawStatus) => {
  const status = String(rawStatus || '').trim().toLowerCase();
  return PRODUCT_STATUSES.has(status) ? status : 'live';
};

const normalizeProduct = (product) => {
  if (!product || typeof product !== 'object') return null;
  const media = Array.isArray(product.media)
    ? product.media.filter((item) => typeof item === 'string' && item.trim())
    : [];
  if (!media.length && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    media.push(product.imageUrl.trim());
  }
  return {
    ...product,
    status: normalizeProductStatus(product.status),
    media,
    imageUrl: media[0] || ''
  };
};

const collectUploadedProductMedia = (req) => {
  const mediaFiles = Array.isArray(req.files?.media) ? req.files.media : [];
  const imageFiles = Array.isArray(req.files?.image) ? req.files.image : [];
  const files = [...mediaFiles, ...imageFiles];
  return files.map((file) => `/uploads/products/${encodeURIComponent(file.filename)}`);
};

const parseMediaOrder = (rawOrder, currentMedia) => {
  if (rawOrder === undefined) return null;
  let parsed;
  try {
    parsed = JSON.parse(String(rawOrder || '[]'));
  } catch {
    return { error: 'invalid media order' };
  }
  if (!Array.isArray(parsed)) return { error: 'invalid media order' };

  const currentSet = new Set((Array.isArray(currentMedia) ? currentMedia : []).map((url) => String(url)));
  const ordered = [];
  for (const item of parsed) {
    const url = String(item || '').trim();
    if (!currentSet.has(url)) continue;
    if (!ordered.includes(url)) ordered.push(url);
  }
  return { ordered };
};

const requireAdmin = (req, res, next) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const getSortedFiles = (dir, allowFn) => {
  return fs
    .readdirSync(dir)
    .filter(allowFn)
    .map((name) => {
      const full = path.join(dir, name);
      const stats = fs.statSync(full);
      return { name, mtimeMs: stats.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((file) => file.name);
};

const readProducts = () => {
  try {
    const raw = fs.readFileSync(productsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeProduct).filter(Boolean);
  } catch {
    return [];
  }
};

const writeProducts = (products) => {
  fs.writeFileSync(productsFile, JSON.stringify(products, null, 2), 'utf8');
};

const moveFileSafely = (fromPath, toDir, preferredName) => {
  if (!fs.existsSync(fromPath)) return null;
  const ext = path.extname(preferredName).toLowerCase();
  const base = path.basename(preferredName, ext);
  let targetName = sanitizeFileName(preferredName);
  let targetPath = path.join(toDir, targetName);
  let index = 1;
  while (fs.existsSync(targetPath)) {
    targetName = `${sanitizeFileName(base)}-${index}${ext}`;
    targetPath = path.join(toDir, targetName);
    index += 1;
  }
  fs.renameSync(fromPath, targetPath);
  return targetName;
};

const migrateLegacyProductMedia = () => {
  const products = readProducts();
  let changed = false;

  const migrated = products.map((product) => {
    const currentMedia = Array.isArray(product.media) ? product.media : [];
    const nextMedia = currentMedia.map((url) => {
      const raw = String(url || '');
      if (!raw.startsWith('/uploads/media/')) return raw;
      const legacyName = path.basename(decodeURIComponent(raw.split('?')[0]));
      const fromPath = path.join(mediaDir, legacyName);
      const movedName = moveFileSafely(fromPath, productMediaDir, legacyName);
      changed = true;
      return `/uploads/products/${encodeURIComponent(movedName || legacyName)}`;
    });

    let nextImageUrl = String(product.imageUrl || '');
    if (nextImageUrl.startsWith('/uploads/media/')) {
      const legacyName = path.basename(decodeURIComponent(nextImageUrl.split('?')[0]));
      const match = nextMedia.find((url) => path.basename(url) === legacyName);
      nextImageUrl = match || `/uploads/products/${encodeURIComponent(legacyName)}`;
      changed = true;
    } else if (nextMedia.length) {
      nextImageUrl = nextMedia[0];
    }

    return {
      ...product,
      media: nextMedia,
      imageUrl: nextImageUrl
    };
  });

  if (changed) writeProducts(migrated);
};

migrateLegacyProductMedia();

const deleteManagedFile = (dir, allowFn, rawName) => {
  const name = decodeURIComponent(String(rawName || '').trim()).replace(/\0/g, '');
  if (!name || name.includes('/') || name.includes('\\') || path.basename(name) !== name || !allowFn(name)) {
    return { ok: false, status: 400, error: 'Invalid filename' };
  }

  const target = path.join(dir, name);
  if (!fs.existsSync(target)) {
    return { ok: false, status: 404, error: 'File not found' };
  }

  try {
    fs.unlinkSync(target);
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 500, error: 'Unable to delete file' };
  }
};

const deleteManyManagedFiles = (dir, allowFn, rawNames) => {
  const names = Array.isArray(rawNames) ? rawNames : [];
  let deleted = 0;

  for (const rawName of names) {
    const result = deleteManagedFile(dir, allowFn, rawName);
    if (result.ok) deleted += 1;
  }

  return { deleted };
};

const clearManagedFiles = (dir, allowFn) => {
  const names = getSortedFiles(dir, allowFn);
  let deleted = 0;

  for (const name of names) {
    const result = deleteManagedFile(dir, allowFn, name);
    if (result.ok) deleted += 1;
  }

  return { deleted };
};

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session?.isAdmin) });
});

app.post('/api/admin/upload-media', requireAdmin, uploadMedia.array('media', 20), (req, res) => {
  res.json({ ok: true, files: (req.files || []).map((f) => f.filename) });
});

app.post('/api/admin/upload-music', requireAdmin, uploadMusic.array('music', 20), (req, res) => {
  res.json({ ok: true, files: (req.files || []).map((f) => f.filename) });
});

app.get('/api/admin/products', requireAdmin, (_, res) => {
  res.json({ products: readProducts() });
});

app.post(
  '/api/admin/products',
  requireAdmin,
  uploadProductMedia.fields([
    { name: 'media', maxCount: 20 },
    { name: 'image', maxCount: 1 }
  ]),
  (req, res) => {
  const name = String(req.body?.name || '').trim();
  const price = String(req.body?.price || '').trim();
  const description = String(req.body?.description || '').trim();
  const stripeUrl = String(req.body?.stripeUrl || '').trim();
  const status = normalizeProductStatus(req.body?.status);

  const validStripeUrl = /^https?:\/\/.+/i.test(stripeUrl) && /stripe\.com/i.test(stripeUrl);
  if (!name || !validStripeUrl) {
    return res.status(400).json({ error: 'name and a valid stripe url are required' });
  }

  const media = collectUploadedProductMedia(req);
  const products = readProducts();
  const product = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    price,
    description,
    stripeUrl,
    media,
    imageUrl: media[0] || '',
    status,
    createdAt: new Date().toISOString()
  };

  products.unshift(product);
  writeProducts(products);
  res.json({ ok: true, product });
}
);

app.post(
  '/api/admin/products/update',
  requireAdmin,
  uploadProductMedia.fields([
    { name: 'media', maxCount: 20 },
    { name: 'image', maxCount: 1 }
  ]),
  (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'invalid product id' });

  const products = readProducts();
  const index = products.findIndex((product) => product.id === id);
  if (index < 0) return res.status(404).json({ error: 'product not found' });

  const current = products[index];
  const status = normalizeProductStatus(req.body?.status || current.status);
  const canEditFields = current.status === 'live' || status === 'live';
  const nextMedia = collectUploadedProductMedia(req);
  const mediaOrderResult = parseMediaOrder(req.body?.mediaOrder, current.media);
  if (mediaOrderResult?.error) return res.status(400).json({ error: mediaOrderResult.error });

  const hasFieldEdits =
    ['name', 'price', 'description', 'stripeUrl', 'mediaOrder'].some((key) => key in (req.body || {})) ||
    nextMedia.length > 0;

  if (hasFieldEdits && !canEditFields) {
    return res.status(400).json({ error: 'only live products are editable' });
  }

  const next = { ...current, status };

  if (canEditFields) {
    if (mediaOrderResult && Array.isArray(mediaOrderResult.ordered)) {
      next.media = mediaOrderResult.ordered;
    }
    if ('name' in (req.body || {})) {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name is required' });
      next.name = name;
    }
    if ('price' in (req.body || {})) next.price = String(req.body?.price || '').trim();
    if ('description' in (req.body || {})) next.description = String(req.body?.description || '').trim();
    if ('stripeUrl' in (req.body || {})) {
      const stripeUrl = String(req.body?.stripeUrl || '').trim();
      const validStripeUrl = /^https?:\/\/.+/i.test(stripeUrl) && /stripe\.com/i.test(stripeUrl);
      if (!validStripeUrl) return res.status(400).json({ error: 'valid stripe url is required' });
      next.stripeUrl = stripeUrl;
    }
    if (nextMedia.length) {
      const existingMedia = Array.isArray(next.media) ? next.media : [];
      next.media = [...new Set([...existingMedia, ...nextMedia])];
    }
    const requestedPrimary = String(req.body?.primaryMedia || '').trim();
    const mediaList = Array.isArray(next.media) ? next.media : [];
    if (requestedPrimary && mediaList.includes(requestedPrimary)) {
      next.imageUrl = requestedPrimary;
    } else {
      next.imageUrl = mediaList[0] || '';
    }
  }

  next.updatedAt = new Date().toISOString();
  products[index] = next;
  writeProducts(products);
  res.json({ ok: true, product: next });
}
);

app.post('/api/admin/products/delete', requireAdmin, (req, res) => {
  const id = String(req.body?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'invalid product id' });

  const products = readProducts();
  const next = products.filter((product) => product.id !== id);
  if (next.length === products.length) {
    return res.status(404).json({ error: 'product not found' });
  }

  writeProducts(next);
  res.json({ ok: true });
});

app.post('/api/admin/delete-media', requireAdmin, (req, res) => {
  const result = deleteManagedFile(mediaDir, isAllowedMedia, req.body?.name);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

app.post('/api/admin/delete-music', requireAdmin, (req, res) => {
  const result = deleteManagedFile(musicDir, isAllowedMusic, req.body?.name);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

app.post('/api/admin/delete-media-bulk', requireAdmin, (req, res) => {
  const result = deleteManyManagedFiles(mediaDir, isAllowedMedia, req.body?.names);
  res.json({ ok: true, deleted: result.deleted });
});

app.post('/api/admin/delete-music-bulk', requireAdmin, (req, res) => {
  const result = deleteManyManagedFiles(musicDir, isAllowedMusic, req.body?.names);
  res.json({ ok: true, deleted: result.deleted });
});

app.post('/api/admin/clear-media', requireAdmin, (_, res) => {
  const result = clearManagedFiles(mediaDir, isAllowedMedia);
  res.json({ ok: true, deleted: result.deleted });
});

app.post('/api/admin/clear-music', requireAdmin, (_, res) => {
  const result = clearManagedFiles(musicDir, isAllowedMusic);
  res.json({ ok: true, deleted: result.deleted });
});

app.get('/api/content', (_, res) => {
  const products = readProducts();
  const productMediaFiles = new Set(
    products
      .flatMap((product) => (Array.isArray(product.media) ? product.media : []))
      .map((url) => {
        const raw = String(url || '').split('?')[0];
        return path.basename(decodeURIComponent(raw));
      })
      .filter(Boolean)
  );

  const media = getSortedFiles(mediaDir, isAllowedMedia).filter((name) => !productMediaFiles.has(name));
  const music = getSortedFiles(musicDir, isAllowedMusic);
  res.json({
    media: media.map((name) => ({
      name,
      url: `/uploads/media/${encodeURIComponent(name)}`
    })),
    music: music.map((name) => ({
      name,
      url: `/uploads/music/${encodeURIComponent(name)}`
    })),
    products
  });
});

app.use('/uploads/media', express.static(mediaDir));
app.use('/uploads/music', express.static(musicDir));
app.use('/uploads/products', express.static(productMediaDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/product', (_, res) => {
  res.redirect('/');
});

app.get('/archive', (_, res) => {
  res.redirect('/');
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'Alyx1017!') {
    console.log('WARNING: Set ADMIN_PASSWORD in your environment before production use.');
  }
});
