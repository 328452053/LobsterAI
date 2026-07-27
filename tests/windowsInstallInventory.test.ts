import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import * as tar from 'tar';
import { afterEach, describe, expect, test } from 'vitest';

interface InventoryEntry {
  contentPolicy: string;
  ownershipClass: string;
  path: string;
  presence: string;
  scopes: string[];
  maxBytes?: number;
  schemaId?: string;
  sha256?: string;
  type: string;
  versionRange: {
    maxInclusive: string;
    minInclusive: string;
  };
  writer: string;
}

interface InventorySelector {
  architecture: string;
  key: string;
  scope: string;
  sourceFootprint: {
    appAsar: {
      path: string;
      sha256: string;
    };
    executable: {
      hasPeCertificateTable: boolean;
      path: string;
      peMachine: string;
      peMachineCode: string;
      sha256: string;
    };
  };
  treeDigest: string;
  version: string;
}

interface Inventory {
  architecture: string;
  artifacts: {
    uninstallerCandidate: {
      hasPeCertificateTable: boolean;
      path: string;
      peMachine: string;
      peMachineCode: string;
      sha256: string;
    };
  };
  authorization: {
    destructiveMutation: boolean;
    execution: boolean;
    kind: string;
  };
  evidenceKind: string;
  format: string;
  provenance?: Record<string, unknown>;
  scopes: string[];
  selectors: InventorySelector[];
  tree: {
    entries: InventoryEntry[];
    entryCount: number;
    treeDigest: string;
  };
  version: string;
}

interface GenerateOptions {
  appTreePath: string;
  architecture: string;
  provenance?: Record<string, unknown>;
  resourcesTarPath: string;
  uninstallerPath: string;
  version: string;
}

const require = createRequire(import.meta.url);
const {
  __testOnly,
  INVENTORY_SCOPES,
  InventoryArchitecture,
  InventoryAuthorizationKind,
  InventoryContentPolicy,
  InventoryEntryType,
  InventoryEvidenceKind,
  InventoryOwnershipClass,
  InventoryPresence,
  RESOURCE_EXTRACTION_MARKER_PATH,
  canonicalStringify,
  generateInventory,
  matchExactPackagedEvidence,
  validateInventory,
} = require('../scripts/windows-install-inventory.cjs') as {
  __testOnly: {
    validateEntryCollectionSchema: (
      entries: Array<Record<string, unknown>>,
      options: { maxEntries?: number; version: string },
    ) => number;
  };
  INVENTORY_SCOPES: string[];
  InventoryArchitecture: { X64: string };
  InventoryAuthorizationKind: { BuildEvidenceOnly: string };
  InventoryContentPolicy: {
    ExactSchema: string;
    ImmutableHash: string;
    ReplaceableByPath: string;
    TrustedOutputDigestSet: string;
  };
  InventoryEntryType: { File: string };
  InventoryEvidenceKind: { PackagedTree: string };
  InventoryOwnershipClass: { Packaged: string };
  InventoryPresence: { Optional: string };
  RESOURCE_EXTRACTION_MARKER_PATH: string;
  canonicalStringify: (value: unknown) => string;
  generateInventory: (options: GenerateOptions) => Inventory;
  matchExactPackagedEvidence: (
    inventory: Inventory,
    request: Record<string, unknown>,
  ) => InventorySelector | null;
  validateInventory: (inventory: Inventory) => Inventory;
};
const {
  validateEntryCollectionSchema: validateEntriesSchemaOnly,
} = __testOnly;

const fixtureRoot = resolve(
  process.cwd(),
  'tests/fixtures/windows-install-inventory',
);
const inventoryScript = resolve(
  process.cwd(),
  'scripts/windows-install-inventory.cjs',
);
const fixtureVersion = '2026.7.23';
const temporaryRoots: string[] = [];

