const crypto = require("crypto");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

require("dotenv").config();

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const AUTH_DB_PATH = process.env.AUTH_DB_PATH || path.join(__dirname, "auth.db");
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || `http://localhost:${PORT}`;
const AUTH_OTP_TTL_MINUTES = Number.parseInt(process.env.AUTH_OTP_TTL_MINUTES || "10", 10);
const AUTH_PEPPER = process.env.AUTH_PEPPER || "change-me";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const ALLOWED_CORS_ORIGINS = CORS_ORIGIN === "*"
  ? "*"
  : CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
const ROLE_GLOBAL_ADMIN = "global_admin";
const ROLE_TENANT_ADMIN = "tenant_admin";
const ROLE_MEMBER = "member";
const SEEDED_TENANT_NAME = "Enerkom horní pomoraví";
const SEEDED_GLOBAL_ADMINS = [
  { email: "krobot@enerkom-hp.cz", fullName: "Michal Krobot" },
];
const SEEDED_TENANT_ADMINS = [
  { email: "krobotova@enerkom-hp.cz", fullName: "Krobotova", tenantName: SEEDED_TENANT_NAME },
];

let db;
let mailer;

function corsOriginResolver(origin, callback) {
  if (!origin || ALLOWED_CORS_ORIGINS === "*") {
    callback(null, true);
    return;
  }

  if (ALLOWED_CORS_ORIGINS.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} is not allowed by CORS.`));
}

function hashValue(input) {
  return crypto.createHash("sha256").update(`${input}:${AUTH_PEPPER}`).digest("hex");
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function initDb() {
  db = await open({
    filename: AUTH_DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      tenant_id INTEGER,
      typ TEXT,
      mesto TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      imported_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_otp_user_created ON otp_codes(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_eans (
      user_id INTEGER NOT NULL,
      ean TEXT NOT NULL,
      label TEXT,
      member_name TEXT,
      imported_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, ean),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_eans_user ON user_eans(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_eans_ean ON user_eans(ean);

    CREATE TABLE IF NOT EXISTS tenant_admins (
      tenant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (tenant_id, user_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_admins_user ON tenant_admins(user_id);

    CREATE TABLE IF NOT EXISTS tenant_eans (
      tenant_id INTEGER NOT NULL,
      ean TEXT NOT NULL,
      label TEXT,
      member_name TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      imported_at INTEGER NOT NULL,
      PRIMARY KEY (tenant_id, ean),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tenant_eans_tenant ON tenant_eans(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_eans_public ON tenant_eans(tenant_id, is_public);

    CREATE TABLE IF NOT EXISTS tenant_edc_imports (
      tenant_id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      csv_text TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      producer_count INTEGER NOT NULL,
      consumer_count INTEGER NOT NULL,
      interval_count INTEGER NOT NULL,
      date_from INTEGER NOT NULL,
      date_to INTEGER NOT NULL,
      imported_at INTEGER NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
  `);

  await ensureUserColumns();
  await seedTenantsAndAdmins();
}

async function ensureUserColumns() {
  const columns = await db.all("PRAGMA table_info(users)");
  const columnNames = new Set(columns.map((column) => column.name));
  const alterStatements = [];

  if (!columnNames.has("full_name")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN full_name TEXT");
  }
  if (!columnNames.has("role")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
  }
  if (!columnNames.has("tenant_id")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN tenant_id INTEGER");
  }
  if (!columnNames.has("typ")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN typ TEXT");
  }
  if (!columnNames.has("mesto")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN mesto TEXT");
  }
  if (!columnNames.has("is_active")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  }
  if (!columnNames.has("imported_at")) {
    alterStatements.push("ALTER TABLE users ADD COLUMN imported_at INTEGER");
  }

  for (const statement of alterStatements) {
    await db.exec(statement);
  }
}

async function getTenantById(tenantId) {
  return await db.get("SELECT id, name FROM tenants WHERE id = ?", [tenantId]);
}

async function getOrCreateTenantByName(name) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("Tenant musi mit vyplneny nazev.");
  }

  let tenant = await db.get("SELECT id, name FROM tenants WHERE name = ?", [trimmedName]);
  if (tenant) {
    return tenant;
  }

  const now = Date.now();
  const result = await db.run("INSERT INTO tenants(name, created_at) VALUES(?, ?)", [trimmedName, now]);
  tenant = await db.get("SELECT id, name FROM tenants WHERE id = ?", [result.lastID]);
  return tenant;
}

async function getOrCreateUserByEmail(email, overrides) {
  const now = Date.now();
  const normalizedEmail = normalizeEmail(email);
  let user = await db.get(
    "SELECT id, email, full_name, role, tenant_id, typ, mesto, is_active FROM users WHERE email = ?",
    [normalizedEmail],
  );

  if (!user) {
    const result = await db.run(
      `INSERT INTO users(email, full_name, role, tenant_id, is_active, created_at)
       VALUES(?, ?, ?, ?, 1, ?)`,
      [
        normalizedEmail,
        overrides && overrides.fullName ? overrides.fullName : "",
        overrides && overrides.role ? overrides.role : ROLE_MEMBER,
        overrides && Object.prototype.hasOwnProperty.call(overrides, "tenantId") ? overrides.tenantId : null,
        now,
      ],
    );
    user = await db.get(
      "SELECT id, email, full_name, role, tenant_id, typ, mesto, is_active FROM users WHERE id = ?",
      [result.lastID],
    );
    return user;
  }

  const nextFullName = overrides && Object.prototype.hasOwnProperty.call(overrides, "fullName")
    ? overrides.fullName
    : user.full_name;
  const nextRole = overrides && Object.prototype.hasOwnProperty.call(overrides, "role")
    ? overrides.role
    : user.role;
  const nextTenantId = overrides && Object.prototype.hasOwnProperty.call(overrides, "tenantId")
    ? overrides.tenantId
    : user.tenant_id;

  await db.run(
    `UPDATE users
        SET full_name = ?,
            role = ?,
            tenant_id = ?,
            is_active = 1
      WHERE id = ?`,
    [nextFullName || "", nextRole || ROLE_MEMBER, nextTenantId || null, user.id],
  );

  return await db.get(
    "SELECT id, email, full_name, role, tenant_id, typ, mesto, is_active FROM users WHERE id = ?",
    [user.id],
  );
}

