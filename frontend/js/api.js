// Wrapper minimale su fetch condiviso da tutte le pagine.
// - prefissa /api
// - include sempre i cookie (per l'auth con cookie httpOnly)
// - serializza/deserializza JSON
// - su risposta non-ok lancia un Error con .status e .data (il messaggio è data.error)

async function api(path, options = {}) {
  const opts = {
    credentials: 'same-origin', // frontend e API sono sulla stessa origine
    headers: { ...(options.headers || {}) },
    ...options,
  };

  // se passo un body oggetto, lo converto in JSON e imposto il content-type
  if (opts.body !== undefined && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(`/api${path}`, opts);

  // alcune risposte possono essere vuote: leggo come testo e provo a fare il parse
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const message = data && data.error ? data.error : `Errore ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status, data });
  }
  return data;
}

// scorciatoie
const apiGet = (path) => api(path);
const apiPost = (path, body) => api(path, { method: 'POST', body });
const apiPut = (path, body) => api(path, { method: 'PUT', body });
const apiDelete = (path) => api(path, { method: 'DELETE' });

export { api, apiGet, apiPost, apiPut, apiDelete };
