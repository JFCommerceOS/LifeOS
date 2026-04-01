# Single-writer invariants (interim — full sync deferred)

The **Cross-Cutting Hardening Blueprint** Layer C (sync mutation log, conflict resolution, idempotent replay) is **not implemented** yet. Until multi-device **writers** (e.g. phone-owned local store + home node) are in scope, the continuity core should enforce **single-writer invariants** so behavior stays predictable and migrations to Layer C remain possible.

---

## Scope

Applies to the **current** architecture: **API + PostgreSQL** as continuity core ([`ecosystem-manifest` continuityCore](../apps/api/src/lib/ecosystem-manifest.ts) dev baseline). Connectors may ingest **external** data, but **canonical state mutations** for obligations, suggestions, memory corrections, etc. are assumed to flow through this API (or scripts the team runs against the same DB).

---

## Invariants

1. **One authoritative Postgres per user workspace**  
   No second simultaneous writer performing merges without the future mutation log. `db push` / manual SQL are operator actions, not concurrent app writers.

2. **Idempotency at intake boundaries**  
   Source records, signals, and connector rows should use **stable source IDs / fingerprints / idempotency keys** where the blueprint requires them, so replay does not duplicate obligations (aligns with blueprint §5.3 duplicate prevention).

3. **Suggestions and Daily Brief are derived**  
   They may be recomputed from canonical entities; they are not sources of truth (blueprint §5.3, §10).

4. **User corrections beat inference**  
   Memory corrections, explicit dismiss/resolve, and confirmed obligations take precedence over automated re-surfacing when recomputation runs.

5. **Connector sync is incremental, not a second conflict engine**  
   Until Layer C, connector code should **avoid** destructive merges; prefer last-write-wins **only** where product explicitly allows it, and log audit entries for purge/resync.

6. **Edge devices (Phase 7)**  
   Phones/watches consuming **read-heavy** + **small writes** (capture, quick actions) still target the **same API**; they do not maintain a divergent replica that must merge offline without the mutation log.

---

## When to implement Layer C

When **two or more peers** must hold editable continuity state offline or across nodes with **concurrent** edits, add:

- Append-only mutation log (blueprint §5.3).
- Per-entity merge policies and conflict queue.
- Replay + idempotent operation IDs.

Until then, treat this document as the **contract** for engineers and agents: do not assume multi-master semantics.

---

## Related doc

- Phase A mapping and policy starter: [`docs/HARDENING_PHASE_A_DELTA.md`](HARDENING_PHASE_A_DELTA.md)
