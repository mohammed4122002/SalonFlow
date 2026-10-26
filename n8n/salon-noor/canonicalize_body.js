// Rebuilds the exact signed text: SalonFlow signs canonical JSON (object keys
// sorted recursively), so key order changes inside n8n do not matter.
const canon = (v) => Array.isArray(v)
  ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object'
    ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}`
    : JSON.stringify(v ?? null);
const item = $input.first().json;
return [{ json: { ...item, canonical: canon(item.body || {}) } }];
