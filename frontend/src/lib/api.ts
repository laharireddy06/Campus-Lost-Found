import { createClient } from '@metagptx/web-sdk';

// Statically caching the client instance and tracking the token
let currentClient = createClient();
let lastToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const getClient = () => {
  if (typeof window === 'undefined') return currentClient;
  const token = localStorage.getItem('token');
  if (token !== lastToken) {
    // Re-create the client only when the token changes (login/logout events)
    currentClient = createClient();
    lastToken = token;
  }
  return currentClient;
};

// Export client as a transparent Proxy forwarding calls to the active client instance
export const client = new Proxy({}, {
  get: (_target, prop) => {
    return Reflect.get(getClient(), prop);
  }
}) as any;

export default client;
