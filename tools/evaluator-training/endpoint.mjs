// Generator endpoint checks. Fail before 4000 slots if the URL is a placeholder
// or the host is unreachable.

const PLACEHOLDER_HOSTS = new Set(['host', 'example.com', 'example.org', 'localhost.example']);

/**
 * @param {string} baseUrl
 */
export function assertGeneratorBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      `AIRP_GENERATOR_BASE_URL is not a URL: ${baseUrl}. Example: http://127.0.0.1:8000/v1 after vLLM is listening.`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`AIRP_GENERATOR_BASE_URL must be http(s), got ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (PLACEHOLDER_HOSTS.has(host) || host.includes('<') || host.includes('your-')) {
    throw new Error(
      `AIRP_GENERATOR_BASE_URL uses a placeholder host (${parsed.hostname}). ` +
        'Set it to the real OpenAI-compatible /v1 of a running vLLM (or equivalent) serving Qwen/Qwen2.5-32B-Instruct. ' +
        'http://HOST:8000/v1 in the README is not a machine.',
    );
  }
}

/**
 * @param {unknown} err
 * @param {string} url
 */
export function fetchFailureMessage(err, url) {
  const e = err && typeof err === 'object' ? err : { message: String(err) };
  const cause = 'cause' in e && e.cause && typeof e.cause === 'object' && 'message' in e.cause
    ? String(e.cause.message)
    : '';
  const code = 'cause' in e && e.cause && typeof e.cause === 'object' && 'code' in e.cause
    ? String(e.cause.code)
    : '';
  const bits = [`generator unreachable at ${url}`];
  if (code) bits.push(code);
  if (cause) bits.push(cause);
  else if ('message' in e) bits.push(String(e.message));
  return bits.join(': ');
}

/**
 * @param {unknown} err
 */
export function isUnreachable(err) {
  const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
  if (/unreachable|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) return true;
  const cause = err && typeof err === 'object' && 'cause' in err ? err.cause : null;
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
  return /ENOTFOUND|ECONNREFUSED|EAI_AGAIN/.test(code);
}

/**
 * OpenAI-compatible /v1/models. One round trip before generation starts.
 * @param {string} baseUrl
 * @param {string} apiKey
 */
export async function probeGenerator(baseUrl, apiKey) {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  /** @type {Record<string, string>} */
  const headers = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    throw new Error(fetchFailureMessage(err, url));
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generator probe HTTP ${res.status} at ${url}: ${text.slice(0, 300)}`);
  }
}
