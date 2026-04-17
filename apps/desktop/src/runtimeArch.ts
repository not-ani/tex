import type { DesktopRuntimeArch, DesktopRuntimeInfo } from "@tex/contracts";

function resolveDesktopRuntimeArch(arch: string): DesktopRuntimeArch {
  if (arch === "arm64") return "arm64";
  if (arch === "x64") return "x64";
  return "other";
}

export function resolveDesktopRuntimeInfo(args: {
  processArch: string;
  runningUnderArm64Translation: boolean;
}): DesktopRuntimeInfo {
  const appArch = resolveDesktopRuntimeArch(args.processArch);
  const hostArch =
    args.runningUnderArm64Translation && appArch === "x64" ? "arm64" : appArch;

  return {
    hostArch,
    appArch,
    runningUnderArm64Translation: args.runningUnderArm64Translation
  };
}

export function isArm64HostRunningIntelBuild(runtimeInfo: DesktopRuntimeInfo): boolean {
  return runtimeInfo.hostArch === "arm64" && runtimeInfo.appArch === "x64";
}
