import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export let options = {
    vus: 50,        // number of virtual users
    duration: '1m', // test duration
};

const BASE_URL = 'http://localhost:4000/api';
const QUIZ_ID = '694094de3e29d7085d98cb71';
const QUESTIONS = [
    { questionId: '694094de3e29d7085d98cb72', chosenIndex: 2 },
    { questionId: '694094de3e29d7085d98cb73', chosenIndex: 2 },
    { questionId: '694094de3e29d7085d98cb74', answerText: '4' }
];

export default function () {
    // 1️⃣ Auto-create a unique student
    const randomEmail = `student_${__VU}_${Date.now()}@test.com`;
    const newStudent = {
        email: randomEmail,
        password: 'Student@123',
        name: `Student ${__VU}`,
        school: '6936e52f80e51eaf6be974a5', // existing school ID
    };

    const createRes = http.post(`${BASE_URL}/empStudent/register`, JSON.stringify(newStudent), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(createRes, { 'student created': (r) => r.status === 201 || r.status === 200 });

    // 2️⃣ Login created student
    const loginRes = http.post(`${BASE_URL}/empStudent/user-login`, JSON.stringify({
        email: newStudent.email,
        password: newStudent.password
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, { 'login success': (r) => r.status === 200 && r.json('token') !== undefined });

    const token = loginRes.json('token');

    // 3️⃣ Submit Quiz
    const payload = JSON.stringify({ answers: QUESTIONS });

    const quizRes = http.post(`${BASE_URL}/quiz/${QUIZ_ID}/submit`, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    check(quizRes, {
        'quiz submitted': (r) => r.status === 201 && r.json('message') === 'Quiz submitted successfully'
    });

    sleep(Math.random() * 2);
}