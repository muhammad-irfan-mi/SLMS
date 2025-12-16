import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 200,
  duration: '30s',
};

export default function () {
  const vu = __VU;
  const payload = JSON.stringify({
    email: `loadtest${vu}@student.com`,
    password: '123456',
  });

  const res = http.post(
    'http://localhost:3000/api/empStudent/user-login',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'login status is 200': r => r.status === 200,
  });

  sleep(1);
}
