'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const tar = require('tar');

const InventoryFormat = Object.freeze({
  V1: 'lobsterai.windows-install-inventory.v1',
});

const InventoryEvidenceKind = Object.freeze({
  PackagedTree: 'packaged-tree-evidence',
});

const InventoryAuthorizationKind = Object.freeze({
  BuildEvidenceOnly: 'build-evidence-only',
});

const InventoryArchitecture = Object.freeze({
  X64: 'x64',
});

const InventoryScope = Object.freeze({
  AllUsers: 'allUsers',
  CurrentUser: 'currentUser',
});

const InventoryEntryType = Object.freeze({
  Directory: 'directory',
  File: 'file',
});

const InventoryPresence = Object.freeze({
  Optional: 'optional',
  Required: 'required',
});

const InventoryOwnershipClass = Object.freeze({
  InstallerGenerated: 'installer-generated',
  Packaged: 'packaged',
});

const InventoryContentPolicy = Object.freeze({
  ExactSchema: 'exact-schema',
  ImmutableHash: 'immutable-hash',
  PreserveOnly: 'preserve-only',
  ReplaceableByPath: 'replaceable-by-path',
  TrustedOutputDigestSet: 'trusted-output-digest-set',
});

const InventoryWriter = Object.freeze({
  InstallerOrAppRecovery: 'installer-or-app-recovery',
  Nsis: 'electron-builder-nsis',
  Package: 'package',
});

