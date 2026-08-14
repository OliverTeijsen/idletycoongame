/* Test setup for the `app` project (services, store, UI). */

// Each test file gets a clean persisted save.
const { clearSave } = require('./src/services/storage');
const { setLocale } = require('./src/ui/i18n');

beforeEach(() => {
  clearSave();
  // Pin the locale. Without this, UI assertions read whatever language the
  // machine running the suite happens to use, so the tests pass in Brussels and
  // fail in CI. `i18n.test.ts` covers detection itself.
  setLocale('en');
});
