import type { Config } from '../src/types.js';

/** The README / examples/basic.yaml config as a Config object. */
export function sampleConfig(): Config {
  return {
    permissions: [
      { id: 'users:read', description: 'Read user records', implies: [] },
      { id: 'users:write', implies: ['users:read'] },
      { id: 'billing:write', implies: [] },
      { id: 'admin', implies: ['users:write', 'billing:write'] },
    ],
    resources: [{ id: 'users', actions: { read: 'users:read', write: 'users:write' } }],
    endpoints: [
      { id: 'GET /users/{id}', requires: ['users:read'], public: false },
      { id: 'DELETE /users/{id}', requires: ['users.write'], public: false },
      { id: 'POST /users/{id}/invoices', requires: ['users:read', 'billing:write'], public: false },
      { id: 'GET /health', requires: [], public: true },
    ],
  };
}
