import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mergeUpdateManifests,
  parseUpdateManifest,
  serializeUpdateManifest
} from "./lib/update-manifest.mjs";

function getPlatformLabel(platform) {
  return platform === "mac" ? "macOS" : "Windows";
}

function parseArgs(args) {
  const [platformFlag, platformValue, primaryPathArg, secondaryPathArg, outputPathArg] = args;
  if (platformFlag !== "--platform" || (platformValue !== "mac" && platformValue !== "win")) {
    throw new Error(
      "Usage: node scripts/merge-update-manifests.mjs --platform <mac|win> <primary-path> <secondary-path> [output-path]"
    );
  }
  if (!primaryPathArg || !secondaryPathArg) {
    throw new Error(
      "Usage: node scripts/merge-update-manifests.mjs --platform <mac|win> <primary-path> <secondary-path> [output-path]"
    );
  }

  return {
    platform: platformValue,
    primaryPath: resolve(primaryPathArg),
    secondaryPath: resolve(secondaryPathArg),
    outputPath: resolve(outputPathArg ?? primaryPathArg)
  };
}

const { platform, primaryPath, secondaryPath, outputPath } = parseArgs(process.argv.slice(2));
const platformLabel = getPlatformLabel(platform);
const primary = parseUpdateManifest(readFileSync(primaryPath, "utf8"), primaryPath, platformLabel);
const secondary = parseUpdateManifest(
  readFileSync(secondaryPath, "utf8"),
  secondaryPath,
  platformLabel
);
const merged = mergeUpdateManifests(primary, secondary, platformLabel);

writeFileSync(outputPath, serializeUpdateManifest(merged));
