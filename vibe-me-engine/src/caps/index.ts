export { findCapsFiles, discoverFilesInDir, tryReadFile, type CapsFileInfo } from './discover.js';
export { buildCapitalsContext, escapeXmlAttr } from './format.js';
export { appendCapsContext, stripHostAgentsPrompt, CAPS_INJECTION_SYMBOL } from './inject.js';
export { createCapsContextHook, type CapitalsContextHook } from './hook.js';