async function ensureTenantAdminAssignment(userId, tenantId) {
  await db.run(
    `INSERT INTO tenant_admins(tenant_id, user_id, created_at)
     VALUES(?, ?, ?)
     ON CONFLICT(tenant_id, user_id) DO NOTHING`,
    [tenantId, userId, Date.now()],
  );
}

async function syncUserRoleFromAssignments(userId) {
  const user = await db.get("SELECT id, role FROM users WHERE id = ?", [userId]);
  if (!user || user.role === ROLE_GLOBAL_ADMIN) {
    return;
  }

  const assignment = await db.get("SELECT COUNT(1) AS c FROM tenant_admins WHERE user_id = ?", [userId]);
  const nextRole = assignment && assignment.c > 0 ? ROLE_TENANT_ADMIN : ROLE_MEMBER;
  await db.run("UPDATE users SET role = ? WHERE id = ?", [nextRole, userId]);
}

async function listTenantsWithAdmins() {
  const tenants = await db.all(
    `SELECT id, name, created_at
       FROM tenants
      ORDER BY name COLLATE NOCASE`,
  );
  const adminRows = await db.all(
    `SELECT ta.tenant_id, u.id AS user_id, u.email, u.full_name
       FROM tenant_admins ta
       JOIN users u ON u.id = ta.user_id
      ORDER BY u.email COLLATE NOCASE`,
  );

  const adminsByTenant = new Map();
  for (const row of adminRows) {
    const existing = adminsByTenant.get(row.tenant_id) || [];
    existing.push({ id: row.user_id, email: row.email, fullName: row.full_name || "" });
    adminsByTenant.set(row.tenant_id, existing);
  }

  return tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.created_at,
    admins: adminsByTenant.get(tenant.id) || [],
  }));
}

async function saveTenantDefinition(input) {
  const now = Date.now();
  const tenantName = String(input && input.name ? input.name : "").trim();
  if (!tenantName) {
    throw new Error("Tenant musi mit nazev.");
  }

  let tenant;
  if (input && input.tenantId) {
    tenant = await getTenantById(Number.parseInt(String(input.tenantId), 10));
    if (!tenant) {
      throw new Error("Tenant neexistuje.");
    }
    await db.run("UPDATE tenants SET name = ? WHERE id = ?", [tenantName, tenant.id]);
    tenant = await getTenantById(tenant.id);
  } else {
    tenant = await getOrCreateTenantByName(tenantName);
  }

  const adminEmails = Array.isArray(input && input.adminEmails)
    ? input.adminEmails
    : String(input && input.adminEmails ? input.adminEmails : "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

  const normalizedEmails = Array.from(new Set(adminEmails.map(normalizeEmail).filter(Boolean)));
  const previousAssignments = await db.all("SELECT user_id FROM tenant_admins WHERE tenant_id = ?", [tenant.id]);
  const previousUserIds = new Set(previousAssignments.map((row) => row.user_id));
  const keptUserIds = new Set();
  const conflicts = [];

  for (const email of normalizedEmails) {
    if (!isValidEmail(email)) {
      conflicts.push(email);
      continue;
    }

    const existing = await db.get("SELECT id, full_name, role, tenant_id FROM users WHERE email = ?", [email]);
    const user = await getOrCreateUserByEmail(email, {
      fullName: existing && existing.full_name ? existing.full_name : "",
      role: existing && existing.role === ROLE_GLOBAL_ADMIN ? ROLE_GLOBAL_ADMIN : ROLE_TENANT_ADMIN,
      tenantId: existing && existing.role === ROLE_GLOBAL_ADMIN ? null : tenant.id,
    });

    if (user.role !== ROLE_GLOBAL_ADMIN) {
      await db.run("DELETE FROM tenant_admins WHERE user_id = ? AND tenant_id <> ?", [user.id, tenant.id]);
      await ensureTenantAdminAssignment(user.id, tenant.id);
      await db.run("UPDATE users SET role = ?, tenant_id = ? WHERE id = ?", [ROLE_TENANT_ADMIN, tenant.id, user.id]);
    }

    keptUserIds.add(user.id);
  }

  for (const previousUserId of previousUserIds) {
    if (!keptUserIds.has(previousUserId)) {
      await db.run("DELETE FROM tenant_admins WHERE tenant_id = ? AND user_id = ?", [tenant.id, previousUserId]);
      await syncUserRoleFromAssignments(previousUserId);
    }
  }

  return {
    tenant,
    conflicts,
    tenants: await listTenantsWithAdmins(),
  };
}

async function seedTenantsAndAdmins() {
  const tenant = await getOrCreateTenantByName(SEEDED_TENANT_NAME);

  for (const admin of SEEDED_GLOBAL_ADMINS) {
    await getOrCreateUserByEmail(admin.email, {
      fullName: admin.fullName,
      role: ROLE_GLOBAL_ADMIN,
      tenantId: null,
    });
  }

  for (const admin of SEEDED_TENANT_ADMINS) {
    const tenantAdmin = await getOrCreateUserByEmail(admin.email, {
      fullName: admin.fullName,
      role: ROLE_TENANT_ADMIN,
      tenantId: tenant.id,
    });
    await ensureTenantAdminAssignment(tenantAdmin.id, tenant.id);
  }
}

function initMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP config missing. OTP codes will be printed to server log.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });
}