const INVENTORY_SCOPES = Object.freeze([
  InventoryScope.AllUsers,
  InventoryScope.CurrentUser,
]);
const DEFAULT_MAX_ENTRIES = 50_000;
const DEFAULT_MAX_MATERIALIZED_BYTES = 4 * 1024 * 1024 * 1024;
const MAIN_EXECUTABLE_PATH = 'LobsterAI.exe';
const APP_ASAR_PATH = 'resources/app.asar';
const RESOURCE_EXTRACTION_MARKER_PATH = 'resources/.win-resources-extracted';
const RESOURCE_EXTRACTION_MARKER_SCHEMA = 'win-resources-extracted-v1';
const UNINSTALLER_PATH = 'Uninstall LobsterAI.exe';
const PACKAGED_IMMUTABLE_PATHS = Object.freeze([
  MAIN_EXECUTABLE_PATH,
  APP_ASAR_PATH,
  'resources/unpack-cfmind.cjs',
  'resources/win-resources.tar',
]);
const REQUIRED_PACKAGED_PATHS = Object.freeze([
  MAIN_EXECUTABLE_PATH,
  APP_ASAR_PATH,
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^[0-9]+(?:\.[0-9]+){2}(?:[-+][0-9A-Za-z.-]+)?$/;
const PRINTABLE_ASCII_PATH_PATTERN = /^[\x20-\x7e]+$/;
const INVALID_WINDOWS_PATH_CHARACTER_PATTERN = /[\u0000-\u001f<>:"|?*]/;
const WINDOWS_RESERVED_BASENAME_PATTERN =
  /^(?:aux|clock\$|com[1-9]|con|conin\$|conout\$|lpt[1-9]|nul|prn)(?:\.|$)/i;
const X64_PE_MACHINE = 0x8664;
const PE32_MACHINE = 0x014c;

// A PE certificate-table entry is structural evidence only. This tool does
// not call WinVerifyTrust, validate Authenticode, or authenticate a publisher.
// Destructive authorization must additionally come from a trusted candidate
// installer that embeds the exact generated inventory.

const fail = (message) => {
  throw new Error(`[WindowsInstallInventory] ${message}`);
};

const isPlainObject = (value) =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (
    Object.getPrototypeOf(value) === Object.prototype
    || Object.getPrototypeOf(value) === null
  );

const assertPlainObject = (value, label) => {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object`);
  }
};

const assertExactKeys = (value, allowedKeys, label) => {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      fail(`${label} contains unknown field "${key}"`);
    }
  }
};

const assertNonEmptyString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
};

const assertSha256 = (value, label) => {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
};

const compareCanonicalStrings = (left, right) => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const canonicalizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  // A null-prototype result preserves JSON keys such as "__proto__" as
  // auditable data instead of invoking Object.prototype's legacy setter.
  const result = Object.create(null);
  for (const key of Object.keys(value).sort(compareCanonicalStrings)) {
    result[key] = canonicalizeValue(value[key]);
  }
  return result;
};

const canonicalStringify = (value) =>
  `${JSON.stringify(canonicalizeValue(value), null, 2)}\n`;

const digestCanonicalValue = (value) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalizeValue(value)))
    .digest('hex');

const hashFile = (filePath) => {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(filePath, 'r');
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
};

const normalizeInventoryPath = (value, label = 'entry.path') => {
  assertNonEmptyString(value, label);
  if (value !== value.normalize('NFC')) {
    fail(`${label} must use NFC Unicode normalization`);
  }
  if (
    value.includes('\\')
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:/.test(value)
  ) {
    fail(`${label} must be a canonical relative path`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`${label} must not contain empty, "." or ".." segments`);
  }
  if (!PRINTABLE_ASCII_PATH_PATTERN.test(value)) {
    fail(`${label} must use printable ASCII in inventory format v1`);
  }
  for (const segment of segments) {
    if (INVALID_WINDOWS_PATH_CHARACTER_PATTERN.test(segment)) {
      fail(`${label} contains a Win32-forbidden character or ADS separator`);
    }
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      fail(`${label} contains a Win32-normalized trailing dot or space`);
    }
    if (WINDOWS_RESERVED_BASENAME_PATTERN.test(segment)) {
      fail(`${label} contains reserved Windows device name "${segment}"`);
    }
    if (segment.length > 255) {
      fail(`${label} contains a component longer than 255 UTF-16 code units`);
    }
  }
  return value;
};

const foldInventoryPath = (value) => value.normalize('NFC').toLowerCase();

const sortEntries = (entries) =>
  [...entries].sort((left, right) => {
    const folded = compareCanonicalStrings(
      foldInventoryPath(left.path),
      foldInventoryPath(right.path),
    );
    return folded || compareCanonicalStrings(left.path, right.path);
  });

const validateScopes = (scopes, label) => {
  if (
    !Array.isArray(scopes)
    || scopes.length !== INVENTORY_SCOPES.length
    || scopes.some((scope, index) => scope !== INVENTORY_SCOPES[index])
  ) {
    fail(`${label} must contain canonical scopes: ${INVENTORY_SCOPES.join(', ')}`);
  }
};

const validateVersion = (version, label = 'version') => {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    fail(`${label} must be an explicit dotted version`);
  }
};

const validateEntrySchema = (entry, { version }) => {
  assertPlainObject(entry, 'entry');
  assertExactKeys(
    entry,
    new Set([
      'contentPolicy',
      'maxBytes',
      'ownershipClass',
      'path',
      'presence',
      'schemaId',
      'scopes',
      'sha256',
      'trustedSha256',
      'type',
      'versionRange',
      'writer',
    ]),
    `entry ${entry.path ?? '(missing path)'}`,
  );

  normalizeInventoryPath(entry.path);
  if (!Object.values(InventoryEntryType).includes(entry.type)) {
    fail(`entry "${entry.path}" has unsupported type "${entry.type}"`);
  }
  if (!Object.values(InventoryPresence).includes(entry.presence)) {
    fail(`entry "${entry.path}" has invalid presence`);
  }
  if (!Object.values(InventoryOwnershipClass).includes(entry.ownershipClass)) {
    fail(`entry "${entry.path}" has invalid ownershipClass`);
  }
  if (!Object.values(InventoryContentPolicy).includes(entry.contentPolicy)) {
    fail(`entry "${entry.path}" has invalid contentPolicy`);
  }
  assertNonEmptyString(entry.writer, `entry "${entry.path}".writer`);
  validateScopes(entry.scopes, `entry "${entry.path}".scopes`);

  assertPlainObject(entry.versionRange, `entry "${entry.path}".versionRange`);
  assertExactKeys(
    entry.versionRange,
    new Set(['maxInclusive', 'minInclusive']),
    `entry "${entry.path}".versionRange`,
  );
  if (
    entry.versionRange.minInclusive !== version
    || entry.versionRange.maxInclusive !== version
  ) {
    fail(`entry "${entry.path}" must be bound to version ${version}`);
  }

  const bytePolicy = [
    InventoryContentPolicy.ExactSchema,
    InventoryContentPolicy.ImmutableHash,
    InventoryContentPolicy.TrustedOutputDigestSet,
  ].includes(entry.contentPolicy);
  if (bytePolicy && entry.type !== InventoryEntryType.File) {
    fail(`entry "${entry.path}" uses a byte policy on a non-file`);
  }

  if (entry.contentPolicy === InventoryContentPolicy.ImmutableHash) {
    assertSha256(entry.sha256, `entry "${entry.path}".sha256`);
    if (entry.trustedSha256 !== undefined || entry.schemaId !== undefined || entry.maxBytes !== undefined) {
      fail(`entry "${entry.path}" mixes immutable-hash with another policy field`);
    }
  } else if (entry.contentPolicy === InventoryContentPolicy.TrustedOutputDigestSet) {
    if (!Array.isArray(entry.trustedSha256) || entry.trustedSha256.length === 0) {
      fail(`entry "${entry.path}".trustedSha256 must be a non-empty digest set`);
    }
    const sortedDigests = [...entry.trustedSha256].sort(compareCanonicalStrings);
    if (
      new Set(entry.trustedSha256).size !== entry.trustedSha256.length
      || sortedDigests.some((digest, index) => digest !== entry.trustedSha256[index])
    ) {
      fail(`entry "${entry.path}".trustedSha256 must be sorted and unique`);
    }
    entry.trustedSha256.forEach((digest, index) =>
      assertSha256(digest, `entry "${entry.path}".trustedSha256[${index}]`));
    if (entry.sha256 !== undefined || entry.schemaId !== undefined || entry.maxBytes !== undefined) {
      fail(`entry "${entry.path}" mixes trusted-output-digest-set with another policy field`);
    }
  } else if (entry.contentPolicy === InventoryContentPolicy.ExactSchema) {
    assertNonEmptyString(entry.schemaId, `entry "${entry.path}".schemaId`);
    if (!Number.isSafeInteger(entry.maxBytes) || entry.maxBytes <= 0) {
      fail(`entry "${entry.path}".maxBytes must be a positive safe integer`);
    }
    if (entry.sha256 !== undefined || entry.trustedSha256 !== undefined) {
      fail(`entry "${entry.path}" mixes exact-schema with another policy field`);
    }
  } else if (
    entry.sha256 !== undefined
    || entry.trustedSha256 !== undefined
    || entry.schemaId !== undefined
    || entry.maxBytes !== undefined
  ) {
    fail(`entry "${entry.path}" carries fields that do not belong to ${entry.contentPolicy}`);
  }
};

const validateEntryCollectionSchema = (
  entries,
  { version, maxEntries = DEFAULT_MAX_ENTRIES } = {},
) => {
  validateVersion(version);
  if (!Array.isArray(entries)) {
    fail('tree.entries must be an array');
  }
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
    fail('maxEntries must be a positive safe integer');
  }
  if (entries.length > maxEntries) {
    fail(`tree.entries exceeds the ${maxEntries} entry budget`);
  }

  const exactPaths = new Set();
  const foldedPaths = new Map();
  for (const entry of entries) {
    validateEntrySchema(entry, { version });
    if (exactPaths.has(entry.path)) {
      fail(`duplicate inventory path "${entry.path}"`);
    }
    exactPaths.add(entry.path);

    const foldedPath = foldInventoryPath(entry.path);
    const previous = foldedPaths.get(foldedPath);
    if (previous !== undefined) {
      fail(`case-fold collision between "${previous}" and "${entry.path}"`);
    }
    foldedPaths.set(foldedPath, entry.path);
  }
  return entries.length;
};

const validatePackagedEvidenceEntry = (entry) => {
  if (entry.path === RESOURCE_EXTRACTION_MARKER_PATH) {
    if (
      entry.contentPolicy !== InventoryContentPolicy.ExactSchema
      || entry.maxBytes !== 256
      || entry.ownershipClass !== InventoryOwnershipClass.InstallerGenerated
      || entry.presence !== InventoryPresence.Optional
      || entry.schemaId !== RESOURCE_EXTRACTION_MARKER_SCHEMA
      || entry.type !== InventoryEntryType.File
      || entry.writer !== InventoryWriter.InstallerOrAppRecovery
    ) {
      fail(`packaged-tree evidence has an invalid ${RESOURCE_EXTRACTION_MARKER_PATH} rule`);
    }
    return;
  }

  if (entry.path === UNINSTALLER_PATH) {
    if (
      entry.contentPolicy !== InventoryContentPolicy.ImmutableHash
      || entry.ownershipClass !== InventoryOwnershipClass.InstallerGenerated
      || entry.presence !== InventoryPresence.Optional
      || entry.type !== InventoryEntryType.File
      || entry.writer !== InventoryWriter.Nsis
    ) {
      fail(`packaged-tree evidence has an invalid ${UNINSTALLER_PATH} rule`);
    }
    return;
  }

  if (
    entry.ownershipClass !== InventoryOwnershipClass.Packaged
    || entry.writer !== InventoryWriter.Package
  ) {
    fail(`packaged-tree evidence entry "${entry.path}" must be package-owned`);
  }

  const mustUseImmutableHash = PACKAGED_IMMUTABLE_PATHS.includes(entry.path);
  const expectedPolicy = mustUseImmutableHash
    ? InventoryContentPolicy.ImmutableHash
    : InventoryContentPolicy.ReplaceableByPath;
  if (entry.contentPolicy !== expectedPolicy) {
    fail(
      `packaged-tree evidence entry "${entry.path}" must use ${expectedPolicy}`,
    );
  }
  if (mustUseImmutableHash && entry.type !== InventoryEntryType.File) {
    fail(`packaged-tree evidence entry "${entry.path}" must be a file`);
  }

  const expectedPresence = REQUIRED_PACKAGED_PATHS.includes(entry.path)
    ? InventoryPresence.Required
    : InventoryPresence.Optional;
  if (entry.presence !== expectedPresence) {
    fail(
      `packaged-tree evidence entry "${entry.path}" must be ${expectedPresence}`,
    );
  }
};

const readPeMetadata = (filePath) => {
  const fileSize = fs.statSync(filePath).size;
  const fd = fs.openSync(filePath, 'r');
  try {
    const dosHeader = Buffer.alloc(64);
    if (fs.readSync(fd, dosHeader, 0, dosHeader.length, 0) !== dosHeader.length) {
      fail(`${filePath} is a truncated PE file`);
    }
    if (dosHeader.toString('latin1', 0, 2) !== 'MZ') {
      fail(`${filePath} is not a PE file`);
    }

    const peOffset = dosHeader.readUInt32LE(0x3c);
    const coffHeader = Buffer.alloc(24);
    if (fs.readSync(fd, coffHeader, 0, coffHeader.length, peOffset) !== coffHeader.length) {
      fail(`${filePath} has a truncated COFF header`);
    }
    if (coffHeader.toString('latin1', 0, 4) !== 'PE\0\0') {
      fail(`${filePath} has no PE signature`);
    }

    const machineCode = coffHeader.readUInt16LE(4);
    const optionalHeaderSize = coffHeader.readUInt16LE(20);
    const optionalHeader = Buffer.alloc(optionalHeaderSize);
    if (
      optionalHeaderSize < 136
      || fs.readSync(fd, optionalHeader, 0, optionalHeader.length, peOffset + 24)
        !== optionalHeader.length
    ) {
      fail(`${filePath} has a truncated optional header`);
    }

    const magic = optionalHeader.readUInt16LE(0);
    const dataDirectoryOffset = magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1;
    if (dataDirectoryOffset < 0 || dataDirectoryOffset + 40 > optionalHeader.length) {
      fail(`${filePath} has an unsupported PE optional header`);
    }

    const certificateOffset = optionalHeader.readUInt32LE(dataDirectoryOffset + 32);
    const certificateSize = optionalHeader.readUInt32LE(dataDirectoryOffset + 36);
    const hasCertificateTable = certificateOffset > 0 && certificateSize > 0;
    if (hasCertificateTable && certificateOffset + certificateSize > fileSize) {
      fail(`${filePath} has an invalid PE certificate table`);
    }

    return {
      hasCertificateTable,
      machine: machineCode === X64_PE_MACHINE
        ? InventoryArchitecture.X64
        : machineCode === PE32_MACHINE
          ? 'x86'
          : 'unknown',
      machineCode: `0x${machineCode.toString(16).padStart(4, '0')}`,
    };
  } finally {
    fs.closeSync(fd);
  }
};

const assertRegularFile = (filePath, label) => {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    fail(`${label} must be a regular file, not a link/reparse-like entry`);
  }
};

const makeVersionRange = (version) => ({
  maxInclusive: version,
  minInclusive: version,
});

const classifyPath = (relativePath, type, version) => {
  const base = {
    contentPolicy: InventoryContentPolicy.ReplaceableByPath,
    ownershipClass: InventoryOwnershipClass.Packaged,
    path: relativePath,
    presence: InventoryPresence.Optional,
    scopes: [...INVENTORY_SCOPES],
    type,
    versionRange: makeVersionRange(version),
    writer: InventoryWriter.Package,
  };

  if (
    type === InventoryEntryType.File
    && PACKAGED_IMMUTABLE_PATHS.includes(relativePath)
  ) {
    return {
      ...base,
      contentPolicy: InventoryContentPolicy.ImmutableHash,
      presence: REQUIRED_PACKAGED_PATHS.includes(relativePath)
        ? InventoryPresence.Required
        : InventoryPresence.Optional,
    };
  }
  return base;
};

const collectAppTreeEntries = (appTreePath, version) => {
  const rootStat = fs.lstatSync(appTreePath);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail('app tree must be a real directory, not a link/reparse-like entry');
  }

  const entries = [];
  const pending = [{ absolutePath: appTreePath, relativePath: '' }];
  while (pending.length > 0) {
    const current = pending.pop();
    const children = fs.readdirSync(current.absolutePath, { withFileTypes: true })
      .sort((left, right) => compareCanonicalStrings(left.name, right.name));
    for (const child of children) {
      const absolutePath = path.join(current.absolutePath, child.name);
      const relativePath = current.relativePath
        ? `${current.relativePath}/${child.name}`
        : child.name;
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
        fail(`app tree entry "${relativePath}" is a link/reparse-like or unsupported type`);
      }

      const type = stat.isDirectory()
        ? InventoryEntryType.Directory
        : InventoryEntryType.File;
      const entry = classifyPath(relativePath, type, version);
      if (entry.contentPolicy === InventoryContentPolicy.ImmutableHash) {
        entry.sha256 = hashFile(absolutePath);
      }
      entries.push(entry);
      if (stat.isDirectory()) {
        pending.push({ absolutePath, relativePath });
      }
    }
  }
  return entries;
};

const collectResourcesTarEntries = (
  resourcesTarPath,
  version,
  { maxMaterializedBytes = DEFAULT_MAX_MATERIALIZED_BYTES } = {},
) => {
  assertRegularFile(resourcesTarPath, 'resources tar');
  if (
    !Number.isSafeInteger(maxMaterializedBytes)
    || maxMaterializedBytes <= 0
  ) {
    fail('maxMaterializedBytes must be a positive safe integer');
  }
  const archiveEntries = new Map();
  const foldedArchivePaths = new Map();
  let materializedBytes = 0;
  try {
    tar.list({
      file: resourcesTarPath,
      onwarn: (code, message) => {
        fail(`resources tar warning ${code}: ${message}`);
      },
      strict: true,
      sync: true,
      onentry: (entry) => {
        const archivedPath = String(entry.path ?? '');
        const rawPath = archivedPath.replace(/\/+$/, '');
        const relativePath = normalizeInventoryPath(rawPath, 'resources tar entry path');
        if (
          entry.invalid
          || entry.unsupported
          || entry.meta
          || entry.extended !== undefined
          || entry.globalExtended !== undefined
          || entry.linkpath !== undefined
          || !['Directory', 'File'].includes(entry.type)
        ) {
          fail(
            `resources tar entry "${relativePath}" is a link/reparse-like or unsupported type`,
          );
        }
        if (
          (entry.type === 'File' && archivedPath.endsWith('/'))
          || (entry.type === 'Directory' && entry.size !== 0)
        ) {
          fail(`resources tar entry "${relativePath}" has inconsistent type metadata`);
        }
        if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
          fail(`resources tar entry "${relativePath}" has an invalid size`);
        }
        materializedBytes += entry.size;
        if (
          !Number.isSafeInteger(materializedBytes)
          || materializedBytes > maxMaterializedBytes
        ) {
          fail(
            `resources tar exceeds the ${maxMaterializedBytes} materialized-byte budget`,
          );
        }
        if (archiveEntries.has(relativePath)) {
          fail(`resources tar contains duplicate path "${relativePath}"`);
        }
        const foldedPath = foldInventoryPath(relativePath);
        const previous = foldedArchivePaths.get(foldedPath);
        if (previous !== undefined) {
          fail(
            `resources tar case-fold collision between "${previous}" and "${relativePath}"`,
          );
        }
        archiveEntries.set(
          relativePath,
          entry.type === 'Directory'
            ? InventoryEntryType.Directory
            : InventoryEntryType.File,
        );
        foldedArchivePaths.set(foldedPath, relativePath);
      },
    });
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith('[WindowsInstallInventory]')
    ) {
      throw error;
    }
    fail(
      `unable to enumerate resources tar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const materializedEntries = new Map();
  const addMaterializedEntry = (relativePath, type) => {
    const existingType = materializedEntries.get(relativePath);
    if (existingType !== undefined && existingType !== type) {
      fail(`resources tar path "${relativePath}" has conflicting entry types`);
    }
    materializedEntries.set(relativePath, type);
  };

  for (const [archivePath, type] of archiveEntries) {
    const segments = archivePath.split('/');
    for (let index = 1; index < segments.length; index += 1) {
      const ancestor = segments.slice(0, index).join('/');
      const explicitAncestorType = archiveEntries.get(ancestor);
      if (explicitAncestorType === InventoryEntryType.File) {
        fail(`resources tar file "${ancestor}" is an ancestor of another entry`);
      }
      addMaterializedEntry(ancestor, InventoryEntryType.Directory);
    }
    addMaterializedEntry(archivePath, type);
  }

  return [...materializedEntries].map(([relativePath, type]) =>
    classifyPath(`resources/${relativePath}`, type, version));
};

const buildSelectorKey = ({ version, architecture, scope }) =>
  `${version}|${architecture}|${scope}`;

const generateInventory = ({
  appTreePath,
  architecture,
  provenance,
  resourcesTarPath,
  uninstallerPath,
  version,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxMaterializedBytes = DEFAULT_MAX_MATERIALIZED_BYTES,
}) => {
  validateVersion(version);
  if (architecture !== InventoryArchitecture.X64) {
    fail('only explicit x64 inventory generation is supported');
  }
  assertRegularFile(uninstallerPath, 'uninstaller candidate');

  const executablePath = path.join(appTreePath, ...MAIN_EXECUTABLE_PATH.split('/'));
  const appAsarPath = path.join(appTreePath, ...APP_ASAR_PATH.split('/'));
  assertRegularFile(executablePath, MAIN_EXECUTABLE_PATH);
  assertRegularFile(appAsarPath, APP_ASAR_PATH);

  const executablePe = readPeMetadata(executablePath);
  if (executablePe.machine !== InventoryArchitecture.X64) {
    fail(`${MAIN_EXECUTABLE_PATH} must be a PE x64 executable`);
  }
  if (!executablePe.hasCertificateTable) {
    fail(`${MAIN_EXECUTABLE_PATH} has no PE certificate table`);
  }
  const uninstallerPe = readPeMetadata(uninstallerPath);
  if (!['x64', 'x86'].includes(uninstallerPe.machine)) {
    fail('uninstaller candidate must be a PE x64 or x86 executable');
  }
  if (!uninstallerPe.hasCertificateTable) {
    fail('uninstaller candidate has no PE certificate table');
  }

  const entries = collectAppTreeEntries(appTreePath, version);
  const packagedTarEntry = entries.find(
    (entry) => entry.path === 'resources/win-resources.tar',
  );
  if (!packagedTarEntry || packagedTarEntry.type !== InventoryEntryType.File) {
    fail('app tree must contain resources/win-resources.tar');
  }
  assertRegularFile(resourcesTarPath, 'resources tar');
  if (packagedTarEntry.sha256 !== hashFile(resourcesTarPath)) {
    fail('explicit resources tar does not match app-tree resources/win-resources.tar');
  }
  entries.push(
    ...collectResourcesTarEntries(resourcesTarPath, version, {
      maxMaterializedBytes,
    }),
  );
  entries.push({
    contentPolicy: InventoryContentPolicy.ExactSchema,
    maxBytes: 256,
    ownershipClass: InventoryOwnershipClass.InstallerGenerated,
    path: RESOURCE_EXTRACTION_MARKER_PATH,
    presence: InventoryPresence.Optional,
    schemaId: RESOURCE_EXTRACTION_MARKER_SCHEMA,
    scopes: [...INVENTORY_SCOPES],
    type: InventoryEntryType.File,
    versionRange: makeVersionRange(version),
    writer: InventoryWriter.InstallerOrAppRecovery,
  });
  entries.push({
    contentPolicy: InventoryContentPolicy.ImmutableHash,
    ownershipClass: InventoryOwnershipClass.InstallerGenerated,
    path: UNINSTALLER_PATH,
    presence: InventoryPresence.Optional,
    scopes: [...INVENTORY_SCOPES],
    sha256: hashFile(uninstallerPath),
    type: InventoryEntryType.File,
    versionRange: makeVersionRange(version),
    writer: InventoryWriter.Nsis,
  });
  const sortedEntries = sortEntries(entries);
  validateEntryCollectionSchema(sortedEntries, { version, maxEntries });

  const executableEntry = sortedEntries.find((entry) => entry.path === MAIN_EXECUTABLE_PATH);
  const appAsarEntry = sortedEntries.find((entry) => entry.path === APP_ASAR_PATH);
  if (!executableEntry || !appAsarEntry) {
    fail(`app tree must contain ${MAIN_EXECUTABLE_PATH} and ${APP_ASAR_PATH}`);
  }

  const treeDigest = digestCanonicalValue({
    architecture,
    entries: sortedEntries,
    version,
  });
  const sourceFootprint = {
    appAsar: {
      path: APP_ASAR_PATH,
      sha256: appAsarEntry.sha256,
    },
    executable: {
      hasPeCertificateTable: true,
      path: MAIN_EXECUTABLE_PATH,
      peMachine: executablePe.machine,
      peMachineCode: executablePe.machineCode,
      sha256: executableEntry.sha256,
    },
  };
  const selectors = INVENTORY_SCOPES.map((scope) => ({
    architecture,
    key: buildSelectorKey({ version, architecture, scope }),
    scope,
    sourceFootprint,
    treeDigest,
    version,
  }));

  const inventory = {
    architecture,
    authorization: {
      destructiveMutation: false,
      execution: false,
      kind: InventoryAuthorizationKind.BuildEvidenceOnly,
    },
    artifacts: {
      uninstallerCandidate: {
        hasPeCertificateTable: true,
        path: UNINSTALLER_PATH,
        peMachine: uninstallerPe.machine,
        peMachineCode: uninstallerPe.machineCode,
        sha256: hashFile(uninstallerPath),
      },
    },
    evidenceKind: InventoryEvidenceKind.PackagedTree,
    format: InventoryFormat.V1,
    scopes: [...INVENTORY_SCOPES],
    selectors,
    tree: {
      entryCount: sortedEntries.length,
      entries: sortedEntries,
      treeDigest,
    },
    version,
    ...(provenance === undefined ? {} : { provenance: canonicalizeValue(provenance) }),
  };

  validateInventory(inventory, { maxEntries });
  return canonicalizeValue(inventory);
};

const validateSourceFootprint = (footprint, label) => {
  assertPlainObject(footprint, label);
  assertExactKeys(footprint, new Set(['appAsar', 'executable']), label);
  assertPlainObject(footprint.executable, `${label}.executable`);
  assertExactKeys(
    footprint.executable,
    new Set([
      'hasPeCertificateTable',
      'path',
      'peMachine',
      'peMachineCode',
      'sha256',
    ]),
    `${label}.executable`,
  );
  if (
    footprint.executable.hasPeCertificateTable !== true
    || footprint.executable.path !== MAIN_EXECUTABLE_PATH
    || footprint.executable.peMachine !== InventoryArchitecture.X64
    || footprint.executable.peMachineCode !== '0x8664'
  ) {
    fail(`${label}.executable must bind the PE x64 ${MAIN_EXECUTABLE_PATH}`);
  }
  assertSha256(footprint.executable.sha256, `${label}.executable.sha256`);

  assertPlainObject(footprint.appAsar, `${label}.appAsar`);
  assertExactKeys(footprint.appAsar, new Set(['path', 'sha256']), `${label}.appAsar`);
  if (footprint.appAsar.path !== APP_ASAR_PATH) {
    fail(`${label}.appAsar must bind ${APP_ASAR_PATH}`);
  }
  assertSha256(footprint.appAsar.sha256, `${label}.appAsar.sha256`);
};

const validateInventory = (inventory, { maxEntries = DEFAULT_MAX_ENTRIES } = {}) => {
  assertPlainObject(inventory, 'inventory');
  assertExactKeys(
    inventory,
    new Set([
      'architecture',
      'authorization',
      'artifacts',
      'evidenceKind',
      'format',
      'provenance',
      'scopes',
      'selectors',
      'tree',
      'version',
    ]),
    'inventory',
  );
  if (inventory.format !== InventoryFormat.V1) {
    fail(`unsupported inventory format "${inventory.format}"`);
  }
  validateVersion(inventory.version);
  if (inventory.architecture !== InventoryArchitecture.X64) {
    fail('inventory architecture must be x64');
  }
  if (inventory.evidenceKind !== InventoryEvidenceKind.PackagedTree) {
    fail('inventory must be packaged-tree evidence');
  }
  assertPlainObject(inventory.authorization, 'inventory.authorization');
  assertExactKeys(
    inventory.authorization,
    new Set(['destructiveMutation', 'execution', 'kind']),
    'inventory.authorization',
  );
  if (
    inventory.authorization.kind !== InventoryAuthorizationKind.BuildEvidenceOnly
    || inventory.authorization.destructiveMutation !== false
    || inventory.authorization.execution !== false
  ) {
    fail('packaged-tree evidence must not grant execution or destructive mutation');
  }
  validateScopes(inventory.scopes, 'inventory.scopes');
  if (inventory.provenance !== undefined && !isPlainObject(inventory.provenance)) {
    fail('inventory.provenance must be an object');
  }

  assertPlainObject(inventory.tree, 'inventory.tree');
  assertExactKeys(
    inventory.tree,
    new Set(['entries', 'entryCount', 'treeDigest']),
    'inventory.tree',
  );
  validateEntryCollectionSchema(inventory.tree.entries, {
    maxEntries,
    version: inventory.version,
  });
  inventory.tree.entries.forEach(validatePackagedEvidenceEntry);
  if (inventory.tree.entryCount !== inventory.tree.entries.length) {
    fail('inventory.tree.entryCount does not match entries');
  }
  const sortedEntries = sortEntries(inventory.tree.entries);
  if (JSON.stringify(sortedEntries) !== JSON.stringify(inventory.tree.entries)) {
    fail('inventory.tree.entries must use canonical path ordering');
  }
  const expectedTreeDigest = digestCanonicalValue({
    architecture: inventory.architecture,
    entries: inventory.tree.entries,
    version: inventory.version,
  });
  if (inventory.tree.treeDigest !== expectedTreeDigest) {
    fail('inventory.tree.treeDigest does not match canonical tree content');
  }

  const executableEntry = inventory.tree.entries.find(
    (entry) => entry.path === MAIN_EXECUTABLE_PATH,
  );
  const appAsarEntry = inventory.tree.entries.find((entry) => entry.path === APP_ASAR_PATH);
  for (const requiredEvidencePath of [
    ...REQUIRED_PACKAGED_PATHS,
    'resources/win-resources.tar',
    RESOURCE_EXTRACTION_MARKER_PATH,
    UNINSTALLER_PATH,
  ]) {
    if (!inventory.tree.entries.some((entry) => entry.path === requiredEvidencePath)) {
      fail(`inventory is missing packaged evidence entry "${requiredEvidencePath}"`);
    }
  }
  if (
    !executableEntry
    || executableEntry.contentPolicy !== InventoryContentPolicy.ImmutableHash
    || executableEntry.presence !== InventoryPresence.Required
    || !appAsarEntry
    || appAsarEntry.contentPolicy !== InventoryContentPolicy.ImmutableHash
    || appAsarEntry.presence !== InventoryPresence.Required
  ) {
    fail('inventory is missing required immutable source-footprint entries');
  }

  if (!Array.isArray(inventory.selectors) || inventory.selectors.length !== 2) {
    fail('inventory must contain exactly two scope selectors');
  }
  const seenScopes = new Set();
  for (const selector of inventory.selectors) {
    assertPlainObject(selector, 'selector');
    assertExactKeys(
      selector,
      new Set([
        'architecture',
        'key',
        'scope',
        'sourceFootprint',
        'treeDigest',
        'version',
      ]),
      'selector',
    );
    if (!INVENTORY_SCOPES.includes(selector.scope) || seenScopes.has(selector.scope)) {
      fail(`selector has missing, duplicate or invalid scope "${selector.scope}"`);
    }
    seenScopes.add(selector.scope);
    if (
      selector.version !== inventory.version
      || selector.architecture !== inventory.architecture
      || selector.treeDigest !== inventory.tree.treeDigest
      || selector.key !== buildSelectorKey(selector)
    ) {
      fail(`selector "${selector.key}" is not exactly bound to its inventory tree`);
    }
    validateSourceFootprint(selector.sourceFootprint, `selector "${selector.key}".sourceFootprint`);
    if (
      selector.sourceFootprint.executable.sha256 !== executableEntry.sha256
      || selector.sourceFootprint.appAsar.sha256 !== appAsarEntry.sha256
    ) {
      fail(`selector "${selector.key}" source footprint does not match its tree`);
    }
  }
  if (
    inventory.selectors.some((selector, index) => selector.scope !== INVENTORY_SCOPES[index])
  ) {
    fail('inventory.selectors must use canonical scope ordering');
  }

  assertPlainObject(inventory.artifacts, 'inventory.artifacts');
  assertExactKeys(
    inventory.artifacts,
    new Set(['uninstallerCandidate']),
    'inventory.artifacts',
  );
  const uninstaller = inventory.artifacts.uninstallerCandidate;
  assertPlainObject(uninstaller, 'inventory.artifacts.uninstallerCandidate');
  assertExactKeys(
    uninstaller,
    new Set([
      'hasPeCertificateTable',
      'path',
      'peMachine',
      'peMachineCode',
      'sha256',
    ]),
    'inventory.artifacts.uninstallerCandidate',
  );
  if (
    uninstaller.path !== UNINSTALLER_PATH
    || uninstaller.hasPeCertificateTable !== true
    || (
      uninstaller.peMachine === InventoryArchitecture.X64
        ? uninstaller.peMachineCode !== '0x8664'
        : uninstaller.peMachine !== 'x86'
          || uninstaller.peMachineCode !== '0x014c'
    )
  ) {
    fail('uninstaller candidate artifact is not correctly bound');
  }
  assertSha256(
    uninstaller.sha256,
    'inventory.artifacts.uninstallerCandidate.sha256',
  );
  const uninstallerEntry = inventory.tree.entries.find(
    (entry) => entry.path === UNINSTALLER_PATH,
  );
  if (
    !uninstallerEntry
    || uninstallerEntry.contentPolicy !== InventoryContentPolicy.ImmutableHash
    || uninstallerEntry.sha256 !== uninstaller.sha256
  ) {
    fail('uninstaller candidate artifact does not match its immutable tree entry');
  }
  return inventory;
};

// Matches exact packaged evidence only. A match is not an execution, deletion,
// replacement, or rename capability; those require the missing runtime scope,
// lifecycle, snapshot and trusted-carrier evidence described by the spec.
const matchExactPackagedEvidence = (inventory, request) => {
  validateInventory(inventory);
  assertPlainObject(request, 'selector request');
  validateVersion(request.version, 'selector request.version');
  if (request.architecture !== InventoryArchitecture.X64) {
    fail('selector request.architecture must be x64');
  }
  if (!INVENTORY_SCOPES.includes(request.scope)) {
    fail('selector request.scope is required and must be exact');
  }
  assertSha256(request.executableSha256, 'selector request.executableSha256');
  assertSha256(request.appAsarSha256, 'selector request.appAsarSha256');
  if (request.peMachine !== InventoryArchitecture.X64) {
    fail('selector request.peMachine must be x64');
  }

  const key = buildSelectorKey(request);
  const selector = inventory.selectors.find((candidate) => candidate.key === key);
  if (!selector) {
    return null;
  }
  if (
    selector.sourceFootprint.executable.sha256 !== request.executableSha256
    || selector.sourceFootprint.appAsar.sha256 !== request.appAsarSha256
    || selector.sourceFootprint.executable.peMachine !== request.peMachine
  ) {
    return null;
  }
  return selector;
};

const parseCliOptions = (args, allowedOptions) => {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!allowedOptions.has(option) || value === undefined) {
      fail(`invalid CLI option "${option ?? ''}"`);
    }
    if (result[option] !== undefined) {
      fail(`duplicate CLI option "${option}"`);
    }
    result[option] = value;
  }
  return result;
};

const readOptionalProvenance = (filePath) => {
  if (filePath === undefined) return undefined;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!isPlainObject(parsed)) {
    fail('provenance JSON must be an object');
  }
  return parsed;
};

