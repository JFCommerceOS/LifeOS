#!/usr/bin/env node
/**
 * Locale parity vs en.json: reports % of key paths present per locale.
 * Exit 1 if any locale is below MIN_RATIO (default 0.99) or JSON parse fails.
 *
 * Env:
 *   I18N_SCOPE — optional top-level namespace (e.g. `mediation`) to audit only that subtree.
 *   I18N_MIN_RATIO — default 0.99; use 1 for strict checks on scoped runs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'apps', 'web', 'src', 'i18n', 'locales');

/**
 * Must match `MediationReasonKey` + tone keys in apps/api assistant-mediation-decision / domain-tone-service.
 * If you add a branch in the API, add a string here and in all locale files.
 */
const EXPECTED_MEDIATION_LEAVES = [
  'repeatSuppress',
  'trustGateConfirm',
  'sensitivityVeryHighPrimary',
  'escalateDelivery',
  'sensitivityHighPrimary',
  'sensitivityHighTile',
  'stableHighRankPhone',
  'stableLowRankTile',
  'overloadedSuppress',
  'overloadedWatch',
  'recoveryTile',
  'transitionDeferWatch',
  'transitionImportantPhone',
  'defaultPrimary',
  'domainToneMinimal',
  'domainToneCompact',
  'domainToneSlow',
];

/** CLI first argument wins over I18N_SCOPE env (avoids stale env in dev shells). */
const SCOPE = (process.argv[2] ?? process.env.I18N_SCOPE ?? '').trim();
const MIN_RATIO = Number(
  process.env.I18N_MIN_RATIO ?? (SCOPE ? '0.99' : '0.5'),
);

function flattenKeys(obj, prefix = '') {
  const keys = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys;
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(path);
    if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys.push(...flattenKeys(obj[k], path));
    }
  }
  return keys;
}

function keySetFromEn(enJson) {
  return new Set(flattenKeys(enJson));
}

function countPresent(enKeys, localeJson) {
  let present = 0;
  for (const k of enKeys) {
    const parts = k.split('.');
    let cur = localeJson;
    let ok = true;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined) present++;
  }
  return present;
}

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json'));
const enPath = join(localesDir, 'en.json');
const enRaw = readFileSync(enPath, 'utf8');
const en = JSON.parse(enRaw);

let failed = false;
if (SCOPE === 'mediation') {
  const med = en.mediation;
  if (!med || typeof med !== 'object') {
    console.error('en.json: missing top-level "mediation" object');
    failed = true;
  } else {
    for (const k of EXPECTED_MEDIATION_LEAVES) {
      if (typeof med[k] !== 'string' || !String(med[k]).trim()) {
        console.error(
          `en.json: mediation.${k} missing or empty — add key (see assistant-mediation-decision.ts MediationReasonKey)`,
        );
        failed = true;
      }
    }
  }
}

let enKeys = keySetFromEn(en);
if (SCOPE) {
  const prefix = `${SCOPE}.`;
  enKeys = new Set([...enKeys].filter((k) => k === SCOPE || k.startsWith(prefix)));
  console.log(`Scope: ${SCOPE} (${enKeys.size} key paths vs en.json)\n`);
} else {
  console.log(`Reference: en.json — ${enKeys.size} key paths (set I18N_SCOPE=mediation to audit one namespace)\n`);
}
const total = enKeys.size;

for (const f of files.sort()) {
  if (f === 'en.json') continue;
  const path = join(localesDir, f);
  let loc;
  try {
    loc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${f}: INVALID JSON — ${e.message}`);
    failed = true;
    continue;
  }
  const present = countPresent(enKeys, loc);
  const ratio = total ? present / total : 1;
  const pct = (ratio * 100).toFixed(2);
  const line = `${f}: ${present}/${total} (${pct}%)`;
  if (ratio < MIN_RATIO) {
    console.error(`FAIL ${line} (min ${MIN_RATIO * 100}%)`);
    failed = true;
  } else {
    console.log(`OK   ${line}`);
  }
}

process.exit(failed ? 1 : 0);
