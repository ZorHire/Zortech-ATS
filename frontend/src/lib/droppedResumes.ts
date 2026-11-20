/**
 * Resumes dropped anywhere on ZorHire (outside an upload box) wait here until the
 * Candidates page opens its bulk upload with them. Kept in memory only.
 */
let pending: File[] = [];

export const RESUME_FILE_RE = /\.(pdf|doc|docx)$/i;

export function setDroppedResumes(files: File[]) {
  pending = files;
}

export function takeDroppedResumes(): File[] {
  const out = pending;
  pending = [];
  return out;
}
