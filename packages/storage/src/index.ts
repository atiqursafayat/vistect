// ============================================================================
// Storage Package Exports
// ============================================================================

export { eventStore } from './eventStore';
export { createSnapshotManager, recoverProject, computeProjectHash } from './snapshots';
export { deriveKeys, encryptPackage, decryptPackage, computeContentHash, exportKey, importKey } from './keys';
export { createQuotaManager, UPLOAD_LIMITS, validateUploadLimits, validateProjectLimits, type QuotaStatus, type QuotaManager } from './quota';

export type { EncryptionKeys, EncryptedPackage } from './keys';
export type { EventEnvelope } from '@vistect/domain/events';