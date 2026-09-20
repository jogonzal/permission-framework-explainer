# permission-framework-explainer

A small, declarative permission framework. Permissions form a **DAG**: a permission can `imply` other permissions, and those can imply more. Permissions are assigned to **API endpoints** and to **API resources** (types with named actions). A config file describes the whole model; the `permctl` CLI validates it, checks whether a set of granted permissions allows a call, and **explains why** by printing the implication chain.

```
$ permctl explain examples/basic.yaml --has admin --endpoint "GET /users/{id}"
ALLOW  endpoint "GET /users/{id}"
  [ok] users:read   via admin -> users:write -> users:read
```

## Quick start

```bash
npm install
npm run build
node dist/cli.js validate examples/basic.yaml
node dist/cli.js check   examples/basic.yaml --has users:read --endpoint "DELETE /users/{id}"
node dist/cli.js explain examples/github     --has role:write --endpoint "PUT /repos/{owner}/{repo}/pulls/{number}/merge"
```

`npm link` (or installing the package) puts `permctl` on your PATH.

## Concepts

| Concept | What it is | Example |
|---|---|---|
| **Permission** | A node in the DAG. `implies` lists the permissions it grants, transitively. | `users:write` implies `users:read` |
| **Resource** | A resource *type* with named actions. Each action maps to the permission it needs. | `users` has `read -> users:read`, `write -> users:write` |
| **Endpoint** | An API route. `requires` lists what a caller must hold. **All** entries must be satisfied. | `DELETE /users/{id}` requires `users.write` |
| **Public endpoint** | `public: true`; no permissions required. | `GET /health` |

An endpoint requirement is either a **permission id** (`users:read`) or a **resource action** (`users.write`). Pointing endpoints at resource actions keeps every endpoint on a resource consistent: change the action's permission once and every endpoint follows.

### Reference grammar

Ids are designed so a string can only ever match one grammar:

| Kind | Pattern | Examples |
|---|---|---|
| Permission id | `[a-z0-9_-]+` segments joined by `:` (no dots) | `admin`, `users:read`, `org:repo:write` |
| Resource id / action name | one `[a-z0-9_-]+` segment | `users`, `read`, `force-push` |
| Resource-action reference | `<resource>.<action>` (exactly one dot) | `users.write` |
| Endpoint id | any non-empty unique string | `GET /users/{id}` |

### Semantics

- `implies` is transitive: holding `admin` means holding everything reachable from it.
- Cycles are an error. `validate` prints the cycle path.
- `requires` is AND-only. Every listed requirement must be satisfied.
- An endpoint with no `requires` is an error unless `public: true` (fail closed). `public: true` together with `requires` is also an error.
- Granted permission ids that are not defined in the model are ignored for the decision and reported as `unknownGranted`.

## Config reference

Files are YAML or JSON. `<path>` may be one file or a directory; a directory is read recursively in sorted path order and the `permissions`, `resources`, and `endpoints` arrays are concatenated. Multi-document YAML (`---`) is rejected. Unknown keys are errors.

```yaml
permissions:
  - id: users:read              # required, permission grammar
    description: Read users     # optional
    implies: [ ... ]            # optional, permission ids; default []

resources:
  - id: users                   # required, single segment
    description: User accounts  # optional
    actions:                    # optional map action -> permission id
      read: users:read
      write: users:write

endpoints:
  - id: GET /users/{id}         # required, any non-empty string, unique
    description: Fetch a user   # optional
    requires: [users:read, users.write]   # permission ids and/or resource actions
    public: false               # optional, default false
```

Full examples: [`examples/basic.yaml`](examples/basic.yaml), the same split across files in [`examples/split/`](examples/split), and deliberately broken configs in [`examples/invalid/`](examples/invalid).

### Worked examples

Each directory under `examples/` models a real system and stresses a different part of the DAG:

| Example | What it shows |
|---|---|
| [`github/`](examples/github) | Repository roles (`role:read` to `role:admin`, `org:owner`) as permissions that imply finer ones |
| [`stripe/`](examples/stripe) | Restricted API keys as permission sets; refunds and payouts need two leaf permissions |
| [`slack/`](examples/slack) | Guests hold a subset of member permissions that is not a strict prefix, so the DAG is not a chain |
| [`healthcare/`](examples/healthcare) | Narrow clinical roles; prescribing needs three leaves; a `break-glass` emergency permission |
| [`multiplayer/`](examples/multiplayer) | Moderation and economy are sibling branches that only the developer role unifies |

```
$ permctl explain examples/healthcare --has role:nurse --endpoint "POST /fhir/MedicationRequest"
DENY   endpoint "POST /fhir/MedicationRequest"
  [--] medications.prescribe -> medication:prescribe   unmet (granted: role:nurse)
  [ok] conditions.read -> condition:read   via role:nurse -> condition:read
  [ok] patients.read -> patient:read   via role:nurse -> patient:read
```

## CLI

```
permctl validate <path> [--json]
permctl check   <path> --has <perm>[,<perm>...] [--has ...] <target> [--json]
permctl explain <path> --has <perm>[,<perm>...] [--has ...] <target> [--json]
permctl --help | --version
```