async function sendOtpEmail(email, code) {
  const from = process.env.SMTP_FROM || "EDC Login <no-reply@localhost>";
  const subject = "EDC: jednorazovy prihlasovaci kod";
  const text = `Jednorazovy kod pro prihlaseni: ${code}\n\nPlatnost: ${AUTH_OTP_TTL_MINUTES} minut.\nPokud jste o kod nezadali, zpravu ignorujte.`;
  const html = `<p>Jednorazovy kod pro prihlaseni:</p><p style=\"font-size:24px;font-weight:700;letter-spacing:2px\">${code}</p><p>Platnost: ${AUTH_OTP_TTL_MINUTES} minut.</p><p>Pokud jste o kod nezadali, zpravu ignorujte.</p>`;

  if (!mailer) {
    console.log(`[AUTH OTP FALLBACK] ${email}: ${code}`);
    return;
  }

  await mailer.sendMail({ from, to: email, subject, text, html });
}

function parseSemicolonCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ';' && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }

  out.push(current);
  return out;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(value) {
  return normalizeHeader(value).replace(/\s+/g, " ").trim();
}

function normalizeEan(value) {
  return String(value || "").replace(/\D/g, "");
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || "",
    role: user.role || ROLE_MEMBER,
    typ: user.typ || "",
    mesto: user.mesto || "",
    tenantId: user.tenant_id || null,
    tenantName: user.tenant_name || "",
    administeredTenants: Array.isArray(user.administeredTenants) ? user.administeredTenants : [],
  };
}

function serializeAdminMember(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || "",
    role: user.role || ROLE_MEMBER,
    typ: user.typ || "",
    mesto: user.mesto || "",
    isActive: Number(user.is_active) === 1,
    importedAt: user.imported_at || null,
    eans: Array.isArray(user.eans) ? user.eans : [],
    tenantId: user.tenant_id || null,
    tenantName: user.tenant_name || "",
  };
}

function serializeEdcImport(row) {
  if (!row) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    filename: row.filename || "",
    producerCount: Number(row.producer_count) || 0,
    consumerCount: Number(row.consumer_count) || 0,
    intervalCount: Number(row.interval_count) || 0,
    dateFrom: row.date_from || null,
    dateTo: row.date_to || null,
    importedAt: row.imported_at || null,
  };
}

async function getAdministeredTenants(userId) {
  return await db.all(
    `SELECT t.id, t.name
       FROM tenant_admins ta
       JOIN tenants t ON t.id = ta.tenant_id
      WHERE ta.user_id = ?
      ORDER BY t.name COLLATE NOCASE`,
    [userId],
  );
}

async function getActiveUserByEmail(email) {
  return await db.get(
    `SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, u.typ, u.mesto, u.is_active, t.name AS tenant_name
       FROM users u
  LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ? AND u.is_active = 1`,
    [email],
  );
}

function isAdminRole(role) {
  return role === ROLE_GLOBAL_ADMIN || role === ROLE_TENANT_ADMIN;
}

function isGlobalAdminRole(role) {
  return role === ROLE_GLOBAL_ADMIN;
}

function parseMembersCsv(csvText) {
  const lines = String(csvText || "")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Soubor clenove.csv neobsahuje zadna data.");
  }

  const headers = parseSemicolonCsvLine(lines[0]).map(normalizeHeader);
  const nameIndex = headers.indexOf("jmeno clena");
  const emailIndex = headers.indexOf("email");
  const typIndex = headers.indexOf("typ");
  const mestoIndex = headers.indexOf("mesto");

  if (emailIndex < 0) {
    throw new Error("V souboru chybi sloupec email.");
  }

  const members = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = parseSemicolonCsvLine(lines[i]);
    const email = normalizeEmail(parts[emailIndex]);
    if (!email || !isValidEmail(email)) {
      continue;
    }

    members.push({
      email,
      fullName: nameIndex >= 0 ? String(parts[nameIndex] || "").trim() : "",
      typ: typIndex >= 0 ? String(parts[typIndex] || "").trim() : "",
      mesto: mestoIndex >= 0 ? String(parts[mestoIndex] || "").trim() : "",
    });
  }

  return members;
}

function parseEansCsv(csvText) {
  const lines = String(csvText || "")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Soubor EAN neobsahuje zadna data.");
  }

  const headers = parseSemicolonCsvLine(lines[0]).map(normalizeHeader);
  const eanIndex = headers.indexOf("ean");
  const aliasIndex = headers.indexOf("alias");
  const memberNameIndex = headers.indexOf("jmeno clena");
  const publicIndex = headers.findIndex((header) => ["public", "verejny", "is_public"].includes(header));

  if (eanIndex < 0) {
    throw new Error("V souboru chybi sloupec ean.");
  }
  if (memberNameIndex < 0) {
    throw new Error("V souboru chybi sloupec jmeno clena.");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = parseSemicolonCsvLine(lines[i]);
    const ean = normalizeEan(parts[eanIndex]);
    const memberName = String(parts[memberNameIndex] || "").trim();
    const alias = aliasIndex >= 0 ? String(parts[aliasIndex] || "").trim() : "";
    const publicRaw = publicIndex >= 0 ? String(parts[publicIndex] || "").trim().toLowerCase() : "";
    const isPublic = ["1", "true", "ano", "yes", "y"].includes(publicRaw);
    if (!ean || !memberName) {
      continue;
    }

    rows.push({
      ean,
      label: alias || memberName,
      memberName,
      isPublic,
      normalizedMemberName: normalizeName(memberName),
    });
  }

  return rows;
}

