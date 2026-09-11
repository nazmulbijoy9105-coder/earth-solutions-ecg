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

| Role  | Email             | Password |
|-------|-------------------|----------|
| Admin | admin@earth.com   | admin123 |
| User  | sarah@earth.com   | user123  |

## NOT changed: server.js (2 lines only), frontend/chat.js, api/chat.js, sw.js, manifest.json, package.json, logo.jpg, pricing.html