const createMinimalPe = (
  filePath: string,
  machineCode: number,
  { withCertificateTable = true } = {},
): void => {
  const peOffset = 0x80;
  const isPe32Plus = machineCode === 0x8664;
  const optionalHeaderSize = isPe32Plus ? 0xf0 : 0xe0;
  const optionalHeaderOffset = peOffset + 24;
  const dataDirectoryOffset = isPe32Plus ? 112 : 96;
  const certificateOffset = 0x400;
  const certificateSize = withCertificateTable ? 0x20 : 0;
  const buffer = Buffer.alloc(certificateOffset + certificateSize);

  buffer.write('MZ', 0, 'latin1');
  buffer.writeUInt32LE(peOffset, 0x3c);
  buffer.write('PE\0\0', peOffset, 'latin1');
  buffer.writeUInt16LE(machineCode, peOffset + 4);
  buffer.writeUInt16LE(optionalHeaderSize, peOffset + 20);
  buffer.writeUInt16LE(isPe32Plus ? 0x20b : 0x10b, optionalHeaderOffset);
  buffer.writeUInt32LE(16, optionalHeaderOffset + dataDirectoryOffset - 4);
  if (withCertificateTable) {
    buffer.writeUInt32LE(
      certificateOffset,
      optionalHeaderOffset + dataDirectoryOffset + 32,
    );
    buffer.writeUInt32LE(
      certificateSize,
      optionalHeaderOffset + dataDirectoryOffset + 36,
    );
    buffer.fill(0xa5, certificateOffset);
  }
  writeFileSync(filePath, buffer);
};

const prepareFixture = (): GenerateOptions & { root: string } => {
  const root = mkdtempSync(join(tmpdir(), 'lobsterai-windows-inventory-'));
  temporaryRoots.push(root);
  const appTreePath = join(root, 'app-tree');
  const uninstallerPath = join(root, 'uninstaller-candidate.exe');
  cpSync(join(fixtureRoot, 'app-tree'), appTreePath, { recursive: true });
  createMinimalPe(join(appTreePath, 'LobsterAI.exe'), 0x8664);
  createMinimalPe(uninstallerPath, 0x014c);
  const resourcesTarPath = join(
    appTreePath,
    'resources',
    'win-resources.tar',
  );
  tar.create(
    {
      cwd: join(fixtureRoot, 'tar-root'),
      file: resourcesTarPath,
      portable: true,
      sync: true,
    },
    ['cfmind', 'SKILLs'],
  );
  const provenance = JSON.parse(
    readFileSync(join(fixtureRoot, 'provenance.json'), 'utf8'),
  ) as Record<string, unknown>;

  return {
    appTreePath,
    architecture: InventoryArchitecture.X64,
    provenance,
    resourcesTarPath,
    root,
    uninstallerPath,
    version: fixtureVersion,
  };
};

const makeReplaceableEntry = (path: string): Record<string, unknown> => ({
  contentPolicy: InventoryContentPolicy.ReplaceableByPath,
  ownershipClass: InventoryOwnershipClass.Packaged,
  path,
  presence: InventoryPresence.Optional,
  scopes: [...INVENTORY_SCOPES],
  type: InventoryEntryType.File,
  versionRange: {
    maxInclusive: fixtureVersion,
    minInclusive: fixtureVersion,
  },
  writer: 'package',
});

const cloneInventory = (inventory: Inventory): Inventory =>
  JSON.parse(JSON.stringify(inventory)) as Inventory;

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { force: true, recursive: true });
  }
});

