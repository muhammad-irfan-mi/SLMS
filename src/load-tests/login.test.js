// import http from 'k6/http';
// import { check, sleep } from 'k6';
// import { SharedArray } from 'k6/data';

// // Load users from a JSON file or generate dynamically
// // Here, assuming you exported your seeded users to src/load-tests/users.json
// const users = new SharedArray('users', function () {
//     return JSON.parse(open('./users.json')); // [{ email: 'user1@example.com', password: 'pass123' }, ...]
// });

// export let options = {
//     vus: 50,        // number of virtual users
//     duration: '30s' // total duration of test
// };

// export default function () {
//     // Pick a random user for each iteration
//     const user = users[Math.floor(Math.random() * users.length)];

//     const payload = JSON.stringify({
//         email: user.email,
//         password: user.password,
//     });

//     const params = {
//         headers: {
//             'Content-Type': 'application/json',
//         },
//     };

//     const res = http.post('http://localhost:4000/api/empStudent/user-login', payload, params);

//     check(res, {
//         'login status is 200': (r) => r.status === 200,
//         'received token': (r) => r.json('token') !== undefined,
//     });

//     sleep(1); // wait 1s before next iteration
// }











import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// ✅ Proper way to load JSON in k6
const users = new SharedArray('users', function () {
  const data = JSON.parse(open('./users.json'));
  return data;
});

export const options = {
  vus: 200,
  duration: '1m',
};

export default function () {

  // 🔒 HARD SAFETY CHECK
  if (!users || users.length === 0) {
    console.error('❌ users.json not loaded or empty');
    sleep(1);
    return;
  }

  const user = users[Math.floor(Math.random() * users.length)];

  if (!user || !user.email || !user.password) {
    console.error('❌ Invalid user object:', JSON.stringify(user));
    sleep(1);
    return;
  }

  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const res = http.post(
    'http://localhost:4000/api/empStudent/user-login',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  if (res.status === 200 && res.body) {
    const body = JSON.parse(res.body);
    check(body, {
      'received token': (b) => !!b.token,
    });
  }

  sleep(1);
}
