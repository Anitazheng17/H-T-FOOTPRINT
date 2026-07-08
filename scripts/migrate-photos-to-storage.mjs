import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SUPABASE_URL =
  process.env.SUPABASE_URL || html.match(/SUPABASE_URL='([^']+)'/)?.[1];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'story-photos';
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('需要设置 SUPABASE_SERVICE_ROLE_KEY，必要时也可设置 SUPABASE_URL。');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function supabase(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...headers,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.message || text || `HTTP ${res.status}`);
  return json;
}

function normalizePhotos(photos) {
  return Array.isArray(photos)
    ? photos
        .map((photo) =>
          typeof photo === 'string'
            ? { url: photo, caption: '' }
            : { url: photo?.url || photo?.src || '', caption: photo?.caption || photo?.note || '' },
        )
        .filter((photo) => photo.url)
    : [];
}

function isDataUrl(url) {
  return /^data:image\/[^;]+;base64,/i.test(String(url || ''));
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const type = meta.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';
  const bytes = Buffer.from(base64, 'base64');
  return new Blob([bytes], { type });
}

function extension(type) {
  return (type.split('/').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
}

async function upload(blob, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': blob.type || 'image/jpeg',
      'x-upsert': 'true',
    },
    body: blob,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Upload failed: ${res.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

const rows = await supabase('story?select=id,date,photos&order=date.desc,created_at.desc');
let changedRows = 0;
let movedPhotos = 0;

for (const row of rows || []) {
  const photos = normalizePhotos(row.photos);
  let changed = false;

  for (let i = 0; i < photos.length; i++) {
    if (!isDataUrl(photos[i].url)) continue;
    changed = true;

    const blob = dataUrlToBlob(photos[i].url);
    const path = `${row.date || 'undated'}/${row.id}-${i}.${extension(blob.type)}`;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}迁移 story ${row.id} 第 ${i + 1} 张照片 -> ${path}`);

    if (!DRY_RUN) photos[i].url = await upload(blob, path);
    movedPhotos++;
  }

  if (changed) {
    changedRows++;
    if (!DRY_RUN) {
      await supabase(`story?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ photos }),
      });
    }
  }
}

console.log(`${DRY_RUN ? '预计' : '已'}处理 ${changedRows} 条记录，${movedPhotos} 张照片。`);
