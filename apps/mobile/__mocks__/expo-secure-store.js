/**
 * Purpose: Manual Jest mock for expo-secure-store — in-memory key/value store.
 * Inputs: same API surface the app uses (getItemAsync/setItemAsync/deleteItemAsync).
 * Outputs: deterministic storage for unit tests (no native module).
 * Constraints: state resets per test file via __reset().
 */
const store = new Map();

module.exports = {
  getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  setItemAsync: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    store.delete(key);
  }),
  __reset: () => store.clear(),
};
