import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    /* config options here */
    allowedDevOrigins: [
        "192.168.1.11",
        "192.168.0.55",
        "192.168.13.2",
        "192.168.1.12",
    ],
    // Set turbopack root to parent directory (workspace root) to allow transpiling shared package
    turbopack: {
        root: path.resolve(".."),
        // Force ALL imports of these packages to resolve from a single location,
        // preventing dual-instance problems (especially @react-three/fiber context mismatch).
        // Using relative string paths (./node_modules/...) avoids Turbopack's
        // "server relative imports" error that occurs with absolute paths (path.resolve).
        resolveAlias: {
            three: ["./node_modules/three"],
            "three-stdlib": ["./node_modules/three-stdlib"],
            "three-mesh-bvh": ["./node_modules/three-mesh-bvh"],
            "@react-three/fiber": ["./node_modules/@react-three/fiber"],
            "@react-three/drei": ["./node_modules/@react-three/drei"],
            "r3f-perf": ["./node_modules/r3f-perf"],
        },
    },
    // Ensure that heavy three.js imports are optimized
    transpilePackages: [
        "@jagres/shared",
        "three",
        "three-mesh-bvh",
        "bvhecctrl",
        "@react-three/fiber",
        "@react-three/drei",
        "r3f-perf",
    ],
    images: {
        remotePatterns: [{ protocol: "https", hostname: "**.ftcdn.net" }],
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            three: path.resolve("node_modules/three"),
            "three-mesh-bvh": path.resolve("node_modules/three-mesh-bvh"),
            "@jagres/shared": path.resolve("../packages/shared/src/index.ts"),
        };
        return config;
    },
    experimental: {
        optimizePackageImports: ["three", "lucide-react", "@react-three/drei"],
    },
};

export default nextConfig;
