/* Test setup for the `app` project (services, state, UI). */

// Each test file gets a clean persisted save.
const { clearSave } = require('./src/services/storage');

beforeEach(() => {
  clearSave();
});
