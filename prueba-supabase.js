import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 500,
  duration: '30s',
};

export default function () {
  const baseUrl = __ENV.SUPABASE_URL;
  const apiKey = __ENV.SUPABASE_KEY;
  const businessId = 'codercraft-z67lju';

  const url = `${baseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=*`;

  const response = http.get(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.pgrst.object+json',
    },
  });

  check(response, {
    'HTTP 200': (r) => r.status === 200,
    'respuesta menor a 1 segundo': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}


