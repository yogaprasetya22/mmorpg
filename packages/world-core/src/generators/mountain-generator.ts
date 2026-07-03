/**
 * Mountain range generator — deterministic via seed.
 * Creates layered peaks with height falloff.
 *
 * Location: packages/world-core/src/generators/mountain-generator.ts
 */

import type { CreateNodeInput, Vec3 } from "../schema/node";
import { createSeededRandom, type SeededRandom } from "./seeded-random";

export interface MountainRangeParams {
    seed: number;
    /** Center of the range */
    center: Vec3;
    /** Number of peaks */
    peakCount?: number;
    /** Spacing between peaks */
    spacing?: number;
    /** Max peak height */
    maxHeight?: number;
    /** Range length direction: "x" | "z" */
    direction?: "x" | "z";
    /** Base tag for all generated nodes */
    tag?: string;
}

const defaults: Required<Omit<MountainRangeParams, "seed" | "center" | "tag">> =
    {
        peakCount: 5,
        spacing: 12,
        maxHeight: 15,
        direction: "x",
    };

export function generateMountainRange(
    params: MountainRangeParams,
): CreateNodeInput[] {
    const p = { ...defaults, ...params };
    const rng = createSeededRandom(p.seed);
    const nodes: CreateNodeInput[] = [];
    const tag = p.tag ?? `mountain_range_${p.seed}`;

    // Create main chain
    for (let i = 0; i < p.peakCount; i++) {
        const t = i / (p.peakCount - 1); // 0..1
        const height = p.maxHeight * (0.6 + 0.4 * Math.sin(t * Math.PI)); // taller in middle
        const jitterX = rng.range(-3, 3);
        const jitterZ = rng.range(-3, 3);

        const pos: Vec3 =
            p.direction === "x"
                ? {
                      x: p.center.x + i * p.spacing + jitterX,
                      y: p.center.y + height / 2,
                      z: p.center.z + jitterZ,
                  }
                : {
                      x: p.center.x + jitterX,
                      y: p.center.y + height / 2,
                      z: p.center.z + i * p.spacing + jitterZ,
                  };

        nodes.push({
            type: "mountain",
            name: `Peak ${i + 1}`,
            position: pos,
            scale: {
                x: rng.range(6, 10),
                y: height,
                z: rng.range(6, 10),
            },
            properties: { seed: p.seed, peakIndex: i, height },
            tags: [tag, "mountain", `peak_${i}`],
        });

        // Foothills on sides
        if (i > 0 && rng.next() < 0.5) {
            const midX = (pos.x + (nodes[i - 1].position?.x ?? p.center.x)) / 2;
            const midZ = (pos.z + (nodes[i - 1].position?.z ?? p.center.z)) / 2;
            nodes.push({
                type: "mountain",
                name: `Foothill ${i}`,
                position: {
                    x: midX + rng.range(-4, 4),
                    y: p.center.y + height * 0.3,
                    z: midZ + rng.range(-4, 4),
                },
                scale: {
                    x: rng.range(3, 5),
                    y: height * 0.35,
                    z: rng.range(3, 5),
                },
                properties: { seed: p.seed, foothillOf: `Peak ${i}` },
                tags: [tag, "mountain", "foothill"],
            });
        }
    }

    return nodes;
}
