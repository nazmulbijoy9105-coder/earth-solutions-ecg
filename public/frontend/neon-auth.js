'use strict';

// Neon Auth is proxied through this application's own origin so browser
// sessions use first-party cookies (including on browsers with ITP).
const AUTH_SIGNUP_ENABLED = false; // Enable only after Resend SMTP + legacy claim flow are verified.
const accountButton = document.getElementById('accountBtn');
const dialog = document.getElementById('authDialog');
const form = document.getElementById('authForm');
const emailInput = document.getElementById('authEmail');
const passwordInput = document.getElementById('authPassword');
const otpInput = document.getElementById('authOtp');
const nameInput = document.getElementById('authName');
const statusEl = document.getElementById('authStatus');
const submitButton = document.getElementById('authSubmit');
const otpButton = document.getElementById('authVerify');
const resendButton = document.getElementById('authResend');
const signOutButton = document.getElementById('authSignOut');
const claimButton = document.getElementById('authClaim');
const closeButton = document.getElementById('authClose');
const signupButton = document.getElementById('authSignup');
const authFormFields = document.getElementById('authFormFields');

let authClient = null;
let mode = 'signin';
let pendingEmail = '';
let currentToken = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = isError ? 'error' : 'normal';
}

function setMode(nextMode) {
  mode = nextMode;
  const verifying = mode === 'verify';
  const signedOut = mode !== 'signed-in';
  authFormFields.hidden = !signedOut;
  nameInput.closest('.auth-field').hidden = mode !== 'signup';
  otpInput.closest('.auth-field').hidden = !verifying;
  passwordInput.closest('.auth-field').hidden = verifying;
  submitButton.hidden = verifying || mode === 'signed-in';
  otpButton.hidden = !verifying;
  resendButton.hidden = !verifying;
  signOutButton.hidden = mode !== 'signed-in';
  claimButton.hidden = mode !== 'signed-in';
  signupButton.hidden = !AUTH_SIGNUP_ENABLED || verifying || mode === 'signed-in';
  submitButton.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  setStatus('');
}

function showSignedIn(user) {
  setMode('signed-in');
  const label = user?.name || user?.email || 'Account';
  accountButton.textContent = label;
  accountButton.setAttribute('aria-label', 'Signed in as ' + label);
  setStatus('Signed in as ' + (user?.email || label));
}

function showGuest() {
  currentToken = null;
  setMode('signin');
  accountButton.textContent = 'Sign in';
  accountButton.setAttribute('aria-label', 'Sign in to your account');
}

async function refreshSession() {
  const { data, error } = await authClient.getSession();
  if (error) throw error;
  if (!data?.session) {
    showGuest();
    return null;
  }

  const token = data.session.token;
  if (!token) throw new Error('No verifiable session token was returned');
  currentToken = token;
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: 'Bearer ' + token },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session needs to be refreshed. Please sign in again.' : 'Could not verify your account session.');
  const result = await response.json();
  showSignedIn(result.user);
  return result.user;
}

try {
  const { createAuthClient } = await import('https://esm.sh/@neon/auth@0.8.2?bundle');
  authClient = createAuthClient(new URL('/api/neon-auth', window.location.origin).toString());

  try { await refreshSession(); } catch { showGuest(); }
} catch {
  showGuest();
  setStatus('Account sign-in is temporarily unavailable. Guest chat remains available.', true);
}

accountButton.addEventListener('click', () => {
  if (!dialog.open) dialog.showModal();
  if (mode === 'signed-in') setStatus('Your account is signed in.');
});

closeButton.addEventListener('click', () => dialog.close());

signupButton.addEventListener('click', () => {
  if (!AUTH_SIGNUP_ENABLED) return;
  setMode('signup');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authClient) return setStatus('Authentication service is not available yet.', true);

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  submitButton.disabled = true;
  try {
    if (mode === 'signup') {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) throw new Error(result.error.message || 'Sign-up failed');
      pendingEmail = email;
      setMode('verify');
      setStatus('Check your email for the verification code.');
      return;
    }

    const result = await authClient.signIn.email({ email, password });
    if (result.error) throw new Error(result.error.message || 'Sign-in failed');
    await refreshSession();
    dialog.close();
  } catch (error) {
    setStatus(error.message || 'Authentication failed. Please try again.', true);
  } finally {
    submitButton.disabled = false;
  }
});

otpButton.addEventListener('click', async () => {
  if (!authClient) return setStatus('Authentication service is not available yet.', true);
  const email = pendingEmail || emailInput.value.trim().toLowerCase();
  const otp = otpInput.value.trim();
  if (!email || !otp) return setStatus('Enter the email address and verification code.', true);

  otpButton.disabled = true;
  try {
    const result = await authClient.emailOtp.verifyEmail({ email, otp });
    if (result.error) throw new Error(result.error.message || 'Email verification failed');
    await refreshSession();
    dialog.close();
  } catch (error) {
    setStatus(error.message || 'Verification failed. Please try again.', true);
  } finally {
    otpButton.disabled = false;
  }
});

resendButton.addEventListener('click', async () => {
  if (!authClient) return setStatus('Authentication service is not available yet.', true);
  const email = pendingEmail || emailInput.value.trim().toLowerCase();
  if (!email) return setStatus('Enter your email address first.', true);
  resendButton.disabled = true;
  try {
    const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
    if (result.error) throw new Error(result.error.message || 'Could not resend the code');
    setStatus('A new verification code has been requested.');
  } catch (error) {
    setStatus(error.message || 'Could not resend the code.', true);
  } finally {
    resendButton.disabled = false;
  }
});

claimButton.addEventListener('click', async () => {
  if (!currentToken) return setStatus('Please sign in again before claiming an account.', true);
  claimButton.disabled = true;
  try {
    const response = await fetch('/api/auth/claim-legacy', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + currentToken },
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404 || result.status === 'no_legacy_record') {
      setStatus('No legacy account matches this verified email address. Contact support if you believe this is an error.');
    } else if (response.status === 409) {
      setStatus('This legacy account is already linked to another identity. Contact support.', true);
    } else if (response.status === 403) {
      setStatus('This legacy account is not eligible for automatic claiming. Contact support.', true);
    } else if (!response.ok) {
      throw new Error(result.error || 'Account claim failed');
    } else if (result.accountStatus === 'suspended') {
      setStatus('Account linked, but the legacy record was pending. Access remains suspended pending review.');
    } else {
      setStatus('Legacy account linked. Application role is User; any former admin label requires separate approval.');
    }
  } catch (error) {
    setStatus(error.message || 'Account claim service is unavailable.', true);
  } finally {
    claimButton.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  if (!authClient) return;
  signOutButton.disabled = true;
  try {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message || 'Sign-out failed');
    showGuest();
    dialog.close();
  } catch (error) {
    setStatus(error.message || 'Sign-out failed.', true);
  } finally {
    signOutButton.disabled = false;
  }
});

if (!AUTH_SIGNUP_ENABLED) {
  signupButton.hidden = true;
  setStatus('New registration is paused until production email delivery and legacy account claims are verified.');
}
