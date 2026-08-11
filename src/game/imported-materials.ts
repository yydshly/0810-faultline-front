/**
 * Plain-data ownership and compatibility rules for imported materials.
 *
 * Runtime material objects deliberately do not appear here. Asset labels own
 * their materials by default; cross-asset reuse requires an explicit shared
 * group and an identical descriptor signature.
 */

export type MaterialDescriptorValue =
  | string
  | number
  | boolean
  | null
  | readonly MaterialDescriptorValue[]
  | Readonly<{ [key: string]: MaterialDescriptorValue | undefined }>;

export type ImportedMaterialDescriptor = Readonly<{
  /** The authored material name, retained as part of the compatibility signature. */
  name: string;
  /** Shader or material class, for example `MeshStandardMaterial`. */
  shader: string;
  [key: string]: MaterialDescriptorValue | undefined;
}>;

export interface ImportedMaterialOwner {
  /** Stable authored asset label, for example `FF-MBT-01`. */
  assetLabel: string;
  /**
   * Optional, explicitly validated cross-asset ownership group.
   * Empty or whitespace-only values are treated as absent.
   */
  shareGroup?: string | null;
}

export interface ImportedMaterialScope {
  kind: 'asset' | 'share-group';
  id: string;
}

const requireIdentifier = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must be a non-empty string.`);
  return normalized;
};

/** Resolve the single ownership scope used for material reuse. */
export function importedMaterialScope(owner: ImportedMaterialOwner): ImportedMaterialScope {
  const assetLabel = requireIdentifier(owner.assetLabel, 'assetLabel');
  const shareGroup = owner.shareGroup?.trim();
  return shareGroup
    ? { kind: 'share-group', id: shareGroup }
    : { kind: 'asset', id: assetLabel };
}

/**
 * Collision-safe owner key. JSON tuple encoding avoids delimiter ambiguity in
 * labels such as `faction:vehicle`.
 */
export function importedMaterialOwnerKey(owner: ImportedMaterialOwner): string {
  const scope = importedMaterialScope(owner);
  return JSON.stringify([scope.kind, scope.id]);
}

const canonicalizeDescriptorValue = (
  value: MaterialDescriptorValue,
  ancestors: Set<object>,
): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Material descriptors may only contain finite numbers.');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (ancestors.has(value)) throw new TypeError('Material descriptors must not contain cycles.');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalizeDescriptorValue(entry, ancestors)).join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Material descriptors may only contain plain objects and arrays.');
    }
    const record = value as Readonly<Record<string, MaterialDescriptorValue | undefined>>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
      .map((key) => `${JSON.stringify(key)}:${canonicalizeDescriptorValue(record[key] as MaterialDescriptorValue, ancestors)}`);
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
};

/**
 * Produce a deterministic, order-independent signature for a plain material
 * descriptor. Numeric values are exact; callers should quantize intentionally
 * before constructing a descriptor if their asset contract permits tolerance.
 */
export function importedMaterialDescriptorSignature(descriptor: ImportedMaterialDescriptor): string {
  requireIdentifier(descriptor.name, 'descriptor.name');
  requireIdentifier(descriptor.shader, 'descriptor.shader');
  return `material-v1:${canonicalizeDescriptorValue(descriptor, new Set<object>())}`;
}

/** A stable lookup key that includes both ownership and full compatibility. */
export function importedMaterialLibraryKey(
  owner: ImportedMaterialOwner,
  descriptor: ImportedMaterialDescriptor,
): string {
  return JSON.stringify([
    importedMaterialOwnerKey(owner),
    importedMaterialDescriptorSignature(descriptor),
  ]);
}

/**
 * Materials may be reused only inside the same resolved owner scope and when
 * every descriptor field matches exactly.
 */
export function canShareImportedMaterial(
  leftOwner: ImportedMaterialOwner,
  leftDescriptor: ImportedMaterialDescriptor,
  rightOwner: ImportedMaterialOwner,
  rightDescriptor: ImportedMaterialDescriptor,
): boolean {
  return importedMaterialOwnerKey(leftOwner) === importedMaterialOwnerKey(rightOwner)
    && importedMaterialDescriptorSignature(leftDescriptor) === importedMaterialDescriptorSignature(rightDescriptor);
}