`<target>` is exactly one of `--endpoint "<id>"`, `--resource <id> --action <name>`, or `--target <resource>.<action>`.

| Command | Exit 0 | Exit 1 | Exit 2 |
|---|---|---|---|
| `validate` | valid | invalid | usage or file error |
| `check`, `explain` | allowed | denied, or config invalid | usage error, unknown target, or file error |

`--json` prints one JSON document on stdout (the `ValidationResult`, `CheckResult`, or `ExplainResult` below) and nothing else.

```
$ permctl validate examples/invalid/dangling.yaml
error E_UNKNOWN_PERMISSION [examples/invalid/dangling.yaml] permissions[1].implies[0]: permission "users:red" is not defined (did you mean "users:read"?)
error E_UNKNOWN_RESOURCE [examples/invalid/dangling.yaml] endpoints[0].requires[0]: resource "user" is not defined (did you mean "users"?)
error E_UNKNOWN_ACTION [examples/invalid/dangling.yaml] endpoints[1].requires[0]: resource "users" has no action "delete" (actions: read)
error E_EMPTY_REQUIRES [examples/invalid/dangling.yaml] endpoints[2]: endpoint "GET /health" has no requirements; add requires or set public: true
invalid: 4 errors, 0 warnings

$ permctl explain examples/github --has role:admin --endpoint "POST /repos/{owner}/{repo}/transfer"
DENY   endpoint "POST /repos/{owner}/{repo}/transfer"
  [ok] repos.delete -> repo:delete   via role:admin -> repo:delete
  [--] org:read   unmet (granted: role:admin)
```

## Programmatic use

```ts
import { loadModel, buildModel, validateConfig } from 'permission-framework-explainer';

const model = await loadModel('config/permissions');   // file or directory; throws ConfigError when invalid

// In a request handler:
const result = model.check(user.permissions, { kind: 'endpoint', id: 'DELETE /users/{id}' });
if (!result.allowed) deny(result.unmet);

// Or by resource action, as an object or a string:
model.check(user.permissions, 'users.write');

// Why?
const why = model.explain(['admin'], 'GET /users/{id}');
// why.requirements[0].path === ['admin', 'users:write', 'users:read']
```

Build the model once at startup. `check` is O(number of requirements); closures are precomputed. `validateConfig(config)` returns every diagnostic without throwing, for tooling.

Result shapes:

```ts
interface CheckResult   { allowed: boolean; target: Target; public: boolean; unmet: string[]; unknownGranted: string[] }
interface ExplainResult { allowed: boolean; target: Target; public: boolean; requirements: RequirementResult[]; unknownGranted: string[] }
interface RequirementResult { ref: RequirementRef; permission: string; satisfied: boolean; grantedVia?: string; path?: string[] }
```

## Validation codes

| Code | Meaning |
|---|---|
| `E_SCHEMA` | Wrong shape or unknown key |
| `E_BAD_ID` | Id does not match its grammar |
| `E_BAD_REF` | `requires` entry is neither a permission id nor a resource action |
| `E_DUPLICATE_ID` | Same id defined twice (cites the first file) |
| `E_UNKNOWN_PERMISSION` | Reference to an undefined permission (with a "did you mean" hint) |
| `E_UNKNOWN_RESOURCE` | Reference to an undefined resource |
| `E_UNKNOWN_ACTION` | Resource has no such action (lists the available ones) |
| `E_CYCLE` | Implication cycle, with its path |
| `E_EMPTY_REQUIRES` | Endpoint has no requirements and is not public |
| `E_PUBLIC_WITH_REQUIRES` | Endpoint is public but lists requirements |
| `E_FILE` | Missing, unreadable, or unparseable file |

## How it works

- `src/graph.ts`: cycle detection by iterative three-colour DFS, transitive closure by memoized DFS (each node expanded once), shortest implication path by BFS.
- `src/validate.ts`: collects every diagnostic in one pass rather than stopping at the first.
- `src/model.ts`: `check` unions the closures of the granted ids and tests each requirement; `explain` additionally finds the shortest path from a granted id to each requirement, preferring a direct grant.
- `src/loader.ts`: YAML/JSON loading and directory merge with per-id provenance for duplicate messages.

## Options considered

| Option | Verdict |
|---|---|
| **Declarative YAML/JSON + validating loader** (chosen) | Reviewable in pull requests, language-agnostic, easy to lint and visualize, and the model API is storage-agnostic so a database can back it later. |
| Code-first typed DSL | Compile-time safety, but every change needs a build and only developers can edit it. |
| Database-backed with an admin API | Runtime editing, but adds state and infrastructure. Can be layered on later by feeding the same `Config` shape into `buildModel`. |
| Policy engine (Cedar, OPA) | Far more expressive than needed; the implication DAG has to be bent into the engine's model and explaining a decision as a path is harder. |

## Future work

- `anyOf` requirements alongside the AND-only `requires`.
- Object-form references (`{ resource: users, action: write }`).
- HTTP middleware adapters (Express, Fastify) that read the endpoint id from the route.
- Mermaid / Graphviz export of the DAG and assignments.
- A database-backed store and admin API for runtime edits.

## Development

```bash
npm test            # vitest
npm run typecheck   # tsc over src and tests
npm run lint        # eslint
npm run build       # emits dist/
```
