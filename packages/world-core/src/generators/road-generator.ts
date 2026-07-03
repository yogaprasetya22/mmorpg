/**
 * Road / river network generator — deterministic via seed.
 * Creates L-system or Voronoi-like branching paths.
 *
 * Location: packages/world-core/src/generators/road-generator.ts
 */

import type { CreateNodeInput, Vec3 } from "../schema/node";
import { createSeededRandom, type SeededRandom } from "./seeded-random";

export interface RoadNetworkParams {
    seed: number;
    /** Start position */
    origin: Vec3;
    /** End position (optional, if absent road meanders) */
    destination?: Vec3;
    /** Road type */
    roadType?: "road" | "river";
    /** How many segments */
    segmentCount?: number;
    /** Segment length */
    segmentLength?: number;
    /** Winding factor (0 = straight, 1 = very windy) */
    winding?: number;
    /** Branch probability per segment */
    branchChance?: number;
    /** Tag */
    tag?: string;
}

const ROAD_DEFAULTS = {
    roadType: "road" as const,
    segmentCount: 10,
    segmentLength: 8,
    winding: 0.3,
    branchChance: 0.15,
};

export function generateRoadNetwork(
    params: RoadNetworkParams,
): CreateNodeInput[] {
    const p = { ...ROAD_DEFAULTS, ...params };
    const rng = createSeededRandom(p.seed);
    const nodes: CreateNodeInput[] = [];
    const tag = p.tag ?? `${p.roadType}_${p.seed}`;

    function buildPath(
        start: Vec3,
        end: Vec3 | undefined,
        segments: number,
        depth: number,
    ): void {
        if (segments <= 0 || depth > 3) return;

        const points: Vec3[] = [{ ...start }];
        const dir = end
            ? {
                  x: end.x - start.x,
                  y: 0,
                  z: end.z - start.z,
              }
            : {
                  x: rng.range(-1, 1),
                  y: 0,
                  z: rng.range(-1, 1),
              };

        const dist =
            Math.sqrt(dir.x * dir.x + dir.z * dir.z) ||
            p.segmentLength * segments;
        const stepX = dir.x / segments;
        const stepZ = dir.z / segments;
        const perpX = -stepZ / (dist / segments);
        const perpZ = stepX / (dist / segments);

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const wobble =
                Math.sin(t * Math.PI * 3) * p.winding * p.segmentLength;
            points.push({
                x:
                    start.x +
                    stepX * i +
                    (perpX || 0) * wobble * rng.range(0.5, 1.5),
                y: start.y,
                z:
                    start.z +
                    stepZ * i +
                    (perpZ || 0) * wobble * rng.range(0.5, 1.5),
            });
        }

        // Create nodes for segments
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const width =
                p.roadType === "river" ? rng.range(1.5, 3) : rng.range(1, 2);
            nodes.push({
                type: p.roadType,
                name: `${p.roadType.charAt(0).toUpperCase() + p.roadType.slice(1)} Seg ${i + 1}`,
                position: pt,
                scale: { x: width, y: 0.05, z: p.segmentLength * 0.9 },
                properties: { seed: p.seed, segmentIndex: i, depth },
                tags: [tag, p.roadType, `depth_${depth}`],
            });

            // Branch
            if (rng.next() < p.branchChance && i > 1 && i < points.length - 1) {
                const branchEnd: Vec3 = {
                    x:
                        pt.x +
                        rng.range(-p.segmentLength * 2, p.segmentLength * 2),
                    y: pt.y,
                    z:
                        pt.z +
                        rng.range(-p.segmentLength * 2, p.segmentLength * 2),
                };
                buildPath(pt, branchEnd, Math.floor(segments / 2), depth + 1);
            }
        }
    }

    buildPath(p.origin, p.destination, p.segmentCount, 0);
    return nodes;
}
