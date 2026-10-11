
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";

import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";

import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";

import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
const DB_FILE = path.join(DATA_DIR, "oauth.json");

const ACCESS_TTL = 60 * 60 * 1000;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;

type PendingRequest = {
  clientId: string;
  redirectUri: string;
  state?: string;
  challenge: string;
  scopes: string[];
  resource?: string;
  exp: number;
};

type CodeRecord = Omit<PendingRequest, "state">;

type TokenRecord = {
  clientId: string;
  scopes: string[];
  resource?: string;
  exp: number;
};

type Db = {
  clients: Record<string, OAuthClientInformationFull>;
  pending: Record<string, PendingRequest>;
  codes: Record<string, CodeRecord>;
  access: Record<string, TokenRecord>;
  refresh: Record<string, TokenRecord>;
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const emptyDb = (): Db => ({
  clients: {},
  pending: {},
  codes: {},
  access: {},
  refresh: {},
});

const db: Db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
  : emptyDb();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), {
    mode: 0o600,
  });
}

const now = () => Date.now();
const randomToken = () => crypto.randomBytes(32).toString("hex");
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export function safeEqual(a = "", b = "") {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

function redirectAllowed(uri: string) {
  try {
    const url = new URL(uri);

    if (
      url.protocol === "https:" &&
      ["claude.ai", "claude.com"].includes(url.hostname)
    ) {
      return true;
    }

    if (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      return true;
    }
  } catch {
    // Invalid URL
  }

  return false;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });

export function consentPage(
  id: string,
  clientName: string,
  error = "",
) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize MCP File Server</title>
</head>
<body style="font-family:system-ui;max-width:420px;margin:12vh auto;padding:0 16px">
<h2>Authorize "${escapeHtml(clientName)}"</h2>
<p>This client is requesting access to your MCP file server workspace.</p>
${error ? `<p style="color:#b00">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/consent">
<input type="hidden" name="id" value="${escapeHtml(id)}">
<label for="password">Owner password</label>
<input id="password" type="password" name="password" required autocomplete="current-password" style="display:block;width:100%;padding:8px;box-sizing:border-box;margin-top:8px">
<button type="submit" style="margin-top:12px;padding:8px 16px">Approve</button>
</form>
</body>
</html>`;
}

export class FileServerOAuthProvider implements OAuthServerProvider {
  clientsStore: OAuthRegisteredClientsStore = {
    getClient: (id: string) => db.clients[id],

    registerClient: (client: OAuthClientInformationFull) => {
      for (const uri of client.redirect_uris ?? []) {
        if (!redirectAllowed(String(uri))) {
          throw new Error("Redirect URI is not allowed");
        }
      }

      db.clients[client.client_id] = client;
      saveDb();
      return client;
    },
  };

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ) {
    const id = randomToken();

    db.pending[id] = {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      state: params.state,
      challenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      resource: params.resource?.href,
      exp: now() + 10 * 60 * 1000,
    };

    saveDb();
    res.type("html").send(
      consentPage(id, client.client_name ?? client.client_id),
    );
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ) {
    const record = db.codes[code];

    if (
      !record ||
      record.clientId !== client.client_id ||
      record.exp < now()
    ) {
      throw new Error("invalid_grant");
    }

    return record.challenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ): Promise<OAuthTokens> {
    const record = db.codes[code];

    if (
      !record ||
      record.clientId !== client.client_id ||
      record.exp < now()
    ) {
      throw new Error("invalid_grant");
    }

    delete db.codes[code];
    saveDb();

    return this.issue(
      record.clientId,
      record.scopes,
      record.resource,
    );
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const key = hash(refreshToken);
    const record = db.refresh[key];

    if (
      !record ||
      record.clientId !== client.client_id ||
      record.exp < now()
    ) {
      throw new Error("invalid_grant");
    }

    delete db.refresh[key];
    saveDb();

    return this.issue(
      record.clientId,
      record.scopes,
      record.resource,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = db.access[hash(token)];

    if (!record || record.exp < now()) {
      throw new Error("invalid_token");
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.exp / 1000),
      resource: record.resource
        ? new URL(record.resource)
        : undefined,
    };
  }

  private issue(
    clientId: string,
    scopes: string[],
    resource?: string,
  ): OAuthTokens {
    const accessToken = randomToken();
    const refreshToken = randomToken();

    db.access[hash(accessToken)] = {
      clientId,
      scopes,
      resource,
      exp: now() + ACCESS_TTL,
    };

    db.refresh[hash(refreshToken)] = {
      clientId,
      scopes,
      resource,
      exp: now() + REFRESH_TTL,
    };

    saveDb();

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TTL / 1000,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }

  approve(req: Request, res: Response) {
    const { id, password } = req.body ?? {};
    const pending = typeof id === "string" ? db.pending[id] : undefined;

    if (!pending || pending.exp < now()) {
      res.status(400).send(
        "Authorization request expired. Start again from your MCP client.",
      );
      return;
    }

    if (
      typeof password !== "string" ||
      !safeEqual(password, process.env.OWNER_PASSWORD ?? "")
    ) {
      res.status(401).type("html").send(
        consentPage(
          id,
          db.clients[pending.clientId]?.client_name ??
            pending.clientId,
          "Incorrect password.",
        ),
      );
      return;
    }

    delete db.pending[id];

    const code = randomToken();

    db.codes[code] = {
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      challenge: pending.challenge,
      scopes: pending.scopes,
      resource: pending.resource,
      exp: now() + 5 * 60 * 1000,
    };

    saveDb();

    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set("code", code);

    if (pending.state) {
      redirectUrl.searchParams.set("state", pending.state);
    }

    res.redirect(redirectUrl.href);
  }
}