function parseKwhValue(input) {
  if (!input || String(input).trim() === "") {
    return 0;
  }

  const parsed = Number.parseFloat(String(input).replaceAll(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEdcDate(parts) {
  if (!Array.isArray(parts) || parts.length < 2) {
    throw new Error("Neplatne datum/cas v EDC souboru.");
  }

  const dateParts = String(parts[0] || "").split(".");
  const timeParts = String(parts[1] || "").split(":");
  if (dateParts.length !== 3 || timeParts.length !== 2) {
    throw new Error("Neplatne datum/cas v EDC souboru.");
  }

  const day = Number.parseInt(dateParts[0], 10);
  const month = Number.parseInt(dateParts[1], 10) - 1;
  const year = Number.parseInt(dateParts[2], 10);
  const hour = Number.parseInt(timeParts[0], 10);
  const minute = Number.parseInt(timeParts[1], 10);
  const parsed = new Date(year, month, day, hour, minute, 0, 0);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Neplatne datum/cas v EDC souboru.");
  }
  return parsed;
}

function parseEdcCsv(csvText, filename) {
  const lines = String(csvText || "")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV je prazdne nebo neobsahuje data.");
  }

  const header = lines[0].split(";");
  if (header[0] !== "Datum" || header[1] !== "Cas od" || header[2] !== "Cas do") {
    throw new Error("Neplatna CSV hlavicka.");
  }

  const producers = [];
  const consumers = [];

  for (let i = 3; i < header.length - 1; i += 2) {
    const before = String(header[i] || "").trim();
    const after = String(header[i + 1] || "").trim();
    if (!before || !after) {
      continue;
    }

    if (!before.startsWith("IN-") || !after.startsWith("OUT-")) {
      throw new Error(`Neplatny par sloupcu: ${before}, ${after}`);
    }

    const beforeId = before.substring(3, before.length - 2);
    const afterId = after.substring(4, after.length - 2);
    if (beforeId !== afterId) {
      throw new Error(`Neshoda IN/OUT EAN: ${before} vs ${after}`);
    }

    const kindSuffix = before.slice(-2);
    if (kindSuffix === "-D") {
      producers.push({ name: beforeId, csvIndex: i });
    } else if (kindSuffix === "-O") {
      consumers.push({ name: beforeId, csvIndex: i });
    }
  }

  if (producers.length === 0) {
    throw new Error("CSV neobsahuje vyrobni EAN (-D).");
  }
  if (consumers.length === 0) {
    throw new Error("CSV neobsahuje odberne EAN (-O).");
  }

  producers.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  consumers.sort((a, b) => a.name.localeCompare(b.name, "cs"));

  const intervals = [];
  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const parts = lines[lineNo].split(";");
    if (parts.length < 3) {
      continue;
    }

    const start = parseEdcDate(parts);
    const intervalProducers = [];
    const intervalConsumers = [];

    for (const producer of producers) {
      let before = parseKwhValue(parts[producer.csvIndex]);
      let after = parseKwhValue(parts[producer.csvIndex + 1]);
      before = Math.max(0, before);
      after = Math.max(0, Math.min(after, before));
      intervalProducers.push({ before, after, missed: 0 });
    }

    for (const consumer of consumers) {
      let before = -parseKwhValue(parts[consumer.csvIndex]);
      let after = -parseKwhValue(parts[consumer.csvIndex + 1]);
      before = Math.max(0, before);
      after = Math.max(0, Math.min(after, before));
      intervalConsumers.push({ before, after, missed: 0 });
    }

    const sumProductionBefore = intervalProducers.reduce((acc, item) => acc + item.before, 0);
    const sumProductionAfter = intervalProducers.reduce((acc, item) => acc + item.after, 0);
    const sumConsumeBefore = intervalConsumers.reduce((acc, item) => acc + item.before, 0);
    const sumConsumeAfter = intervalConsumers.reduce((acc, item) => acc + item.after, 0);
    const sharedByProducers = Math.max(0, sumProductionBefore - sumProductionAfter);
    const sharedByConsumers = Math.max(0, sumConsumeBefore - sumConsumeAfter);
    const shared = Math.min(sharedByProducers, sharedByConsumers);
    const leftoverProduction = sumProductionAfter;
    const unmetConsumption = sumConsumeAfter;
    const missedTotal = leftoverProduction > 0.01 && unmetConsumption > 0.01
      ? Math.min(leftoverProduction, unmetConsumption)
      : 0;

    if (missedTotal > 0) {
      if (leftoverProduction > 0) {
        for (const item of intervalProducers) {
          item.missed = (item.after / leftoverProduction) * missedTotal;
        }
      }
      if (unmetConsumption > 0) {
        for (const item of intervalConsumers) {
          item.missed = (item.after / unmetConsumption) * missedTotal;
        }
      }
    }

    intervals.push({
      start: start.getTime(),
      producers: intervalProducers,
      consumers: intervalConsumers,
      sumProduction: sumProductionBefore,
      sumSharing: shared,
      sumMissed: missedTotal,
    });
  }

  if (intervals.length === 0) {
    throw new Error("CSV neobsahuje platne intervaly.");
  }

  const dateFrom = intervals[0].start;
  const dateTo = intervals[intervals.length - 1].start + (15 * 60 * 1000);

  return {
    filename: String(filename || "edc.csv"),
    producers,
    consumers,
    intervals,
    dateFrom,
    dateTo,
  };
}

async function saveTenantEdcImport(csvText, tenantId, filename) {
  const parsed = parseEdcCsv(csvText, filename);
  const now = Date.now();
  const sourceHash = hashValue(String(csvText || ""));
  const payloadJson = JSON.stringify(parsed);

  await db.run(
    `INSERT INTO tenant_edc_imports(
       tenant_id, filename, source_hash, csv_text, payload_json,
       producer_count, consumer_count, interval_count, date_from, date_to, imported_at
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       filename = excluded.filename,
       source_hash = excluded.source_hash,
       csv_text = excluded.csv_text,
       payload_json = excluded.payload_json,
       producer_count = excluded.producer_count,
       consumer_count = excluded.consumer_count,
       interval_count = excluded.interval_count,
       date_from = excluded.date_from,
       date_to = excluded.date_to,
       imported_at = excluded.imported_at`,
    [
      tenantId,
      parsed.filename,
      sourceHash,
      String(csvText || ""),
      payloadJson,
      parsed.producers.length,
      parsed.consumers.length,
      parsed.intervals.length,
      parsed.dateFrom,
      parsed.dateTo,
      now,
    ],
  );

  const saved = await db.get(
    `SELECT tenant_id, filename, producer_count, consumer_count, interval_count, date_from, date_to, imported_at
       FROM tenant_edc_imports
      WHERE tenant_id = ?`,
    [tenantId],
  );

  return {
    importInfo: serializeEdcImport(saved),
    parsed,
  };
}

