import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadModel } from '../src/loader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = (name: string) => path.join(here, '..', 'examples', name);

describe('examples/stripe', () => {
  it('scopes restricted keys', async () => {
    const m = await loadModel(examples('stripe'));
    expect(m.check(['key:checkout'], 'POST /v1/charges').allowed).toBe(true);
    // A checkout key can see the charge but not refund it.
    const refund = m.explain(['key:checkout'], 'POST /v1/refunds');
    expect(refund.allowed).toBe(false);
    expect(refund.requirements.map((r) => r.satisfied)).toEqual([false, true]);
    expect(m.check(['key:support'], 'POST /v1/refunds').allowed).toBe(true);
    // Support can read the balance but never pay out.
    expect(m.check(['key:support'], 'POST /v1/payouts').unmet).toEqual(['payouts:write']);
    expect(m.check(['key:finance'], 'POST /v1/payouts').allowed).toBe(true);
    expect(m.check(['key:read-only'], 'POST /v1/customers').allowed).toBe(false);
    const missing = m.permissions().map((p) => p.id).filter((id) => !m.closure('key:secret').has(id));
    expect(missing).toEqual([]);
  });
});

describe('examples/slack', () => {
  it('models guests as a non-prefix subset of members', async () => {
    const m = await loadModel(examples('slack'));
    expect(m.check(['role:guest'], 'POST /api/chat.postMessage').allowed).toBe(true);
    expect(m.check(['role:guest'], 'POST /api/conversations.create').allowed).toBe(false);
    expect(m.check(['role:guest'], 'GET /api/users.list').allowed).toBe(false);
    expect(m.check(['role:member'], 'POST /api/conversations.create').allowed).toBe(true);
    expect(m.check(['role:admin'], 'POST /api/admin.users.setAdmin').unmet).toEqual(['members:roles']);
    expect(m.check(['role:owner'], 'POST /api/admin.users.setAdmin').allowed).toBe(true);
    expect(m.check(['role:owner'], 'POST /api/admin.teams.delete').unmet).toEqual(['workspace:delete']);
    expect(m.check(['role:primary-owner'], 'POST /api/admin.teams.delete').allowed).toBe(true);
  });
});

describe('examples/healthcare', () => {
  it('keeps clinical roles narrow', async () => {
    const m = await loadModel(examples('healthcare'));
    expect(m.check([], 'GET /fhir/metadata').allowed).toBe(true);
    const nurse = m.explain(['role:nurse'], 'POST /fhir/MedicationRequest');
    expect(nurse.allowed).toBe(false);
    expect(nurse.requirements.map((r) => [r.permission, r.satisfied])).toEqual([
      ['medication:prescribe', false],
      ['condition:read', true],
      ['patient:read', true],
    ]);
    expect(m.check(['role:physician'], 'POST /fhir/MedicationRequest').allowed).toBe(true);
    expect(m.check(['role:pharmacist'], 'POST /fhir/MedicationDispense').allowed).toBe(true);
    expect(m.check(['role:pharmacist'], 'GET /fhir/Patient/{id}').allowed).toBe(false);
    expect(m.check(['role:receptionist'], 'POST /fhir/Appointment').allowed).toBe(true);
    expect(m.check(['role:receptionist'], 'GET /fhir/Observation').allowed).toBe(false);
    expect(m.check(['role:records-officer'], 'POST /fhir/Patient/$merge').allowed).toBe(true);
    expect(m.check(['role:privacy-officer'], 'POST /fhir/Patient/$merge').unmet).toEqual(['patient:merge']);
    expect(m.check(['role:physician'], 'POST /fhir/Patient/{id}/$break-glass').allowed).toBe(true);
  });
});

describe('examples/multiplayer', () => {
  it('keeps moderation and economy as sibling branches', async () => {
    const m = await loadModel(examples('multiplayer'));
    expect(m.check(['role:player'], 'POST /matches').allowed).toBe(true);
    expect(m.check(['role:player'], 'POST /matches/{id}/end').allowed).toBe(false);
    expect(m.check(['role:moderator'], 'POST /bans').allowed).toBe(true);
    expect(m.check(['role:moderator'], 'POST /players/{id}/inventory').allowed).toBe(false);
    expect(m.check(['role:game-master'], 'POST /players/{id}/inventory').allowed).toBe(true);
    expect(m.check(['role:game-master'], 'POST /bans').allowed).toBe(false);
    expect(m.check(['role:moderator', 'role:game-master'], 'POST /server/restart').unmet).toEqual(['server:restart', 'telemetry:read']);
    const dev = m.explain(['role:developer'], 'POST /bans');
    expect(dev.allowed).toBe(true);
    expect(dev.requirements[0]?.path).toEqual(['role:developer', 'role:moderator', 'ban:issue']);
  });
});
