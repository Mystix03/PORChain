// sw.js — Basic Service Worker for POR-Chain PWA
const CACHE_NAME = 'por-chain-v1';

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (event) => {
  // Pass-through for now, required for PWA installability
  event.respondWith(fetch(event.request));
});
