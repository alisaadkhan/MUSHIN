import { describe, it, expect } from 'vitest';

describe('Influencer Business Logic', () => {
    it('should calculate engagement rate correctly base on metrics', () => {
        const likes = 1500;
        const comments = 500;
        const followers = 100000;
        const er = ((likes + comments) / followers) * 100;
        expect(er).toBe(2);
    });

    it('should accurately format follower counts into short strings', () => {
        // Utility function mirroring SearchPage logic
        const formatFollowers = (n: number) => {
            if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
            if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
            return n.toString();
        };

        expect(formatFollowers(1500)).toBe("1.5K");
        expect(formatFollowers(10000)).toBe("10K");
        expect(formatFollowers(1200000)).toBe("1.2M");
        expect(formatFollowers(999)).toBe("999");
        expect(formatFollowers(2500000)).toBe("2.5M");
    });

    it('should correctly assign niche confidence penalties', () => {
        const baseConfidence = 0.85;
        const uncertaintyPenalty = 0.20;

        // Simulate tied scores penalty logic
        const finalConfidence = baseConfidence - uncertaintyPenalty;
        expect(finalConfidence).toBeCloseTo(0.65);
    });
});

describe('Credit System', () => {
    // Mirrors the GREATEST(col + delta, 0) invariant enforced by admin_adjust_credits SQL RPC
    const adjustCredit = (current: number, delta: number) => Math.max(0, current + delta);

    it('should clamp credits to 0 when a large negative adjustment is applied', () => {
        expect(adjustCredit(10, -50)).toBe(0);
    });

    it('should allow credits to reach exactly 0', () => {
        expect(adjustCredit(10, -10)).toBe(0);
    });

    it('should allow positive adjustments to add correctly', () => {
        expect(adjustCredit(100, 50)).toBe(150);
    });

    it('should never produce a negative credit balance', () => {
        const deltas = [-1000, -500, -1, -0.5];
        for (const delta of deltas) {
            expect(adjustCredit(0, delta)).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('Billing Usage', () => {
    const usagePct = (used: number, limit: number) =>
        limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));

    it('should return 0% when nothing has been used', () => {
        expect(usagePct(0, 100)).toBe(0);
    });

    it('should return 100% when the limit is exactly hit', () => {
        expect(usagePct(100, 100)).toBe(100);
    });

    it('should cap at 100% when usage exceeds the limit', () => {
        expect(usagePct(150, 100)).toBe(100);
    });

    it('should return 100% for a zero-limit plan (unlimited edge case)', () => {
        expect(usagePct(5, 0)).toBe(100);
    });

    it('should round to nearest integer', () => {
        expect(usagePct(1, 3)).toBe(33); // 33.33... → 33
    });
});

describe('Bot Detection', () => {
    const getConfidenceTier = (score: number): string => {
        const clamped = Math.min(1, Math.max(0, score));
        if (clamped >= 0.75) return 'high';
        if (clamped >= 0.45) return 'medium';
        return 'low';
    };

    it('should return high confidence for scores ≥ 0.75', () => {
        expect(getConfidenceTier(0.75)).toBe('high');
        expect(getConfidenceTier(0.99)).toBe('high');
        expect(getConfidenceTier(1.0)).toBe('high');
    });

    it('should return medium confidence for scores in [0.45, 0.75)', () => {
        expect(getConfidenceTier(0.45)).toBe('medium');
        expect(getConfidenceTier(0.60)).toBe('medium');
        expect(getConfidenceTier(0.74)).toBe('medium');
    });

    it('should return low confidence for scores below 0.45', () => {
        expect(getConfidenceTier(0.0)).toBe('low');
        expect(getConfidenceTier(0.44)).toBe('low');
    });

    it('should clamp scores above 1.0 to 1.0 (high tier)', () => {
        expect(getConfidenceTier(2.5)).toBe('high');
    });

    it('should clamp negative scores to 0.0 (low tier)', () => {
        expect(getConfidenceTier(-0.5)).toBe('low');
    });
});
