/**
 * Checks whether a script needs a file:// prefix in later processing steps.
 * @param {string} scriptUrl - URL for script to check
 * @returns {boolean} Whether script should be prefixed with file://
 */
export function needsFilePrefix(scriptUrl) {
  const remotePrefixes = ["http://", "https://", "blob:", "data:"];
  return !remotePrefixes.some((prefix) => scriptUrl.startsWith(prefix));
}
