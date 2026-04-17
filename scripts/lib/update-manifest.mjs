export function parseUpdateManifest(raw, sourcePath, platformLabel) {
  const lines = raw.split(/\r?\n/);
  const files = [];
  const extras = {};
  let version = null;
  let releaseDate = null;
  let inFiles = false;
  let currentFile = null;

  const finalizeCurrentFile = (lineNumber) => {
    if (currentFile === null) return;
    if (
      typeof currentFile.url !== "string" ||
      typeof currentFile.sha512 !== "string" ||
      typeof currentFile.size !== "number"
    ) {
      throw new Error(
        `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: incomplete file entry.`
      );
    }
    files.push(currentFile);
    currentFile = null;
  };

  const parseScalarValue = (rawValue) => {
    const trimmed = rawValue.trim();
    const isQuoted = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2;
    const value = isQuoted ? trimmed.slice(1, -1).replace(/''/g, "'") : trimmed;
    if (isQuoted) return value;
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    return value;
  };

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    if (line.length === 0) continue;

    const fileUrlMatch = line.match(/^  - url:\s*(.+)$/);
    if (fileUrlMatch?.[1]) {
      finalizeCurrentFile(lineNumber);
      currentFile = {
        url: fileUrlMatch[1].trim().replace(/^'|'$/g, ""),
      };
      inFiles = true;
      continue;
    }

    const fileShaMatch = line.match(/^    sha512:\s*(.+)$/);
    if (fileShaMatch?.[1]) {
      if (currentFile === null) {
        throw new Error(
          `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: sha512 without a file entry.`
        );
      }
      currentFile.sha512 = fileShaMatch[1].trim();
      continue;
    }

    const fileSizeMatch = line.match(/^    size:\s*(\d+)$/);
    if (fileSizeMatch?.[1]) {
      if (currentFile === null) {
        throw new Error(
          `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: size without a file entry.`
        );
      }
      currentFile.size = Number(fileSizeMatch[1]);
      continue;
    }

    if (line === "files:") {
      inFiles = true;
      continue;
    }

    if (inFiles && currentFile !== null) {
      finalizeCurrentFile(lineNumber);
    }
    inFiles = false;

    const topLevelMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.+)$/);
    if (!topLevelMatch?.[1] || topLevelMatch[2] === undefined) {
      throw new Error(
        `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: unsupported line '${line}'.`
      );
    }

    const [, key, rawValue] = topLevelMatch;
    const value = parseScalarValue(rawValue);

    if (key === "version") {
      if (typeof value !== "string") {
        throw new Error(
          `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: version must be a string.`
        );
      }
      version = value;
      continue;
    }

    if (key === "releaseDate") {
      if (typeof value !== "string") {
        throw new Error(
          `Invalid ${platformLabel} update manifest at ${sourcePath}:${lineNumber}: releaseDate must be a string.`
        );
      }
      releaseDate = value;
      continue;
    }

    if (key === "path" || key === "sha512") {
      continue;
    }

    extras[key] = value;
  }

  finalizeCurrentFile(lines.length);

  if (!version) {
    throw new Error(`Invalid ${platformLabel} update manifest at ${sourcePath}: missing version.`);
  }
  if (!releaseDate) {
    throw new Error(
      `Invalid ${platformLabel} update manifest at ${sourcePath}: missing releaseDate.`
    );
  }
  if (files.length === 0) {
    throw new Error(`Invalid ${platformLabel} update manifest at ${sourcePath}: missing files.`);
  }

  return {
    version,
    releaseDate,
    files,
    extras
  };
}

export function mergeUpdateManifests(primary, secondary, platformLabel) {
  if (primary.version !== secondary.version) {
    throw new Error(
      `Cannot merge ${platformLabel} update manifests with different versions (${primary.version} vs ${secondary.version}).`
    );
  }

  const filesByUrl = new Map();
  for (const file of [...primary.files, ...secondary.files]) {
    const existing = filesByUrl.get(file.url);
    if (existing && (existing.sha512 !== file.sha512 || existing.size !== file.size)) {
      throw new Error(
        `Cannot merge ${platformLabel} update manifests: conflicting file entry for ${file.url}.`
      );
    }
    filesByUrl.set(file.url, file);
  }

  const extras = { ...primary.extras };
  for (const [key, value] of Object.entries(secondary.extras)) {
    const existing = extras[key];
    if (existing !== undefined && existing !== value) {
      throw new Error(
        `Cannot merge ${platformLabel} update manifests: conflicting '${key}' values.`
      );
    }
    extras[key] = value;
  }

  return {
    version: primary.version,
    releaseDate:
      primary.releaseDate >= secondary.releaseDate ? primary.releaseDate : secondary.releaseDate,
    files: [...filesByUrl.values()],
    extras
  };
}

function quoteYamlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function serializeUpdateManifest(manifest) {
  const lines = [`version: ${quoteYamlString(manifest.version)}`, "files:"];

  for (const file of manifest.files) {
    lines.push(`  - url: ${file.url}`);
    lines.push(`    sha512: ${file.sha512}`);
    lines.push(`    size: ${file.size}`);
  }

  for (const [key, value] of Object.entries(manifest.extras)) {
    lines.push(
      `${key}: ${typeof value === "string" ? quoteYamlString(value) : String(value)}`
    );
  }
  lines.push(`releaseDate: ${quoteYamlString(manifest.releaseDate)}`);
  lines.push("");

  return lines.join("\n");
}
