import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SUPABASE_URL =
  process.env.SUPABASE_URL || html.match(/SUPABASE_URL='([^']+)'/)?.[1];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'story-photos';
const DRY_RUN = process.argv.includes('--dry-run');
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split('=');
      return [key, value.join('=')];
    }),
);
const ONLY_ID = args.only || '';
const PHOTO_TIMEOUT_MS = Number(args['photo-timeout-ms'] || 180000);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('需要设置 SUPABASE_SERVICE_ROLE_KEY，必要时也可设置 SUPABASE_URL。');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function supabase(path, options = {}) {
  const timeoutMs = options.timeoutMs || 120000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
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

console.log(ONLY_ID ? `开始检查指定记录 story ${ONLY_ID}...` : '开始扫描 story 记录...');
const listPath = ONLY_ID
  ? `story?id=eq.${encodeURIComponent(ONLY_ID)}&select=id,date`
  : 'story?select=id,date&order=date.desc,created_at.desc';
const rows = await supabase(listPath, { timeoutMs: 30000 });
let changedRows = 0;
let movedPhotos = 0;

console.log(`找到 ${rows?.length || 0} 条记录，开始逐条检查照片。`);

for (let rowIndex = 0; rowIndex < (rows || []).length; rowIndex++) {
  const row = rows[rowIndex];
  console.log(`检查第 ${rowIndex + 1}/${rows.length} 条：story ${row.id} (${row.date || '无日期'})`);

  let fullRow;
  try {
    const data = await supabase(
      `story?id=eq.${encodeURIComponent(row.id)}&select=id,date,photos`,
      { timeoutMs: PHOTO_TIMEOUT_MS },
    );
    fullRow = data?.[0] || row;
  } catch (error) {
    console.warn(`跳过 story ${row.id}：照片字段读取超时或失败。${error.message || error}`);
    continue;
  }

  const photos = normalizePhotos(fullRow.photos);
  let changed = false;

  for (let i = 0; i < photos.length; i++) {
    if (!isDataUrl(photos[i].url)) continue;
    changed = true;

    const blob = dataUrlToBlob(photos[i].url);
    const path = `${fullRow.date || 'undated'}/${fullRow.id}-${i}.${extension(blob.type)}`;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}迁移 story ${fullRow.id} 第 ${i + 1} 张照片 -> ${path}`);

    if (!DRY_RUN) photos[i].url = await upload(blob, path);
    movedPhotos++;
  }

  if (changed) {
    changedRows++;
    if (!DRY_RUN) {
      await supabase(`story?id=eq.${encodeURIComponent(fullRow.id)}`, {
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
