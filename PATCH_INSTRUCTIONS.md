# Earth Solutions - Patch Instructions

## Add 2 lines to server.js

Open server.js and add these lines AFTER line 22 (app.use(express.json(...))):

```js
const userRoutes = require('./user-routes');
userRoutes(app);
```

## Extract all files into your project root

Replaced: admin.html, index.html, style.css
New: user-routes.js, frontend/auth-client.js, data/users.json

## Test

node server.js

## Default Accounts

Demo credentials are no longer provided. Configure production authentication through the server environment and create user accounts through the supported admin workflow.

## P0-07 security hardening changed: server.js, .env.example, and this instruction file. Other application files were intentionally left unchanged.