async function getTenantEdcImport(tenantId) {
  const row = await db.get(
    `SELECT tenant_id, filename, producer_count, consumer_count, interval_count, date_from, date_to, imported_at
       FROM tenant_edc_imports
      WHERE tenant_id = ?`,
    [tenantId],
  );
  return serializeEdcImport(row);
}

async function importMembersFromCsv(csvText, tenantId) {
  const members = parseMembersCsv(csvText);
  const now = Date.now();
  let importedCount = 0;
  const conflicts = [];

  for (const member of members) {
    const existing = await db.get("SELECT email, role, tenant_id FROM users WHERE email = ?", [member.email]);
    if (existing && existing.tenant_id && Number(existing.tenant_id) !== Number(tenantId) && existing.role !== ROLE_GLOBAL_ADMIN) {
      conflicts.push(member.email);
      continue;
    }

    const nextRole = existing && existing.role !== ROLE_MEMBER ? existing.role : ROLE_MEMBER;
    await db.run(
      `INSERT INTO users(email, full_name, role, tenant_id, typ, mesto, is_active, imported_at, created_at)
       VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         full_name = excluded.full_name,
         tenant_id = CASE WHEN users.role = '${ROLE_GLOBAL_ADMIN}' THEN users.tenant_id ELSE excluded.tenant_id END,
         typ = excluded.typ,
         mesto = excluded.mesto,
         is_active = 1,
         imported_at = excluded.imported_at,
         role = CASE WHEN users.role IN ('${ROLE_GLOBAL_ADMIN}', '${ROLE_TENANT_ADMIN}') THEN users.role ELSE excluded.role END`,
      [member.email, member.fullName, nextRole, tenantId, member.typ, member.mesto, now, now],
    );
    importedCount += 1;
  }

  return { importedCount, members, conflicts };
}

async function importEansFromCsv(csvText, tenantId) {
  const rows = parseEansCsv(csvText);
  const users = await db.all("SELECT id, full_name FROM users WHERE is_active = 1 AND tenant_id = ?", [tenantId]);
  const usersByName = new Map();

  for (const user of users) {
    const key = normalizeName(user.full_name || "");
    if (!key) {
      continue;
    }
    const existing = usersByName.get(key) || [];
    existing.push(user);
    usersByName.set(key, existing);
  }

  const now = Date.now();
  let mappedCount = 0;
  const unmatchedMemberNames = new Set();

  await db.run("BEGIN TRANSACTION");
  try {
    for (const row of rows) {
      await db.run(
        `INSERT INTO tenant_eans(tenant_id, ean, label, member_name, is_public, imported_at)
         VALUES(?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, ean) DO UPDATE SET
           label = excluded.label,
           member_name = excluded.member_name,
           is_public = excluded.is_public,
           imported_at = excluded.imported_at`,
        [tenantId, row.ean, row.label, row.memberName, row.isPublic ? 1 : 0, now],
      );

      const matchedUsers = usersByName.get(row.normalizedMemberName) || [];
      if (matchedUsers.length === 0) {
        unmatchedMemberNames.add(row.memberName);
        continue;
      }

      for (const user of matchedUsers) {
        await db.run(
          `INSERT INTO user_eans(user_id, ean, label, member_name, imported_at)
           VALUES(?, ?, ?, ?, ?)
           ON CONFLICT(user_id, ean) DO UPDATE SET
             label = excluded.label,
             member_name = excluded.member_name,
             imported_at = excluded.imported_at`,
          [user.id, row.ean, row.label, row.memberName, now],
        );
        mappedCount += 1;
      }
    }
    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK");
    throw err;
  }

  return {
    totalRows: rows.length,
    mappedCount,
    unmatchedMemberNames: Array.from(unmatchedMemberNames).sort((a, b) => a.localeCompare(b, "cs")),
  };
}

function buildMaskedEan(rawEan, usedValues) {
  const normalized = normalizeEan(rawEan);
  if (!normalized) {
    return "*";
  }

  const first = normalized.slice(0, 1);
  const last4 = normalized.slice(-4);
  const baseStars = Math.max(1, normalized.length - 5);
  let extraStars = 0;

  while (true) {
    const masked = `${first}${"*".repeat(baseStars + extraStars)}${last4}`;
    if (!usedValues.has(masked)) {
      usedValues.add(masked);
      return masked;
    }
    extraStars += 1;
  }
}

