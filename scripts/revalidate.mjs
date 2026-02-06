#!/usr/bin/env node
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const secret = process.env.REVALIDATE_SECRET;
const url = baseUrl.replace(/\/$/, '') + '/api/players/refresh';

const headers = { 'Content-Type': 'application/json' };
if (secret) {
  headers['Authorization'] = `Bearer ${secret}`;
}

fetch(url, { method: 'POST', headers })
  .then((res) => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  })
  .then((body) => {
    console.log('Revalidate OK:', body);
  })
  .catch((err) => {
    console.error('Revalidate failed:', err.message);
    process.exit(1);
  });
