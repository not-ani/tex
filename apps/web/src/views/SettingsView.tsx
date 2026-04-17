import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, Monitor, Moon, RefreshCw, Rocket, Sun } from "lucide-react";
import type {
  AppInfo,
  DesktopUpdateChannel,
  DesktopUpdateState
} from "@tex/contracts";
import type { Theme } from "~/lib/theme";
import {
  canCheckForUpdate,
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  resolveDesktopUpdateButtonAction
} from "~/lib/desktop-updates";

interface Props {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onBack: () => void;
  desktopReady: boolean;
}

const options: { value: Theme; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "light", label: "Light", icon: Sun, hint: "Bright and paper-like" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Easy on the eyes" },
  { value: "system", label: "System", icon: Monitor, hint: "Match your OS" }
];

function formatUpdateStatus(state: DesktopUpdateState | null): string {
  if (!state) return "Loading updater state";
  switch (state.status) {
    case "disabled":
      return state.message ?? "Automatic updates are unavailable in this build.";
    case "idle":
      return "Ready to check for updates.";
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "You’re on the latest version.";
    case "available":
      return `Version ${state.availableVersion ?? "available"} is ready to download.`;
    case "downloading":
      return `Downloading ${state.availableVersion ?? "update"}${
        typeof state.downloadPercent === "number"
          ? ` (${Math.floor(state.downloadPercent)}%)`
          : ""
      }.`;
    case "downloaded":
      return `Version ${state.downloadedVersion ?? state.availableVersion ?? "update"} is ready to install.`;
    case "error":
      return state.message ?? "The updater ran into an error.";
    default:
      return "Updater status unavailable.";
  }
}

function getUpdateActionLabel(state: DesktopUpdateState | null): string {
  if (!state) return "Update";
  const action = resolveDesktopUpdateButtonAction(state);
  if (action === "download") return state.errorContext === "download" ? "Retry download" : "Download update";
  if (action === "install") return "Restart to install";
  return "Update";
}

export function SettingsView({ theme, onThemeChange, onBack, desktopReady }: Props) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!desktopReady) return;
    const desktop = window.texDesktop;
    if (!desktop) return;

    let cancelled = false;
    void desktop.getAppInfo().then((info) => {
      if (!cancelled) setAppInfo(info);
    });
    void desktop.getUpdateState().then((state) => {
      if (!cancelled) setUpdateState(state);
    });

    const unsubscribe = desktop.onUpdateState((state) => {
      if (!cancelled) setUpdateState(state);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [desktopReady]);

  const currentVersion = updateState?.currentVersion ?? appInfo?.version ?? "unknown";
  const selectedUpdateChannel = updateState?.channel ?? "latest";
  const updateAction = updateState ? resolveDesktopUpdateButtonAction(updateState) : "none";
  const canRunCheck = canCheckForUpdate(updateState);
  const updateTooltip = updateState ? getDesktopUpdateButtonTooltip(updateState) : null;
  const showUpdateAction = updateAction !== "none" || updateState?.status === "downloading";
  const updateActionDisabled = updateBusy || updateState?.status === "downloading";

  const handleUpdateChannelChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const channel = event.target.value as DesktopUpdateChannel;
      const desktop = window.texDesktop;
      if (!desktop) return;

      setUpdateBusy(true);
      setUpdateFeedback(null);
      try {
        const nextState = await desktop.setUpdateChannel(channel);
        setUpdateState(nextState);
      } catch (error) {
        setUpdateFeedback(error instanceof Error ? error.message : "Could not change update track.");
      } finally {
        setUpdateBusy(false);
      }
    },
    []
  );

  const handleCheckForUpdates = useCallback(async () => {
    const desktop = window.texDesktop;
    if (!desktop) return;

    setUpdateBusy(true);
    setUpdateFeedback(null);
    try {
      const result = await desktop.checkForUpdate();
      setUpdateState(result.state);
      if (!result.checked && !result.state.enabled) {
        setUpdateFeedback(result.state.message ?? "Automatic updates are not available.");
      }
    } catch (error) {
      setUpdateFeedback(error instanceof Error ? error.message : "Could not check for updates.");
    } finally {
      setUpdateBusy(false);
    }
  }, []);

  const handleRunUpdateAction = useCallback(async () => {
    const desktop = window.texDesktop;
    if (!desktop || !updateState) return;

    setUpdateBusy(true);
    setUpdateFeedback(null);
    try {
      if (updateAction === "download") {
        const result = await desktop.downloadUpdate();
        setUpdateState(result.state);
        const error = getDesktopUpdateActionError(result);
        if (error) {
          setUpdateFeedback(error);
        }
        return;
      }

      if (updateAction === "install") {
        const accepted = window.confirm(getDesktopUpdateInstallConfirmationMessage(updateState));
        if (!accepted) return;

        const result = await desktop.installUpdate();
        setUpdateState(result.state);
        const error = getDesktopUpdateActionError(result);
        if (error) {
          setUpdateFeedback(error);
        }
      }
    } catch (error) {
      setUpdateFeedback(error instanceof Error ? error.message : "Could not complete the update action.");
    } finally {
      setUpdateBusy(false);
    }
  }, [updateAction, updateState]);

  const updateHint = useMemo(() => formatUpdateStatus(updateState), [updateState]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-8 py-5">
        <button
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">Settings</span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-8 pb-16">
        <div className="pt-8 pb-10">
          <h1 className="font-serif text-3xl tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalize your writing environment.</p>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-medium tracking-wide uppercase text-muted-foreground">Appearance</h2>
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-2">
            {options.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onThemeChange(opt.value)}
                  className={`flex flex-col items-start gap-2 rounded-md p-4 text-left transition ${
                    active ? "bg-accent ring-1 ring-foreground/20" : "hover:bg-accent/60"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Updates</h2>
            <span className="text-xs text-muted-foreground">Tex {currentVersion}</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            {!desktopReady ? (
              <p className="text-sm text-muted-foreground">Desktop updates are only available inside the Electron app.</p>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Rocket className="size-4 text-muted-foreground" />
                      Update channel
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stable follows GitHub releases. Nightly follows prerelease builds.
                    </p>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Track</span>
                    <select
                      value={selectedUpdateChannel}
                      onChange={handleUpdateChannelChange}
                      disabled={updateBusy || updateState?.status === "downloading"}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="latest">Latest</option>
                      <option value="nightly">Nightly</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 rounded-md border border-border/80 bg-background/80 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-medium">{updateHint}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {updateState?.checkedAt
                          ? `Last checked ${new Date(updateState.checkedAt).toLocaleString()}`
                          : "No update check has run yet in this session."}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleCheckForUpdates}
                        disabled={!canRunCheck || updateBusy}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw className={`size-4 ${updateBusy && canRunCheck ? "animate-spin" : ""}`} />
                        Check for updates
                      </button>
                      {showUpdateAction ? (
                        <button
                          onClick={handleRunUpdateAction}
                          disabled={updateActionDisabled || updateAction === "none"}
                          title={updateTooltip ?? undefined}
                          className="rounded-md bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {getUpdateActionLabel(updateState)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {updateState?.hostArch === "arm64" && updateState.appArch === "x64" ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    This Mac is running the Intel build under Rosetta. The next successful update should switch the app to a native Apple Silicon build.
                  </p>
                ) : null}

                {updateFeedback ? (
                  <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{updateFeedback}</p>
                ) : null}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
