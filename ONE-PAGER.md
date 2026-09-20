# PermCTL

A declarative **permission framework** and a **companion explainer**. You define permissions, resources, and API endpoints in YAML. The site then lets you read that model, browse the implication DAG, and — the part that is hard by hand — shows the exact YAML diffs required to remove a grant.

---

## The framework

The model is three lists. Permissions form a DAG: `implies` is transitive, cycles are an error. Resources map named actions onto permissions so every endpoint that uses `users.write` stays consistent when that mapping changes. Endpoints AND their `requires` together (or are `public`).

| Concept | What it is | Example |
|---|---|---|
| **Permission** | A node. Holding it grants everything reachable via `implies`. | `users:write` implies `users:read` |
| **Resource** | A type with named actions, each pointing at one permission. | `users.write` → `users:write` |
| **Endpoint** | An API route. Every entry in `requires` must hold. | `DELETE /users/{id}` requires `users.write` |

Load the YAML once, then `check` a caller against an endpoint or resource action. `explain` adds the shortest implication path. The `permctl` CLI does the same from a shell: `validate`, `check`, `explain`.

```
$ permctl explain examples/basic.yaml --has admin --endpoint "GET /users/{id}"
ALLOW  endpoint "GET /users/{id}"
  [ok] users:read   via admin -> users:write -> users:read
```

---

## The companion site

The website is a working model, not a brochure. Each bundled example (GitHub, Stripe, Slack, healthcare, multiplayer, plus a minimal `basic` graph) is a complete instance you can open.

From an instance you can:

- Read every **permission**, **resource**, and **endpoint**, including who implies whom and which routes require which nodes.
- Open the **implication DAG** and click a node to highlight its closure.
- Expand any implied-by / implies pair to see **every path** through the graph.

That is how you answer “what does `role:admin` actually grant?” without grepping YAML.

---

## The distinctive tool: remove a grant with a real diff

Grown DAGs are easy to widen and hard to narrow. Taking privilege away means deleting the right `implies` edges — often more than one, often in more than one file — without breaking formatting.

On a permission page, expand a connection and choose **Show changes required to remove this connection**. The site:

1. Finds every implication path from A to B.
2. Collects the `implies` edges on those paths.
3. Rewrites the existing YAML (inline lists, block lists, multi-file models) and emits a **unified diff**.

Example: stop `admin` from granting `users:read`. The path is `admin → users:write → users:read`. Both hops have to go:

```diff
--- examples/basic.yaml
+++ examples/basic.yaml
@@ -4,12 +4,11 @@
     description: Read user records
   - id: users:write
     description: Create, update and delete user records
-    implies: [users:read]
   - id: billing:write
     description: Issue invoices and refunds
   - id: admin
     description: Everything
-    implies: [users:write, billing:write]
+    implies: [billing:write]
```

That patch is computed from the real source text, not a schematic. Paste it into a pull request.

---

## How the pieces fit

```
YAML (permissions / resources / endpoints)
        │
        ▼
   validate → DAG + closures
        │
        ├── runtime:  check / explain  (library or permctl)
        └── explainer site
                ├── browse nodes and the DAG
                └── removal diffs against the YAML you already have
```

Define the model in reviewable config. Enforce it at request time. Use the site when you need to understand a grant — or take one away.
