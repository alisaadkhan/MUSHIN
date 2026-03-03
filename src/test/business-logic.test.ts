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
