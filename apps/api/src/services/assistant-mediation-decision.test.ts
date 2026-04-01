import { describe, expect, it } from 'vitest';
import { decideMediation } from './assistant-mediation-decision.js';

describe('decideMediation', () => {
  it('suppresses after repeated dismissals', () => {
    const r = decideMediation({
      state: 'focused',
      rank: 0.95,
      confidence: 0.95,
      trustScore: 0.8,
      sensitivityClass: 'safe',
      dismissCount: 3,
    });
    expect(r.mediationDecision).toBe('suppress');
    expect(r.targetSurface).toBe('silent');
    expect(r.reasonKey).toBe('repeatSuppress');
  });

  it('asks when trust is low', () => {
    const r = decideMediation({
      state: 'focused',
      rank: 0.8,
      confidence: 0.8,
      trustScore: 0.35,
      sensitivityClass: 'safe',
      dismissCount: 0,
    });
    expect(r.mediationDecision).toBe('ask');
    expect(r.targetSurface).toBe('phone');
    expect(r.reasonKey).toBe('trustGateConfirm');
  });

  it('routes very_high sensitivity to phone', () => {
    const r = decideMediation({
      state: 'focused',
      rank: 0.5,
      confidence: 0.5,
      trustScore: 0.8,
      sensitivityClass: 'very_high',
      dismissCount: 0,
    });
    expect(r.mediationDecision).toBe('route_to_phone');
    expect(r.targetSurface).toBe('phone');
    expect(r.reasonKey).toBe('sensitivityVeryHighPrimary');
  });

  it('escalates strong signal when focused and not overloaded', () => {
    const r = decideMediation({
      state: 'focused',
      rank: 0.9,
      confidence: 0.9,
      trustScore: 0.6,
      sensitivityClass: 'safe',
      dismissCount: 0,
    });
    expect(r.mediationDecision).toBe('escalate');
    expect(r.targetSurface).toBe('phone');
    expect(r.reasonKey).toBe('escalateDelivery');
  });

  it('does not escalate when overloaded', () => {
    const r = decideMediation({
      state: 'overloaded',
      rank: 0.95,
      confidence: 0.95,
      trustScore: 0.8,
      sensitivityClass: 'safe',
      dismissCount: 0,
    });
    expect(r.mediationDecision).not.toBe('escalate');
    expect(['suppress', 'route_to_watch']).toContain(r.mediationDecision);
  });

  it('routes high sensitivity + low rank to tile', () => {
    const r = decideMediation({
      state: 'focused',
      rank: 0.4,
      confidence: 0.5,
      trustScore: 0.8,
      sensitivityClass: 'high',
      dismissCount: 0,
    });
    expect(r.mediationDecision).toBe('route_to_tile');
    expect(r.targetSurface).toBe('tile');
    expect(r.reasonKey).toBe('sensitivityHighTile');
  });

  it('maps overloaded medium rank to watch', () => {
    const r = decideMediation({
      state: 'overloaded',
      rank: 0.5,
      confidence: 0.5,
      trustScore: 0.8,
      sensitivityClass: 'safe',
      dismissCount: 0,
    });
    expect(r.mediationDecision).toBe('route_to_watch');
    expect(r.targetSurface).toBe('watch');
    expect(r.reasonKey).toBe('overloadedWatch');
  });
});