async function buildMemberSharingData(userId, tenantId) {
  const importRow = await db.get(
    `SELECT payload_json, filename
       FROM tenant_edc_imports
      WHERE tenant_id = ?`,
    [tenantId],
  );

  if (!importRow || !importRow.payload_json) {
    throw new Error("Pro tento tenant zatim nejsou ulozena EDC data.");
  }

  let payload;
  try {
    payload = JSON.parse(importRow.payload_json);
  } catch {
    throw new Error("Ulozena EDC data se nepodarilo nacist.");
  }

  const rawProducers = Array.isArray(payload.producers) ? payload.producers : [];
  const rawConsumers = Array.isArray(payload.consumers) ? payload.consumers : [];
  const rawIntervals = Array.isArray(payload.intervals) ? payload.intervals : [];

  const assignedRows = await db.all("SELECT ean, label, member_name FROM user_eans WHERE user_id = ?", [userId]);
  const assignedSet = new Set(assignedRows.map((row) => normalizeEan(row.ean)).filter(Boolean));
  const assignedMetaByEan = new Map();
  for (const row of assignedRows) {
    const key = normalizeEan(row.ean);
    if (!key) {
      continue;
    }
    assignedMetaByEan.set(key, {
      label: String(row.label || row.member_name || "").trim(),
    });
  }
  if (assignedSet.size === 0) {
    throw new Error("Uzivatel nema prirazene zadne EAN.");
  }

  const producerNames = rawProducers.map((item) => normalizeEan(item.name));
  const consumerNames = rawConsumers.map((item) => normalizeEan(item.name));
  const producerNameSet = new Set(producerNames);
  const consumerNameSet = new Set(consumerNames);

  const hasAssignedProducer = Array.from(assignedSet).some((ean) => producerNameSet.has(ean));
  const hasAssignedConsumer = Array.from(assignedSet).some((ean) => consumerNameSet.has(ean));

  if (!hasAssignedProducer && !hasAssignedConsumer) {
    throw new Error("Prirazene EAN uzivatele se v aktualnich EDC datech nevyskytuji.");
  }

  const selectedProducerIndexes = rawProducers.map((_producer, index) => index);
  const selectedConsumerIndexes = rawConsumers.map((_consumer, index) => index);

  const tenantEans = await db.all(
    "SELECT ean, label, member_name, is_public FROM tenant_eans WHERE tenant_id = ?",
    [tenantId],
  );
  const metaByEan = new Map();
  for (const row of tenantEans) {
    const key = normalizeEan(row.ean);
    if (!key) {
      continue;
    }
    const existing = metaByEan.get(key);
    const incomingLabel = String(row.label || row.member_name || "").trim();
    metaByEan.set(key, {
      label: incomingLabel || (existing ? existing.label : ""),
      isPublic: Number(row.is_public) === 1,
    });
  }

  const allSelectedRawEans = new Set([
    ...selectedProducerIndexes.map((index) => normalizeEan(rawProducers[index].name)),
    ...selectedConsumerIndexes.map((index) => normalizeEan(rawConsumers[index].name)),
  ]);

  const maskedValues = new Set();
  const displayByRawEan = new Map();
  const eanLabels = {};

  for (const rawEan of allSelectedRawEans) {
    const meta = metaByEan.get(rawEan);
    const assignedMeta = assignedMetaByEan.get(rawEan);
    const canShowIdentity = assignedSet.has(rawEan);
    if (canShowIdentity) {
      displayByRawEan.set(rawEan, rawEan);
      const preferredLabel = (assignedMeta && assignedMeta.label) || (meta && meta.label) || "";
      if (preferredLabel) {
        eanLabels[rawEan] = preferredLabel;
      }
    } else {
      displayByRawEan.set(rawEan, buildMaskedEan(rawEan, maskedValues));
    }
  }

  const producers = selectedProducerIndexes.map((originalIndex, idx) => {
    const rawName = normalizeEan(rawProducers[originalIndex].name);
    return {
      name: displayByRawEan.get(rawName) || buildMaskedEan(rawName, maskedValues),
      csvIndex: idx,
    };
  });

  const consumers = selectedConsumerIndexes.map((originalIndex, idx) => {
    const rawName = normalizeEan(rawConsumers[originalIndex].name);
    return {
      name: displayByRawEan.get(rawName) || buildMaskedEan(rawName, maskedValues),
      csvIndex: idx,
    };
  });

  const intervals = rawIntervals.map((interval) => {
    const rawIntervalProducers = Array.isArray(interval.producers) ? interval.producers : [];
    const rawIntervalConsumers = Array.isArray(interval.consumers) ? interval.consumers : [];

    const nextProducers = selectedProducerIndexes.map((originalIndex) => {
      const source = rawIntervalProducers[originalIndex] || { before: 0, after: 0, missed: 0 };
      return {
        before: Number(source.before) || 0,
        after: Number(source.after) || 0,
        missed: Number(source.missed) || 0,
      };
    });

    const nextConsumers = selectedConsumerIndexes.map((originalIndex) => {
      const source = rawIntervalConsumers[originalIndex] || { before: 0, after: 0, missed: 0 };
      return {
        before: Number(source.before) || 0,
        after: Number(source.after) || 0,
        missed: Number(source.missed) || 0,
      };
    });

    const sumProduction = nextProducers.reduce((acc, item) => acc + item.before, 0);
    const sumSharing = Math.min(
      Math.max(0, sumProduction - nextProducers.reduce((acc, item) => acc + item.after, 0)),
      Math.max(0, nextConsumers.reduce((acc, item) => acc + item.before, 0) - nextConsumers.reduce((acc, item) => acc + item.after, 0)),
    );
    const sumMissed = Math.min(
      Math.max(0, nextProducers.reduce((acc, item) => acc + item.after, 0)),
      Math.max(0, nextConsumers.reduce((acc, item) => acc + item.after, 0)),
    );

    return {
      start: Number(interval.start) || 0,
      producers: nextProducers,
      consumers: nextConsumers,
      sumProduction,
      sumSharing,
      sumMissed,
    };
  });

  const ownProducerNames = rawProducers
    .map((producer) => normalizeEan(producer.name))
    .filter((ean) => assignedSet.has(ean))
    .map((ean) => displayByRawEan.get(ean) || ean);

  const ownConsumerNames = rawConsumers
    .map((consumer) => normalizeEan(consumer.name))
    .filter((ean) => assignedSet.has(ean))
    .map((ean) => displayByRawEan.get(ean) || ean);

  return {
    data: {
      filename: payload.filename || importRow.filename || "server-edc.csv",
      producers,
      consumers,
      intervals,
      dateFrom: Number(payload.dateFrom) || (intervals[0] ? intervals[0].start : Date.now()),
      dateTo: Number(payload.dateTo) || (intervals.length > 0 ? intervals[intervals.length - 1].start : Date.now()),
    },
    eanLabels,
    memberScope: {
      ownProducers: Array.from(new Set(ownProducerNames)),
      ownConsumers: Array.from(new Set(ownConsumerNames)),
    },
  };
}

async function authMiddleware(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Missing auth token." });
    return;
  }

  const tokenHash = hashValue(token);
  const now = Date.now();
  const row = await db.get(
    `SELECT s.token_hash, s.user_id, u.email, u.full_name, u.role, u.tenant_id, u.typ, u.mesto, u.is_active, t.name AS tenant_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
  LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL`,
    [tokenHash],
  );

  if (!row || Number(row.is_active) !== 1) {
    res.status(401).json({ error: "Invalid session." });
    return;
  }

  await db.run("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", [now, tokenHash]);
  req.auth = {
    tokenHash,
    id: row.user_id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name || "",
    role: row.role || ROLE_MEMBER,
    tenant_id: row.tenant_id || null,
    tenant_name: row.tenant_name || "",
    typ: row.typ || "",
    mesto: row.mesto || "",
  };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.auth || !isAdminRole(req.auth.role)) {
    res.status(403).json({ error: "Pristup pouze pro administratora." });
    return;
  }
  next();
}

