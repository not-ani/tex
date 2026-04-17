async function canReach(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

export async function waitForUrl(url, { timeoutMs = 60_000, intervalMs = 350 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for ${url}`);
}
