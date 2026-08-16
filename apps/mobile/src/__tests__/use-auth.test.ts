/**
 * Purpose: Unit tests for useAuth — credential persistence and session-expiry.
 *          This is the app's only security-relevant client logic (what is stored
 *          in the Keychain, and whether an expired session is ever reused), and
 *          it previously had no test at all.
 * Inputs: mocked expo-secure-store (in-memory, __reset per test); mocked
 *          NsentryClient so no network is touched.
 * Outputs: jest assertions.
 * Constraints: asserts the documented contract from useAuth's header —
 *          "expired sessions are dropped on launch, never silently reused",
 *          and that nsk_* API keys are long-lived (no expiry).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';

// Mock the client so signIn/signInWithApiKey never hit the network.
const mockLogin = jest.fn();
const mockGetMe = jest.fn();
jest.mock('@nself/nsentry-client', () => ({
  NsentryClient: jest.fn().mockImplementation(() => ({
    login: mockLogin,
    getMe: mockGetMe,
  })),
}));

import { useAuth } from '../hooks/useAuth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStore = require('expo-secure-store');

const TOKEN_KEY = 'nsentry_session_token';
const TOKEN_EXP_KEY = 'nsentry_session_exp';
const TOKEN_IS_API_KEY = 'nsentry_token_is_api_key';

const HOUR = 60 * 60 * 1000;

describe('useAuth — credential restore and expiry', () => {
  beforeEach(() => {
    secureStore.__reset();
    mockLogin.mockReset();
    mockGetMe.mockReset();
  });

  it('restores a session JWT that has not expired', async () => {
    await secureStore.setItemAsync(TOKEN_KEY, 'jwt-still-valid');
    await secureStore.setItemAsync(TOKEN_EXP_KEY, String(Date.now() + HOUR));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessToken).toBe('jwt-still-valid');
  });

  it('drops an EXPIRED session JWT instead of reusing it', async () => {
    await secureStore.setItemAsync(TOKEN_KEY, 'jwt-expired');
    await secureStore.setItemAsync(TOKEN_EXP_KEY, String(Date.now() - HOUR));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessToken).toBeNull();
    // and it must be purged from the Keychain, not merely ignored in memory
    expect(await secureStore.getItemAsync(TOKEN_KEY)).toBeNull();
    expect(await secureStore.getItemAsync(TOKEN_EXP_KEY)).toBeNull();
  });

  it('treats an exactly-at-expiry token as expired (>= boundary)', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await secureStore.setItemAsync(TOKEN_KEY, 'jwt-boundary');
    await secureStore.setItemAsync(TOKEN_EXP_KEY, String(now));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessToken).toBeNull();
    (Date.now as jest.Mock).mockRestore();
  });

  it('drops a token whose stored expiry is unparseable rather than trusting it', async () => {
    await secureStore.setItemAsync(TOKEN_KEY, 'jwt-corrupt-exp');
    await secureStore.setItemAsync(TOKEN_EXP_KEY, 'not-a-number');

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Number('not-a-number') is NaN -> !Number.isFinite -> must clear, never restore.
    expect(result.current.accessToken).toBeNull();
    expect(await secureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });

  it('restores an nsk_* API key regardless of expiry (long-lived, no exp stored)', async () => {
    await secureStore.setItemAsync(TOKEN_KEY, 'nsk_live_key');
    await secureStore.setItemAsync(TOKEN_IS_API_KEY, '1');
    // Deliberately also set a stale exp — the API-key branch must ignore it.
    await secureStore.setItemAsync(TOKEN_EXP_KEY, String(Date.now() - HOUR));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.accessToken).toBe('nsk_live_key');
  });

  it('returns no token when nothing is stored', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBeNull();
  });

  it('signOut purges every credential key from secure storage', async () => {
    await secureStore.setItemAsync(TOKEN_KEY, 'nsk_live_key');
    await secureStore.setItemAsync(TOKEN_IS_API_KEY, '1');

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessToken).toBe('nsk_live_key');

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.accessToken).toBeNull();
    expect(await secureStore.getItemAsync(TOKEN_KEY)).toBeNull();
    expect(await secureStore.getItemAsync(TOKEN_IS_API_KEY)).toBeNull();
    expect(await secureStore.getItemAsync(TOKEN_EXP_KEY)).toBeNull();
  });
});
