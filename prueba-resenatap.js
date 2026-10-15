
@'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 300,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const baseUrl = __ENV.SUPABASE_URL;
  const apiKey = __ENV.SUPABASE_KEY;
  const businessId = 'codercraft-z67lju';

  if (!baseUrl || !apiKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_KEY en el entorno.');
  }

  const url = `${baseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=*`;

  const response = http.get(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.pgrst.object+json',
    },
    tags: { endpoint: 'supabase_business_lookup' },
  });

  check(response, {
    'Supabase responde HTTP 200': (r) => r.status === 200,
    'respuesta JSON válida': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (_) {
        return false;
      }
    },
  });

  sleep(1);
}
'@ | Set-Content -Encoding utf8 .\prueba-supabase.js
