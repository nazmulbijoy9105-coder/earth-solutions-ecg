'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const USER_FILE = path.join(DATA_DIR, 'users.json');

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureUserFile() {
  if (!fs.existsSync(USER_FILE)) {
    fs.writeFileSync(
      USER_FILE,
      JSON.stringify({ users: [] }, null, 2),
      'utf8'
    );
  }
}

ensureUserFile();

function readUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));

    if (!data || !Array.isArray(data.users)) {
      return { users: [] };
    }

    return data;
  } catch {
    return { users: [] };
  }
}

function writeUsers(data) {
  const tmp = `${USER_FILE}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  fs.renameSync(tmp, USER_FILE);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);

  const derivedKey = crypto.scryptSync(
    password,
    salt,
    64,
    {
      N: 16384,
      r: 8,
      p: 1
    }
  );

  return [
    'scrypt',
    salt.toString('base64'),
    derivedKey.toString('base64')
  ].join('$');
}

function verifyPassword(password, encodedHash) {
  try {
    if (typeof encodedHash !== 'string') return false;

    const parts = encodedHash.split('$');

    if (
      parts.length !== 3 ||
      parts[0] !== 'scrypt'
    ) {
      return false;
    }

    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');

    if (!salt.length || !expected.length) {
      return false;
    }

    const actual = crypto.scryptSync(
      password,
      salt,
      expected.length,
      {
        N: 16384,
        r: 8,
        p: 1
      }
    );

    if (actual.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/*
 * Migrate legacy plaintext passwords.
 */
function migrateLegacyPasswords() {
  const data = readUsers();
  let changed = false;

  for (const user of data.users) {
    if (
      typeof user.password === 'string' &&
      user.password.length > 0
    ) {
      user.passwordHash = hashPassword(user.password);
      delete user.password;
      changed = true;
    }
  }

  if (changed) {
    writeUsers(data);
    console.log('[Auth] Migrated legacy passwords to scrypt hashes.');
  }
}

migrateLegacyPasswords();

/*
 * Server-side opaque user sessions.
 */
const sessions = new Map();

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function createSession(userId) {
  const token = createToken();

  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL
  });

  return token;
}

function destroySession(token) {
  if (token) {
    sessions.delete(token);
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();

  return token || null;
}

function getSession(token) {
  if (!token) return null;

  const session = sessions.get(token);

  if (!session) return null;

  if (Date.now() >= session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function userAuth(req, res, next) {
  const token = extractBearerToken(req);
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  const data = readUsers();

  const user = data.users.find(
    u => u.id === session.userId
  );

  if (!user) {
    sessions.delete(token);

    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  if (user.status === 'inactive') {
    sessions.delete(token);

    return res.status(403).json({
      error: 'Account deactivated'
    });
  }

  req.userId = user.id;
  req.user = user;
  req.authToken = token;

  next();
}

function adminUserAuth(req, res, next) {
  /*
   * Admin dashboard sessions are owned by server.js.
   */
  if (
    req.app.locals.adminAuth &&
    typeof req.app.locals.adminAuth === 'function'
  ) {
    return req.app.locals.adminAuth(req, res, next);
  }

  /*
   * Fallback: authenticated application user with admin role.
   */
  return userAuth(req, res, function () {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    next();
  });
}

function validateUserInput(body, requirePassword) {
  const name = typeof body.name === 'string'
    ? body.name.trim()
    : '';

  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : '';

  const password = typeof body.password === 'string'
    ? body.password
    : '';

  if (!name || !email || (requirePassword && !password)) {
    return {
      error: 'All required fields must be provided'
    };
  }

  if (name.length > 120) {
    return {
      error: 'Name too long'
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      error: 'Invalid email'
    };
  }

  if (
    requirePassword &&
    (password.length < 8 || password.length > 200)
  ) {
    return {
      error: 'Password must be 8-200 characters'
    };
  }

  return {
    name,
    email,
    password
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    status: user.status
  };
}

module.exports = function registerUserRoutes(app) {

  /*
   * PUBLIC REGISTRATION
   *
   * Client can NEVER select role.
   */
  app.post('/api/user/register', function (req, res) {
    const input = validateUserInput(req.body || {}, true);

    if (input.error) {
      return res.status(400).json({
        error: input.error
      });
    }

    const data = readUsers();

    if (
      data.users.some(
        user => user.email === input.email
      )
    ) {
      return res.status(409).json({
        error: 'Email exists'
      });
    }

    const user = {
      id: `u_${crypto.randomBytes(12).toString('hex')}`,
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),

      /*
       * SECURITY:
       * Public registration is always a normal user.
       */
      role: 'user',

      createdAt: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    data.users.push(user);
    writeUsers(data);

    const token = createSession(user.id);

    res.status(201).json({
      token,
      user: publicUser(user)
    });
  });

  /*
   * USER LOGIN
   */
  app.post('/api/user/login', function (req, res) {
    const email = typeof req.body.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';

    const password = typeof req.body.password === 'string'
      ? req.body.password
      : '';

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required'
      });
    }

    const data = readUsers();

    const user = data.users.find(
      u => u.email === email
    );

    if (
      !user ||
      !user.passwordHash ||
      !verifyPassword(password, user.passwordHash)
    ) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'Account deactivated'
      });
    }

    const token = createSession(user.id);

    res.json({
      token,
      user: publicUser(user)
    });
  });

  /*
   * USER LOGOUT
   */
  app.post('/api/user/logout', userAuth, function (req, res) {
    destroySession(req.authToken);

    res.json({
      ok: true
    });
  });

  /*
   * PROFILE
   */
  app.get('/api/user/profile', userAuth, function (req, res) {
    res.json(publicUser(req.user));
  });

  /*
   * PROFILE UPDATE
   */
  app.patch('/api/user/profile', userAuth, function (req, res) {
    const data = readUsers();

    const index = data.users.findIndex(
      u => u.id === req.userId
    );

    if (index < 0) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();

      if (!name || name.length > 120) {
        return res.status(400).json({
          error: 'Invalid name'
        });
      }

      data.users[index].name = name;
    }

    writeUsers(data);

    res.json(publicUser(data.users[index]));
  });

  /*
   * ADMIN — LIST USERS
   */
  app.get('/api/admin/users', adminUserAuth, function (req, res) {
    const data = readUsers();

    res.json(
      data.users.map(publicUser)
    );
  });

  /*
   * ADMIN — CREATE USER
   */
  app.post('/api/admin/users', adminUserAuth, function (req, res) {
    const input = validateUserInput(req.body || {}, true);

    if (input.error) {
      return res.status(400).json({
        error: input.error
      });
    }

    const data = readUsers();

    if (
      data.users.some(
        user => user.email === input.email
      )
    ) {
      return res.status(409).json({
        error: 'Email exists'
      });
    }

    const requestedRole =
      req.body.role === 'admin'
        ? 'admin'
        : 'user';

    const user = {
      id: `u_${crypto.randomBytes(12).toString('hex')}`,
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
      role: requestedRole,
      createdAt: new Date().toISOString().split('T')[0],
      status:
        ['active', 'pending'].includes(req.body.status)
          ? req.body.status
          : 'active'
    };

    data.users.push(user);
    writeUsers(data);

    res.status(201).json({
      user: publicUser(user)
    });
  });

  /*
   * ADMIN — UPDATE USER
   */
  app.patch('/api/admin/users/:id', adminUserAuth, function (req, res) {
    const data = readUsers();

    const index = data.users.findIndex(
      u => u.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();

      if (!name || name.length > 120) {
        return res.status(400).json({
          error: 'Invalid name'
        });
      }

      data.users[index].name = name;
    }

    if (
      typeof req.body.role === 'string' &&
      ['user', 'admin'].includes(req.body.role)
    ) {
      data.users[index].role = req.body.role;
    }

    if (
      typeof req.body.status === 'string' &&
      ['active', 'inactive', 'pending'].includes(req.body.status)
    ) {
      data.users[index].status = req.body.status;
    }

    writeUsers(data);

    res.json({
      user: publicUser(data.users[index])
    });
  });

  /*
   * ADMIN — DELETE USER
   */
  app.delete('/api/admin/users/:id', adminUserAuth, function (req, res) {
    if (req.params.id === req.userId) {
      return res.status(400).json({
        error: 'Cannot delete current admin'
      });
    }

    const data = readUsers();

    const before = data.users.length;

    data.users = data.users.filter(
      user => user.id !== req.params.id
    );

    if (data.users.length === before) {
      return res.status(404).json({
        error: 'Not found'
      });
    }

    writeUsers(data);

    res.json({
      ok: true
    });
  });
};
