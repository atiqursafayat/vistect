// ============================================================================
// Storage Package Exports
// ============================================================================

export { eventStore, EventStore } from './eventStore';
export {
  computeHmac,
  verifyHmac,
  verifyChain,
  deriveSessionSecret,
  generateSalt,
  timingSafeEqual,
  CHAIN_ROOT,
  type ChainLink,
  type ChainVerification,
} from './eventStore/hmac';
export {
  createSnapshotManager,
  recoverProject,
  computeProjectHash,
  SNAPSHOT_INTERVAL,
  UNDO_DEPTH,
  MAX_SNAPSHOTS,
  type SnapshotManager,
  type SnapshotRecovery,
} from './snapshots';
export {
  deriveKeys,
  encryptPackage,
  decryptPackage,
  computeContentHash,
  exportKey,
  importKey,
  type EncryptionKeys,
  type EncryptedPackage,
} from './keys';
export {
  createQuotaManager,
  UPLOAD_LIMITS,
  validateUploadLimits,
  validateProjectLimits,
  type QuotaStatus,
  type QuotaManager,
} from './quota';

export type { EventEnvelope } from '@vistect/domain/events';
