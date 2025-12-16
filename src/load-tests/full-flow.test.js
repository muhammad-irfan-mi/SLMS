import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_PASSWORD, QUIZ_ID } from './config.js';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '20s', target: 200 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const email = `loadtest_student_${__VU}@test.com`;

  const loginRes = http.post(
    `${BASE_URL}/api/empStudent/user-login`,
    JSON.stringify({ email, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, { 'login ok': r => r.status === 200 });

  const token = loginRes.json('token');

  http.post(
    `${BASE_URL}/api/quiz/${QUIZ_ID}/submit`,
    JSON.stringify({ answers: [] }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  sleep(1);
}