function requireGlobalAdmin(req, res, next) {
  if (!req.auth || !isGlobalAdminRole(req.auth.role)) {
    res.status(403).json({ error: "Pristup pouze pro globalniho administratora." });
    return;
  }
  next();
}

async function resolveTenantScope(req, requestedTenantId) {
  if (!req.auth) {
    throw new Error("Missing auth context.");
  }

  if (isGlobalAdminRole(req.auth.role)) {
    if (!requestedTenantId) {
      throw new Error("Vyber tenant.");
    }
    const tenant = await getTenantById(Number.parseInt(String(requestedTenantId), 10));
    if (!tenant) {
      throw new Error("Zvoleny tenant neexistuje.");
    }
    return tenant;
  }

  const administeredTenants = await getAdministeredTenants(req.auth.userId);
  if (administeredTenants.length === 0) {
    if (req.auth.tenant_id) {
      const tenant = await getTenantById(req.auth.tenant_id);
      if (tenant) {
        return tenant;
      }
    }
    throw new Error("Administrator nema prirazen zadny tenant.");
  }

  return administeredTenants[0];
}

async function start() {
  await initDb();
  mailer = initMailer();

  const app = express();

  app.use(helmet());
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "20mb" }));
  app.use(
    cors({
      origin: corsOriginResolver,
      credentials: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, now: new Date().toISOString(), baseUrl: AUTH_BASE_URL });
  });

  app.post("/api/auth/request-otp", async (req, res) => {
    try {
      const email = normalizeEmail(req.body && req.body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Zadej platny e-mail." });
        return;
      }

      const now = Date.now();
      const user = await getActiveUserByEmail(email);
      if (!user) {
        res.status(403).json({ error: "Tento e-mail nema pristup do aplikace." });
        return;
      }
      const recentCount = await db.get(
        "SELECT COUNT(1) AS c FROM otp_codes WHERE user_id = ? AND created_at >= ?",
        [user.id, now - 60 * 1000],
      );
      if ((recentCount && recentCount.c) > 0) {
        res.status(429).json({ error: "Kod byl nedavno odeslan. Zkus to za chvili." });
        return;
      }

      const code = generateOtpCode();
      const codeHash = hashValue(`${email}:${code}`);
      const expiresAt = now + AUTH_OTP_TTL_MINUTES * 60 * 1000;

      await db.run(
        "INSERT INTO otp_codes(user_id, code_hash, expires_at, used_at, created_at) VALUES(?, ?, ?, NULL, ?)",
        [user.id, codeHash, expiresAt, now],
      );

      await sendOtpEmail(email, code);

      res.json({ message: "Kod byl odeslan na e-mail.", ttlMinutes: AUTH_OTP_TTL_MINUTES });
    } catch (err) {
      console.error("request-otp failed", err);
      res.status(500).json({ error: "Nepodarilo se odeslat kod." });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const email = normalizeEmail(req.body && req.body.email);
      const code = String((req.body && req.body.code) || "").trim();

      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        res.status(400).json({ error: "Neplatny e-mail nebo kod." });
        return;
      }

      const user = await getActiveUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Kod je neplatny nebo expirovany." });
        return;
      }

      const now = Date.now();
      const codeHash = hashValue(`${email}:${code}`);
      const otp = await db.get(
        `SELECT id, expires_at, used_at
           FROM otp_codes
          WHERE user_id = ? AND code_hash = ?
          ORDER BY created_at DESC
          LIMIT 1`,
        [user.id, codeHash],
      );

      if (!otp || otp.used_at || otp.expires_at < now) {
        res.status(401).json({ error: "Kod je neplatny nebo expirovany." });
        return;
      }

      await db.run("UPDATE otp_codes SET used_at = ? WHERE id = ?", [now, otp.id]);

      const token = generateSessionToken();
      const tokenHash = hashValue(token);
      await db.run(
        "INSERT INTO sessions(token_hash, user_id, created_at, last_seen_at, revoked_at) VALUES(?, ?, ?, ?, NULL)",
        [tokenHash, user.id, now, now],
      );

      const administeredTenants = await getAdministeredTenants(user.id);
      res.json({ token, user: serializeUser({ ...user, administeredTenants }) });
    } catch (err) {
      console.error("verify-otp failed", err);
      res.status(500).json({ error: "Nepodarilo se overit kod." });
    }
  });

  app.get("/api/auth/session", authMiddleware, async (req, res) => {
    const administeredTenants = await getAdministeredTenants(req.auth.userId);
    res.json({ user: serializeUser({ ...req.auth, administeredTenants }) });
  });

  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    await db.run("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?", [Date.now(), req.auth.tokenHash]);
    res.json({ ok: true });
  });

  app.get("/api/member/sharing-data", authMiddleware, async (req, res) => {
    try {
      if (!req.auth || !req.auth.tenant_id) {
        res.status(403).json({ error: "Uzivatel nema prirazeny tenant." });
        return;
      }

      const payload = await buildMemberSharingData(req.auth.userId, req.auth.tenant_id);
      res.json(payload);
    } catch (err) {
      console.error("member-sharing-data failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Nepodarilo se nacist data pro clena." });
    }
  });

  app.post("/api/admin/import-members", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const csvText = String((req.body && req.body.csvText) || "");
      if (!csvText.trim()) {
        res.status(400).json({ error: "CSV soubor je prazdny." });
        return;
      }

      const tenant = await resolveTenantScope(req, req.body && req.body.tenantId);
      const result = await importMembersFromCsv(csvText, tenant.id);
      res.json({
        ok: true,
        importedCount: result.importedCount,
        conflicts: result.conflicts,
        message: result.conflicts.length > 0
          ? `Naimportovano ${result.importedCount} clenu do tenanta ${tenant.name}. Konfliktu: ${result.conflicts.length}.`
          : `Naimportovano ${result.importedCount} clenu do tenanta ${tenant.name}.`,
      });
    } catch (err) {
      console.error("import-members failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Import selhal." });
    }
  });

  app.post("/api/admin/import-eans", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const csvText = String((req.body && req.body.csvText) || "");
      if (!csvText.trim()) {
        res.status(400).json({ error: "CSV soubor je prazdny." });
        return;
      }

      const tenant = await resolveTenantScope(req, req.body && req.body.tenantId);
      const result = await importEansFromCsv(csvText, tenant.id);
      const unmatchedCount = result.unmatchedMemberNames.length;
      const message = unmatchedCount > 0
        ? `Naimportovano ${result.mappedCount} vazeb EAN do tenanta ${tenant.name}. Nespárováno jmen: ${unmatchedCount}.`
        : `Naimportovano ${result.mappedCount} vazeb EAN do tenanta ${tenant.name}.`;

      res.json({
        ok: true,
        totalRows: result.totalRows,
        mappedCount: result.mappedCount,
        unmatchedMemberNames: result.unmatchedMemberNames,
        message,
      });
    } catch (err) {
      console.error("import-eans failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Import EAN selhal." });
    }
  });

  app.get("/api/admin/edc-import", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const tenant = await resolveTenantScope(req, req.query ? req.query.tenantId : null);
      const importInfo = await getTenantEdcImport(tenant.id);
      res.json({ tenant, importInfo });
    } catch (err) {
      console.error("get-edc-import failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Nepodarilo se nacist EDC import." });
    }
  });

  app.post("/api/admin/import-edc", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const csvText = String((req.body && req.body.csvText) || "");
      if (!csvText.trim()) {
        res.status(400).json({ error: "CSV soubor je prazdny." });
        return;
      }

      const tenant = await resolveTenantScope(req, req.body && req.body.tenantId);
      const filename = req.body && typeof req.body.filename === "string" ? req.body.filename : "edc.csv";
      const result = await saveTenantEdcImport(csvText, tenant.id, filename);
      res.json({
        ok: true,
        importInfo: result.importInfo,
        message: `EDC data pro tenant ${tenant.name} byla ulozena na server.`,
      });
    } catch (err) {
      console.error("import-edc failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Import EDC selhal." });
    }
  });

  app.get("/api/admin/tenants", authMiddleware, requireGlobalAdmin, async (_req, res) => {
    try {
      res.json({ tenants: await listTenantsWithAdmins() });
    } catch (err) {
      console.error("list-tenants failed", err);
      res.status(500).json({ error: "Nepodarilo se nacist tenanty." });
    }
  });

  app.post("/api/admin/tenants", authMiddleware, requireGlobalAdmin, async (req, res) => {
    try {
      const result = await saveTenantDefinition(req.body || {});
      res.json({
        ok: true,
        tenant: result.tenant,
        conflicts: result.conflicts,
        tenants: result.tenants,
        message: result.conflicts.length > 0
          ? `Tenant ${result.tenant.name} ulozen. Konfliktu pri prirazeni adminu: ${result.conflicts.length}.`
          : `Tenant ${result.tenant.name} byl ulozen.`,
      });
    } catch (err) {
      console.error("save-tenant failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Ulozeni tenanta selhalo." });
    }
  });

  app.get("/api/admin/members", authMiddleware, requireAdmin, async (_req, res) => {
    try {
      const requestedTenantId = _req.query ? _req.query.tenantId : null;
      const tenant = await resolveTenantScope(_req, requestedTenantId);
      const members = await db.all(
        `SELECT id, email, full_name, role, tenant_id, ? AS tenant_name, typ, mesto, is_active, imported_at
           FROM users
          WHERE is_active = 1 AND tenant_id = ?
          ORDER BY
            CASE WHEN role = '${ROLE_TENANT_ADMIN}' THEN 0 ELSE 1 END,
            COALESCE(full_name, email) COLLATE NOCASE,
            email COLLATE NOCASE`,
        [tenant.name, tenant.id],
      );

      const links = await db.all(
        `SELECT ue.user_id, ue.ean, ue.label, ue.member_name
           FROM user_eans ue
           JOIN users u ON u.id = ue.user_id
          WHERE u.tenant_id = ?
          ORDER BY ue.member_name COLLATE NOCASE, ue.ean`,
        [tenant.id],
      );

      const linksByUserId = new Map();
      for (const link of links) {
        const existing = linksByUserId.get(link.user_id) || [];
        existing.push({
          ean: link.ean,
          label: link.label || "",
          memberName: link.member_name || "",
        });
        linksByUserId.set(link.user_id, existing);
      }

      const enrichedMembers = members.map((member) => ({
        ...member,
        eans: linksByUserId.get(member.id) || [],
      }));

      res.json({ tenant, members: enrichedMembers.map(serializeAdminMember) });
    } catch (err) {
      console.error("list-members failed", err);
      res.status(500).json({ error: "Nepodarilo se nacist seznam clenu." });
    }
  });

  app.get("/api/admin/member-sharing-data", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const requestedTenantId = req.query ? req.query.tenantId : null;
      const requestedMemberId = req.query ? req.query.memberId : null;

      if (!requestedMemberId) {
        res.status(400).json({ error: "Chybi parametr memberId." });
        return;
      }

      const tenant = await resolveTenantScope(req, requestedTenantId);
      const memberId = Number.parseInt(String(requestedMemberId), 10);

      const member = await db.get(
        "SELECT id, tenant_id FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1",
        [memberId, tenant.id],
      );

      if (!member) {
        res.status(403).json({ error: "Clen neexistuje v teto tenanta nebo neni aktivni." });
        return;
      }

      const payload = await buildMemberSharingData(memberId, tenant.id);
      res.json(payload);
    } catch (err) {
      console.error("admin-member-sharing-data failed", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Nepodarilo se nacist data clena." });
    }
  });

  app.listen(PORT, () => {
    console.log(`Auth backend listening on ${AUTH_BASE_URL}`);
  });
}

start().catch((err) => {
  console.error("Failed to start auth backend", err);
  process.exit(1);
});
