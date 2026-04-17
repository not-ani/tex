import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

function resolveDesktopUpdateChannel(version) {
  return /-nightly\.\d{8}\.\d+$/.test(version) ? "nightly" : "latest";
}

function resolveGitHubPublishConfig(updateChannel) {
  const rawRepo =
    process.env.TEX_DESKTOP_UPDATE_REPOSITORY?.trim() ||
    process.env.GITHUB_REPOSITORY?.trim() ||
    "not-ani/tex";
  const [owner, repo, ...rest] = rawRepo.split("/");

  if (!owner || !repo || rest.length > 0) {
    return undefined;
  }

  return {
    provider: "github",
    owner,
    repo,
    releaseType: updateChannel === "nightly" ? "prerelease" : "release",
    ...(updateChannel === "nightly" ? { channel: "nightly" } : {})
  };
}

const updateChannel = resolveDesktopUpdateChannel(pkg.version);
const publishConfig = resolveGitHubPublishConfig(updateChannel);

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "com.notani.tex",
  productName: updateChannel === "nightly" ? "Tex (Nightly)" : pkg.productName || "Tex",
  artifactName: "Tex-${version}-${arch}.${ext}",
  directories: {
    buildResources: "resources",
    output: "dist-packages"
  },
  files: ["dist-electron/**", "package.json"],
  extraResources: [{ from: "../web/dist", to: "web-dist" }],
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.productivity"
  },
  dmg: {
    writeUpdateInfo: true
  },
  win: {
    target: ["nsis"]
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  },
  linux: {
    target: ["AppImage"],
    category: "Office"
  },
  publish: publishConfig ? [publishConfig] : undefined
};

export default config;
