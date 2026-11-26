/**
 * Packfile module - Git packfile and pack index support.
 */

export {
  type PackfileEntry,
  type DeltaBase,
  PackfileObjectType,
  type PackfileHeader,
  type PackIndexEntry,
  type PackIndex,
  type DeltaInstruction,
  type DeltaHeader,
  type PackfileOptions
} from "./types.js";

export {
  parseVarint,
  encodeVarint,
  parseDeltaHeader,
  parseDeltaInstructions,
  applyDelta,
  createDelta
} from "./delta.js";

export {
  PackfileReader,
  readPackfileHeader,
  readPackfileObject,
  validatePackfileChecksum,
  parsePackfile,
  resolveDeltas
} from "./reader.js";

export {
  readPackIndex,
  findInPackIndex,
  validatePackIndexIntegrity
} from "./index-reader.js";

export {
  writePackfileHeader,
  writePackfileObjectHeader,
  writePackfileObject,
  createPackfile,
  createPackIndex
} from "./writer.js";
