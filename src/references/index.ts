/**
 * References module - branch and HEAD management.
 */

export {
  readReference,
  writeReference,
  writeSymbolicReference,
  resolveHEAD,
  setHEADToRef,
  setHEADDetached,
  getAllBranches,
  type ReferenceType,
  type ResolvedReference
} from "./references.js";