const printUsage = () => {
  process.stderr.write(
    'Usage:\n'
    + '  node scripts/windows-install-inventory.cjs generate '
    + '--version <version> --arch x64 --app-tree <dir> '
    + '--resources-tar <tar> --uninstaller <exe> '
    + '[--provenance <json>] [--output <json>]\n'
    + '  node scripts/windows-install-inventory.cjs validate --input <json>\n',
  );
};

const main = (argv = process.argv.slice(2)) => {
  const [command, ...args] = argv;
  if (command === 'generate') {
    const options = parseCliOptions(
      args,
      new Set([
        '--app-tree',
        '--arch',
        '--output',
        '--provenance',
        '--resources-tar',
        '--uninstaller',
        '--version',
      ]),
    );
    for (const required of [
      '--app-tree',
      '--arch',
      '--resources-tar',
      '--uninstaller',
      '--version',
    ]) {
      if (options[required] === undefined) {
        fail(`missing required CLI option "${required}"`);
      }
    }
    const inventory = generateInventory({
      appTreePath: path.resolve(options['--app-tree']),
      architecture: options['--arch'],
      provenance: readOptionalProvenance(options['--provenance']),
      resourcesTarPath: path.resolve(options['--resources-tar']),
      uninstallerPath: path.resolve(options['--uninstaller']),
      version: options['--version'],
    });
    const output = canonicalStringify(inventory);
    if (options['--output'] === undefined) {
      process.stdout.write(output);
    } else {
      const outputPath = path.resolve(options['--output']);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, output, 'utf8');
      process.stderr.write(`Generated canonical inventory: ${outputPath}\n`);
    }
    return;
  }

  if (command === 'validate') {
    const options = parseCliOptions(args, new Set(['--input']));
    if (options['--input'] === undefined) {
      fail('missing required CLI option "--input"');
    }
    const inputPath = path.resolve(options['--input']);
    const raw = fs.readFileSync(inputPath, 'utf8');
    const inventory = JSON.parse(raw);
    validateInventory(inventory);
    if (raw !== canonicalStringify(inventory)) {
      fail('inventory JSON is valid but not canonical');
    }
    process.stdout.write(`Valid canonical inventory: ${inputPath}\n`);
    return;
  }

  printUsage();
  fail(`unknown command "${command ?? ''}"`);
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  __testOnly: Object.freeze({
    collectResourcesTarEntries,
    normalizeInventoryPath,
    readPeMetadata,
    sortEntries,
    validateEntryCollectionSchema,
    validateEntrySchema,
  }),
  APP_ASAR_PATH,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_MATERIALIZED_BYTES,
  INVENTORY_SCOPES,
  InventoryArchitecture,
  InventoryAuthorizationKind,
  InventoryContentPolicy,
  InventoryEntryType,
  InventoryEvidenceKind,
  InventoryFormat,
  InventoryOwnershipClass,
  InventoryPresence,
  InventoryScope,
  InventoryWriter,
  MAIN_EXECUTABLE_PATH,
  RESOURCE_EXTRACTION_MARKER_PATH,
  UNINSTALLER_PATH,
  buildSelectorKey,
  canonicalStringify,
  generateInventory,
  matchExactPackagedEvidence,
  validateInventory,
};
