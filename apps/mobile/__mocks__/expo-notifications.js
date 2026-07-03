/**
 * Purpose: Manual Jest mock for expo-notifications — the notification API
 *          surface the app uses, with capture points for assertions.
 * Inputs: same call signatures as expo-notifications.
 * Outputs: jest.fn()s; __scheduled collects scheduleNotificationAsync payloads.
 * Constraints: state resets per test via __reset().
 */
const scheduled = [];

module.exports = {
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async (payload) => {
    scheduled.push(payload);
    return `mock-notification-${scheduled.length}`;
  }),
  __scheduled: scheduled,
  __reset: () => {
    scheduled.length = 0;
  },
};
