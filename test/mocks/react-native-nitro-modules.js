/**
 * Stub for react-native-nitro-modules.
 *
 * The real package calls `installWorkletsSupport()` at import time, which needs
 * a native TurboModule and throws under Jest. react-native-mmkv imports it
 * eagerly but only *uses* it lazily — and it detects Jest and swaps in an
 * in-memory store before ever reaching Nitro. So an inert stub is all the module
 * graph needs, and persistence is still exercised for real.
 *
 * Anything that genuinely reaches Nitro in a test is a bug, hence the throw.
 */
function notAvailable(name) {
  return () => {
    throw new Error(
      `NitroModules.${name}() was called in a test. react-native-nitro-modules is ` +
        'stubbed here; native HybridObjects only exist in a dev client build.',
    );
  };
}

module.exports = {
  NitroModules: {
    createHybridObject: notAvailable('createHybridObject'),
    box: notAvailable('box'),
    get: notAvailable('get'),
    install: notAvailable('install'),
  },
  installWorkletsSupport: () => {},
  getHostComponent: notAvailable('getHostComponent'),
  getHybridObjectConstructor: notAvailable('getHybridObjectConstructor'),
};