describe('Windows install inventory generator', () => {
  test('generates deterministic canonical output and two exact scope selectors', () => {
    const options = prepareFixture();
    const first = generateInventory(options);
    const second = generateInventory(options);

    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(validateInventory(first)).toBe(first);
    expect(first.evidenceKind).toBe(InventoryEvidenceKind.PackagedTree);
    expect(first.authorization).toEqual({
      destructiveMutation: false,
      execution: false,
      kind: InventoryAuthorizationKind.BuildEvidenceOnly,
    });
    expect(first.artifacts.uninstallerCandidate).toMatchObject({
      hasPeCertificateTable: true,
      path: 'Uninstall LobsterAI.exe',
    });
    expect(first.selectors.map((selector) => selector.scope)).toEqual(
      INVENTORY_SCOPES,
    );
    expect(new Set(first.selectors.map((selector) => selector.treeDigest))).toEqual(
      new Set([first.tree.treeDigest]),
    );
    expect(first.selectors[0].sourceFootprint.executable).toMatchObject({
      path: 'LobsterAI.exe',
      hasPeCertificateTable: true,
      peMachine: 'x64',
      peMachineCode: '0x8664',
    });
    expect(first.selectors[0].sourceFootprint.appAsar.path).toBe(
      'resources/app.asar',
    );
    expect(
      first.tree.entries.find(
        (entry) => entry.path === RESOURCE_EXTRACTION_MARKER_PATH,
      ),
    ).toMatchObject({
      contentPolicy: InventoryContentPolicy.ExactSchema,
      maxBytes: 256,
      ownershipClass: 'installer-generated',
      presence: 'optional',
      schemaId: 'win-resources-extracted-v1',
      writer: 'installer-or-app-recovery',
    });
    expect(first.tree.entries.map((entry) => entry.path)).toContain(
      'resources/cfmind/gateway-bundle.mjs',
    );
    expect(first.tree.entries.map((entry) => entry.path)).toContain(
      'resources/SKILLs/web-search/SKILL.md',
    );
  });

  test('preserves prototype-named provenance keys in canonical evidence', () => {
    const options = prepareFixture();
    options.provenance = JSON.parse(
      '{"__proto__":{"source":"fixture"},"safe":2}',
    ) as Record<string, unknown>;

    const inventory = generateInventory(options);
    expect(validateInventory(inventory)).toBe(inventory);
    expect(Object.hasOwn(inventory.provenance!, '__proto__')).toBe(true);
    expect(canonicalStringify(inventory.provenance)).toContain('"__proto__"');
    expect(canonicalStringify(inventory.provenance)).not.toBe(
      canonicalStringify({ safe: 2 }),
    );
  });

  test('CLI generate and validate preserve the canonical representation', () => {
    const options = prepareFixture();
    const outputPath = join(options.root, 'inventory.json');
    const generated = spawnSync(
      process.execPath,
      [
        inventoryScript,
        'generate',
        '--version',
        options.version,
        '--arch',
        options.architecture,
        '--app-tree',
        options.appTreePath,
        '--uninstaller',
        options.uninstallerPath,
        '--resources-tar',
        options.resourcesTarPath,
        '--provenance',
        join(fixtureRoot, 'provenance.json'),
        '--output',
        outputPath,
      ],
      { encoding: 'utf8' },
    );
    expect(generated.status, generated.stderr).toBe(0);

    const validated = spawnSync(
      process.execPath,
      [inventoryScript, 'validate', '--input', outputPath],
      { encoding: 'utf8' },
    );
    expect(validated.status, validated.stderr).toBe(0);
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as Inventory;
    expect(readFileSync(outputPath, 'utf8')).toBe(canonicalStringify(parsed));
  });

  test('requires scope and never falls back to a nearby version', () => {
    const inventory = generateInventory(prepareFixture());
    const footprint = inventory.selectors[0].sourceFootprint;
    const exactRequest = {
      appAsarSha256: footprint.appAsar.sha256,
      architecture: InventoryArchitecture.X64,
      executableSha256: footprint.executable.sha256,
      peMachine: InventoryArchitecture.X64,
      scope: inventory.selectors[0].scope,
      version: fixtureVersion,
    };

    expect(matchExactPackagedEvidence(inventory, exactRequest)?.key).toBe(
      inventory.selectors[0].key,
    );
    expect(() => {
      const { scope: _scope, ...missingScope } = exactRequest;
      matchExactPackagedEvidence(inventory, missingScope);
    }).toThrow(/scope is required/);
    expect(
      matchExactPackagedEvidence(inventory, {
        ...exactRequest,
        version: '2026.7.22',
      }),
    ).toBeNull();
  });

  test('rejects Windows aliases, traversal, duplicate and case-fold-colliding paths', () => {
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('C:/LobsterAI/file.txt')], {
        version: fixtureVersion,
      })).toThrow(/canonical relative path/);
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('resources/../user.txt')], {
        version: fixtureVersion,
      })).toThrow(/must not contain/);
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('resources/file.txt:secret')], {
        version: fixtureVersion,
      })).toThrow(/ADS separator/);
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('resources/user-data.')], {
        version: fixtureVersion,
      })).toThrow(/trailing dot or space/);
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('resources/NUL.txt')], {
        version: fixtureVersion,
      })).toThrow(/reserved Windows device name/);
    expect(() =>
      validateEntriesSchemaOnly([makeReplaceableEntry('resources/用户.txt')], {
        version: fixtureVersion,
      })).toThrow(/printable ASCII/);
    expect(() =>
      validateEntriesSchemaOnly(
        [
          makeReplaceableEntry('resources/file.txt'),
          makeReplaceableEntry('resources/file.txt'),
        ],
        { version: fixtureVersion },
      )).toThrow(/duplicate inventory path/);
    expect(() =>
      validateEntriesSchemaOnly(
        [
          makeReplaceableEntry('resources/Readme.txt'),
          makeReplaceableEntry('resources/README.txt'),
        ],
        { version: fixtureVersion },
      )).toThrow(/case-fold collision/);
  });

  test('rejects link or reparse-like entries without following them', () => {
    const options = prepareFixture();
    const externalDirectory = join(options.root, 'external-runtime');
    const linkPath = join(options.appTreePath, 'resources', 'linked-runtime');
    mkdirSync(externalDirectory);
    symlinkSync(
      externalDirectory,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    expect(() => generateInventory(options)).toThrow(/link\/reparse-like/);
  });

  test('rejects links inside the materialized resources tar', () => {
    const options = prepareFixture();
    const archiveRoot = join(options.root, 'tar-with-link');
    const archiveTarget = join(archiveRoot, 'target');
    mkdirSync(archiveTarget, { recursive: true });
    writeFileSync(join(archiveTarget, 'payload.txt'), 'payload');
    symlinkSync(
      archiveTarget,
      join(archiveRoot, 'linked-runtime'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    tar.create(
      {
        cwd: archiveRoot,
        file: options.resourcesTarPath,
        portable: true,
        sync: true,
      },
      ['linked-runtime'],
    );

    expect(() => generateInventory(options)).toThrow(/resources tar entry.*link/);
  });

  test('requires policy-specific fields', () => {
    const immutable = {
      ...makeReplaceableEntry('resources/immutable.bin'),
      contentPolicy: InventoryContentPolicy.ImmutableHash,
    };
    expect(() =>
      validateEntriesSchemaOnly([immutable], { version: fixtureVersion })).toThrow(
      /lowercase SHA-256/,
    );

    const trustedOutput = {
      ...makeReplaceableEntry('resources/generated.exe'),
      contentPolicy: InventoryContentPolicy.TrustedOutputDigestSet,
    };
    expect(() =>
      validateEntriesSchemaOnly([trustedOutput], { version: fixtureVersion })).toThrow(
      /non-empty digest set/,
    );

    const exactSchema = {
      ...makeReplaceableEntry('resources/marker.json'),
      contentPolicy: InventoryContentPolicy.ExactSchema,
      schemaId: 'marker-v1',
    };
    expect(() =>
      validateEntriesSchemaOnly([exactSchema], { version: fixtureVersion })).toThrow(
      /maxBytes/,
    );
  });

  test('keeps packaged-tree evidence non-authorizing and rejects policy widening', () => {
    const baseline = generateInventory(prepareFixture());
    const authorizationMutations: Array<(inventory: Inventory) => void> = [
      (inventory) => {
        inventory.authorization.destructiveMutation = true;
      },
      (inventory) => {
        inventory.authorization.execution = true;
      },
      (inventory) => {
        inventory.authorization.kind = 'runtime-authorization';
      },
    ];
    for (const mutate of authorizationMutations) {
      const escalated = cloneInventory(baseline);
      mutate(escalated);
      expect(() => validateInventory(escalated)).toThrow(
        /must not grant execution or destructive mutation/,
      );
    }

    const widened = cloneInventory(baseline);
    const runtimeConfig = widened.tree.entries.find(
      (entry) => entry.path === 'resources/runtime-config.json',
    );
    expect(runtimeConfig).toBeDefined();
    runtimeConfig!.contentPolicy = InventoryContentPolicy.TrustedOutputDigestSet;
    (
      runtimeConfig as InventoryEntry & { trustedSha256: string[] }
    ).trustedSha256 = ['0'.repeat(64)];
    expect(() => validateInventory(widened)).toThrow(
      /resources\/runtime-config\.json.*replaceable-by-path/,
    );

    const broadenedMarker = cloneInventory(baseline);
    const marker = broadenedMarker.tree.entries.find(
      (entry) => entry.path === RESOURCE_EXTRACTION_MARKER_PATH,
    );
    expect(marker).toBeDefined();
    marker!.writer = 'package';
    expect(() => validateInventory(broadenedMarker)).toThrow(
      /invalid resources\/\.win-resources-extracted rule/,
    );

    const broadenedPackageWriter = cloneInventory(baseline);
    const packageEntry = broadenedPackageWriter.tree.entries.find(
      (entry) => entry.path === 'resources/runtime-config.json',
    );
    expect(packageEntry).toBeDefined();
    packageEntry!.writer = 'runtime-writer';
    expect(() => validateInventory(broadenedPackageWriter)).toThrow(
      /resources\/runtime-config\.json.*package-owned/,
    );

    const broadenedPackageOwnership = cloneInventory(baseline);
    const ownershipEntry = broadenedPackageOwnership.tree.entries.find(
      (entry) => entry.path === 'resources/runtime-config.json',
    );
    expect(ownershipEntry).toBeDefined();
    ownershipEntry!.ownershipClass = 'installer-generated';
    expect(() => validateInventory(broadenedPackageOwnership)).toThrow(
      /resources\/runtime-config\.json.*package-owned/,
    );

    const broadenedUninstaller = cloneInventory(baseline);
    const uninstallerEntry = broadenedUninstaller.tree.entries.find(
      (entry) => entry.path === 'Uninstall LobsterAI.exe',
    );
    expect(uninstallerEntry).toBeDefined();
    uninstallerEntry!.writer = 'package';
    expect(() => validateInventory(broadenedUninstaller)).toThrow(
      /invalid Uninstall LobsterAI\.exe rule/,
    );

    const widenedUninstaller = cloneInventory(baseline);
    const widenedUninstallerEntry = widenedUninstaller.tree.entries.find(
      (entry) => entry.path === 'Uninstall LobsterAI.exe',
    );
    expect(widenedUninstallerEntry).toBeDefined();
    widenedUninstallerEntry!.contentPolicy =
      InventoryContentPolicy.ReplaceableByPath;
    delete widenedUninstallerEntry!.sha256;
    expect(() => validateInventory(widenedUninstaller)).toThrow(
      /invalid Uninstall LobsterAI\.exe rule/,
    );
  });

  test('validates 35k entries within budget and rejects budget overflow', () => {
    const entries = Array.from({ length: 35_000 }, (_, index) =>
      makeReplaceableEntry(
        `resources/bulk/file-${index.toString().padStart(5, '0')}.dat`,
      ));

    expect(
      validateEntriesSchemaOnly(entries, {
        maxEntries: 35_000,
        version: fixtureVersion,
      }),
    ).toBe(35_000);
    expect(() =>
      validateEntriesSchemaOnly(
        [...entries, makeReplaceableEntry('resources/bulk/overflow.dat')],
        { maxEntries: 35_000, version: fixtureVersion },
      )).toThrow(/entry budget/);
  });

  test('requires x64 main PE and structural certificate-table evidence', () => {
    const wrongMain = prepareFixture();
    createMinimalPe(join(wrongMain.appTreePath, 'LobsterAI.exe'), 0x014c);
    expect(() => generateInventory(wrongMain)).toThrow(/PE x64/);

    const mainWithoutCertificateTable = prepareFixture();
    createMinimalPe(
      join(mainWithoutCertificateTable.appTreePath, 'LobsterAI.exe'),
      0x8664,
      {
        withCertificateTable: false,
      },
    );
    expect(() => generateInventory(mainWithoutCertificateTable)).toThrow(
      /LobsterAI\.exe has no PE certificate table/,
    );

    const uninstallerWithoutCertificateTable = prepareFixture();
    createMinimalPe(uninstallerWithoutCertificateTable.uninstallerPath, 0x014c, {
      withCertificateTable: false,
    });
    expect(() => generateInventory(uninstallerWithoutCertificateTable)).toThrow(
      /no PE certificate table/,
    );
  });
});
