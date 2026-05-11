/**
 * Generic Vault item — a payload bundled by Cryptex or added by the user.
 *
 * Each tool defines its own item shape via the `payload` generic; the rest
 * of the schema is uniform so search/filter/UI works across tools.
 *
 * schemaVersion gates forward-compatible migrations. When bumping to v2,
 * keep the v1 type around and add a migrate() that upgrades stored items.
 */
export interface VaultItem<TPayload = unknown> {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly title: string;
  readonly description?: string;
  readonly payload: TPayload;
  readonly tags: readonly string[];
  /** 'bundled' for shipped seeds, 'user' for user-added. */
  readonly source: 'bundled' | 'user';
  /** Spec URL or paper citation; required for bundled, optional for user items. */
  readonly sourceUrl?: string;
  /** SPDX license id or short label (e.g., 'MIT', 'CC-BY-4.0'). Required for bundled. */
  readonly license?: string;
  /** Epoch ms when this was added (for user items) or when bundled (build time). */
  readonly addedAt: number;
  /** User-set: prefer this item in suggestions. */
  readonly pinned?: boolean;
  /** Free-form user notes for personal annotation. */
  readonly notes?: string;
}

/** A query against a Vault store. */
export interface VaultQuery {
  readonly text?: string;       // matches title/description/tags case-insensitively
  readonly tags?: readonly string[]; // AND across tags
  readonly source?: 'bundled' | 'user';
  readonly pinnedOnly?: boolean;
}
