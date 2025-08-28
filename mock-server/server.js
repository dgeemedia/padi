// mock-server/server.js
//
// Tiny in-memory Express mock for MyPadiMan auth flows.
// NOT for production. For local testing only.

import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// simple in-memory "db"
const usersByEmail = new Map(); // email -> user
const verifyTokens = new Map(); // token -> email
const apiTokens = new Map();    // token -> email (auth tokens)

/* Middleware */
app.use(cors());
app.use(express.json());

// Helper token generator
function genToken(len = 24) {
  return crypto.randomBytes(len).toString("hex");
}

/* Helper: build user object returned to client (omit password) */
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    emailVerified: !!u.emailVerified,
    provider: u.provider || null,
  };
}

/* POST /auth/register
   Body: { name, email, password }
   Returns: { token, user, verifyLink }
*/
app.post("/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing name, email or password" });
  }

  const lower = String(email).toLowerCase();
  if (usersByEmail.has(lower)) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const id = genToken(8);
  const user = {
    id,
    name,
    email: lower,
    password, // plaintext for mock (do NOT do this in production)
    emailVerified: false,
    createdAt: Date.now(),
  };

  usersByEmail.set(lower, user);

  // generate api token & verify token for email confirmation simulation
  const token = genToken(12);
  apiTokens.set(token, lower);

  const verifyToken = genToken(12);
  verifyTokens.set(verifyToken, lower);

  const verifyLink = `${req.protocol}://${req.get("host")}/auth/verify/${verifyToken}`;

  res.json({ token, user: publicUser(user), verifyLink });
});

/* POST /auth/login
   Body: { email, password }
   Returns: { token, user }
*/
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Missing email or password" });
  }
  const lower = String(email).toLowerCase();
  const user = usersByEmail.get(lower);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // generate token for each login
  const token = genToken(12);
  apiTokens.set(token, lower);

  res.json({ token, user: publicUser(user) });
});

/* POST /auth/resend-confirm
   Body: { email }
   Returns: { message, verifyLink }
*/
app.post("/auth/resend-confirm", (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Missing email" });
  const lower = String(email).toLowerCase();
  const user = usersByEmail.get(lower);
  if (!user) return res.status(404).json({ message: "User not found" });

  const verifyToken = genToken(12);
  verifyTokens.set(verifyToken, lower);
  const verifyLink = `${req.protocol}://${req.get("host")}/auth/verify/${verifyToken}`;

  res.json({ message: "Confirmation link resent.", verifyLink });
});

/* GET /auth/verify/:token
   Marks user verified and returns message
*/
app.get("/auth/verify/:token", (req, res) => {
  const token = req.params.token;
  const email = verifyTokens.get(token);
  if (!email) {
    return res.status(400).json({ message: "Invalid or expired verification token" });
  }
  verifyTokens.delete(token);
  const user = usersByEmail.get(email);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.emailVerified = true;
  res.json({ message: "Email verified successfully!", user: publicUser(user) });
});

/* GET /auth/oauth/:provider
   Simulated OAuth endpoint - mock a provider login flow.
   Opens in a popup, creates/fetches a user, issues a token, and postMessage() back.
*/
app.get("/auth/oauth/:provider", (req, res) => {
  const provider = String(req.params.provider || "unknown").toLowerCase();

  // fake email so each provider is unique
  const email = `${provider}_user_${Date.now()}@example.com`;
  const lower = email.toLowerCase();

  let user = usersByEmail.get(lower);
  if (!user) {
    const id = genToken(8);
    user = {
      id,
      name: `${provider[0].toUpperCase() + provider.slice(1)} User`,
      email: lower,
      password: null,
      emailVerified: true, // treat socials as verified
      provider,
      createdAt: Date.now(),
    };
    usersByEmail.set(lower, user);
  }

  const token = genToken(12);
  apiTokens.set(token, lower);

  const publicU = publicUser(user);
  const payload = { token, user: publicU };

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>OAuth mock - ${provider}</title></head>
<body>
  <script>
    (function () {
      try {
        const data = ${JSON.stringify(payload)};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'mypadiman_oauth', data }, '*');
          setTimeout(() => window.close(), 250);
        } else {
          document.body.textContent = JSON.stringify(data, null, 2);
        }
      } catch (e) {
        document.body.textContent = 'OAuth mock error: ' + e;
      }
    })();
  </script>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Start
app.listen(PORT, () => {
  console.log(`Mock auth server listening on http://localhost:${PORT}`);
});
