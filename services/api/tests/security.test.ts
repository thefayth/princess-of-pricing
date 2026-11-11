import assert from "node:assert/strict";
import { afterEach, mock, test, type TestContext } from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/pop_test";
process.env.JWT_SECRET = "api-security-regression-test-key-only";
process.env.CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
process.env.API_PREFIX = "/api/v1";

const { buildApp }: typeof import("../src/app") = require("../src/app");
const { prisma }: typeof import("../src/lib/prisma") = require("../src/lib/prisma");
const { encryptConnectorValue }: typeof import("../src/services/connector-crypto") = require("../src/services/connector-crypto");
const { scanGmailMetadata }: typeof import("../src/services/gmail-service") = require("../src/services/gmail-service");

const workspaceId = "workspace-issued";
const otherWorkspaceId = "workspace-other";
const devicePublicId = "desktop-test";
const deviceToken = "popd_regression-test-only";
const user = { sub: "user-test", email: "test@example.invalid", fullName: "API Test" };
const syncBody = { devicePublicId, entityType: "BrowserObservation", entityId: "observation-test", operation: "APPEND", payload: { title: "Test observation" } };

const restorations: Array<() => void> = [];

// Prisma delegates are proxies without method descriptors for mock.method.
function stub<T extends object, K extends keyof T>(target: T, key: K, implementation: (...args: any[]) => any) {
  const original = target[key];
  const replacement = mock.fn(implementation);
  target[key] = replacement as unknown as T[K];
  restorations.push(() => { target[key] = original; });
  return replacement;
}

afterEach(() => {
  for (const restore of restorations.reverse()) restore();
  restorations.length = 0;
  mock.restoreAll();
});

async function appFor(t: TestContext) {
  const app = await buildApp();
  app.log.level = "silent";
  t.after(() => app.close());
  return app;
}

function mockMembership() {
  return stub(prisma.workspaceMember, "findUnique", async ({ where }: any) => ({ role: "OWNER", workspace: { id: where.workspaceId_userId.workspaceId, name: "Test workspace" } }));
}

function mockDevice(state: "active" | "revoked" | "expired" = "active") {
  stub(prisma.popDevice, "findFirst", async ({ where }: any) => {
    assert.equal(where.revokedAt, null);
    assert.ok(where.tokenExpiresAt.gt instanceof Date);
    return state === "active" ? { id: "device-test", workspaceId, publicId: devicePublicId, userId: user.sub, user: { email: user.email, fullName: user.fullName } } : null;
  });
  return stub(prisma.popDevice, "update", async () => ({}));
}

function mockSync() {
  stub(prisma.idempotencyRecord, "findUnique", async () => null);
  stub(prisma.idempotencyRecord, "create", async () => ({}));
  return stub(prisma.syncEvent, "create", async ({ data }: any) => ({ id: "sync-test", ...data }));
}

test("paired desktop can sync its own records in its issuing workspace", async (t) => {
  const seen = mockDevice();
  mockMembership();
  const created = mockSync();
  const app = await appFor(t);
  const response = await app.inject({ method: "POST", url: `/api/v1/workspaces/${workspaceId}/pop/sync-events?view=latest`, headers: { authorization: `Bearer ${deviceToken}`, "idempotency-key": "sync-test-key" }, payload: syncBody });
  assert.equal(response.statusCode, 202);
  assert.equal(response.json().event.workspaceId, workspaceId);
  assert.equal(created.mock.callCount(), 1);
  assert.equal(seen.mock.callCount(), 1);
});

for (const [method, path] of [
  ["POST", `/workspaces/${otherWorkspaceId}/pop/sync-events`],
  ["POST", "/workspaces/workspace-%6fther/pop/sync-events"],
  ["GET", `/workspaces/${workspaceId}/accounts`],
  ["POST", `/workspaces/${workspaceId}/accounts`],
  ["GET", `/workspaces/${otherWorkspaceId}/accounts`],
  ["GET", `/workspaces/${workspaceId}/bank-accounts`],
  ["GET", `/workspaces/${workspaceId}/journal-entries`],
  ["GET", `/workspaces/${workspaceId}/pop/dashboard`],
  ["POST", `/workspaces/${workspaceId}/pop/device-pairings`],
  ["POST", `/workspaces/${workspaceId}/pop/connectors/gmail`],
  ["GET", "/me"],
  ["GET", "/workspaces"],
] as const) {
  test(`device token cannot call ${method} ${path}`, async (t) => {
    const seen = mockDevice();
    const memberships = mockMembership();
    const created = mockSync();
    stub(prisma.account, "findMany", async () => []);
    const app = await appFor(t);
    const response = await app.inject({ method, url: `/api/v1${path}`, headers: { authorization: `Bearer ${deviceToken}`, "idempotency-key": "denied-test-key" }, ...(method === "POST" ? { payload: syncBody } : {}) });
    assert.equal(response.statusCode, 403);
    assert.equal(memberships.mock.callCount(), 0);
    assert.equal(created.mock.callCount(), 0);
    assert.equal(seen.mock.callCount(), 0);
  });
}

for (const state of ["revoked", "expired"] as const) {
  test(`${state} device token cannot sync`, async (t) => {
    const seen = mockDevice(state);
    const app = await appFor(t);
    const response = await app.inject({ method: "POST", url: `/api/v1/workspaces/${workspaceId}/pop/sync-events`, headers: { authorization: `Bearer ${deviceToken}` }, payload: syncBody });
    assert.equal(response.statusCode, 401);
    assert.equal(seen.mock.callCount(), 0);
  });
}

test("device cannot sync another device's records", async (t) => {
  mockDevice();
  mockMembership();
  const created = mockSync();
  const app = await appFor(t);
  const response = await app.inject({ method: "POST", url: `/api/v1/workspaces/${workspaceId}/pop/sync-events`, headers: { authorization: `Bearer ${deviceToken}`, "idempotency-key": "mismatch-test-key" }, payload: { ...syncBody, devicePublicId: "desktop-other" } });
  assert.equal(response.statusCode, 403);
  assert.equal(created.mock.callCount(), 0);
});

test("normal JWTs retain accounting access to both member workspaces", async (t) => {
  mockMembership();
  stub(prisma.account, "findMany", async () => []);
  const app = await appFor(t);
  const token = app.jwt.sign(user);
  for (const id of [workspaceId, otherWorkspaceId]) {
    const response = await app.inject({ method: "GET", url: `/api/v1/workspaces/${id}/accounts`, headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { accounts: [] });
  }
  const anonymous = await app.inject({ method: "GET", url: `/api/v1/workspaces/${workspaceId}/accounts` });
  assert.equal(anonymous.statusCode, 401);
});

function mockPairing(options: { concurrent?: boolean; failCreateOnce?: boolean; expireAfterRead?: boolean; consumed?: boolean; expired?: boolean } = {}) {
  const pairing = { id: "pairing-test", workspaceId, userId: user.sub, consumedAt: options.consumed ? new Date() : null as Date | null, expiresAt: new Date(Date.now() + (options.expired ? -60_000 : 60_000)) };
  let reads = 0;
  let creates = 0;
  let release!: () => void;
  const bothRead = new Promise<void>((resolve) => { release = resolve; });
  const findFirst = async () => {
    if (pairing.consumedAt || pairing.expiresAt <= new Date()) return null;
    const snapshot = { ...pairing };
    if (options.concurrent) {
      reads += 1;
      if (reads === 2) release();
      await bothRead;
    }
    if (options.expireAfterRead) pairing.expiresAt = new Date(0);
    return snapshot;
  };
  const outsideRead = stub(prisma.devicePairing, "findFirst", findFirst);
  stub(prisma, "$transaction", async (run: any) => {
    let claimed = false;
    try {
      return await run({
        devicePairing: {
          findFirst,
          update: async ({ data }: any) => { claimed = true; pairing.consumedAt = data.consumedAt; return pairing; },
          updateMany: async ({ where, data }: any) => {
            assert.equal(where.id, pairing.id);
            assert.equal(where.consumedAt, null);
            assert.ok(where.expiresAt.gt instanceof Date);
            if (pairing.consumedAt || pairing.expiresAt <= where.expiresAt.gt) return { count: 0 };
            claimed = true;
            pairing.consumedAt = data.consumedAt;
            return { count: 1 };
          },
        },
        popDevice: { create: async ({ data }: any) => {
          creates += 1;
          if (options.failCreateOnce && creates === 1) throw new Error("Synthetic device creation failure");
          return { id: "device-test", ...data };
        } },
      });
    } catch (error) {
      if (claimed) pairing.consumedAt = null;
      throw error;
    }
  });
  return { pairing, outsideRead, creates: () => creates };
}

const exchangeRequest = { method: "POST" as const, url: "/api/v1/auth/device/exchange", payload: { code: "AAAA-BBBB-CCCC" } };

test("concurrent pairing exchanges issue exactly one device token", { timeout: 10_000 }, async (t) => {
  const state = mockPairing({ concurrent: true });
  const app = await appFor(t);
  const responses = await Promise.all([app.inject(exchangeRequest), app.inject(exchangeRequest)]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 401]);
  assert.equal(state.creates(), 1);
  assert.equal(state.outsideRead.mock.callCount(), 0);
  const success = responses.find((response) => response.statusCode === 200)!.json();
  assert.equal(success.workspaceId, workspaceId);
  assert.ok(success.deviceToken.startsWith("popd_"));
});

test("pairing claim checks expiry again at the conditional update", async (t) => {
  const state = mockPairing({ expireAfterRead: true });
  const app = await appFor(t);
  const response = await app.inject(exchangeRequest);
  assert.equal(response.statusCode, 401);
  assert.equal(state.creates(), 0);
});

for (const options of [{ consumed: true }, { expired: true }]) {
  test(`${options.consumed ? "consumed" : "expired"} pairing code is rejected`, async (t) => {
    const state = mockPairing(options);
    const app = await appFor(t);
    assert.equal((await app.inject(exchangeRequest)).statusCode, 401);
    assert.equal(state.creates(), 0);
  });
}

test("failed device creation rolls back the claim and permits a retry", async (t) => {
  const state = mockPairing({ failCreateOnce: true });
  const app = await appFor(t);
  assert.equal((await app.inject(exchangeRequest)).statusCode, 500);
  assert.equal(state.pairing.consumedAt, null);
  assert.equal((await app.inject(exchangeRequest)).statusCode, 200);
  assert.equal((await app.inject(exchangeRequest)).statusCode, 401);
  assert.equal(state.creates(), 2);
});

const connector = { id: "connector-test", workspaceId, name: "Gmail metadata", kind: "GMAIL_METADATA", status: "CONNECTED", detail: "Metadata only", lastSyncAt: new Date("2026-01-01T00:00:00.000Z"), config: { refreshToken: { iv: "fixture", tag: "fixture", ciphertext: "fixture" } }, lastContentHash: "internal-hash", createdAt: new Date(), updatedAt: new Date(), futurePrivateField: "not-public" };
const publicConnector = { id: connector.id, name: connector.name, kind: connector.kind, status: connector.status, detail: connector.detail, lastSyncAt: connector.lastSyncAt.toISOString() };

test("dashboard emits only the public connector DTO", async (t) => {
  mockMembership();
  for (const delegate of [prisma.priceWatch, prisma.popSubscription, prisma.cancellationTask, prisma.userCard, prisma.offer, prisma.recommendation, prisma.evidenceRecord, prisma.popNotification, prisma.subscriptionService, prisma.dealOffer, prisma.duplicateCandidate, prisma.cancellationRun, prisma.pointsAccount, prisma.pointsRegisterEntry, prisma.financialGoal, prisma.gameStop, prisma.gameStopEvent, prisma.gameStopCompletion]) {
    stub(delegate, "findMany", async () => []);
  }
  stub(prisma.automationPolicy, "findUnique", async () => null);
  stub(prisma.pointsModePreference, "findUnique", async () => null);
  stub(prisma.popConnector, "findMany", async () => [connector]);
  const app = await appFor(t);
  const response = await app.inject({ method: "GET", url: `/api/v1/workspaces/${workspaceId}/pop/dashboard`, headers: { authorization: `Bearer ${app.jwt.sign(user)}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().connectors, [publicConnector]);
});

for (const replay of [false, true]) {
  test(`Gmail connect ${replay ? "cached replay" : "new response"} omits connector credentials`, async (t) => {
    mockMembership();
    stub(prisma.idempotencyRecord, "findUnique", async () => replay ? { statusCode: 201, response: { connector: JSON.parse(JSON.stringify(connector)) } } : null);
    const stored = stub(prisma.idempotencyRecord, "create", async () => ({}));
    const upsert = stub(prisma.popConnector, "upsert", async () => connector);
    const app = await appFor(t);
    const response = await app.inject({ method: "POST", url: `/api/v1/workspaces/${workspaceId}/pop/connectors/gmail`, headers: { authorization: `Bearer ${app.jwt.sign(user)}`, "idempotency-key": "gmail-connect-test" }, payload: { email: user.email, refreshToken: "synthetic-refresh-token" } });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), { connector: publicConnector });
    assert.equal(upsert.mock.callCount(), replay ? 0 : 1);
    if (!replay) assert.deepEqual(stored.mock.calls[0].arguments[0].data.response, { connector: publicConnector });
  });
}

test("Gmail metadata scan omits q and still imports metadata-only headers", async () => {
  stub(prisma.popConnector, "findUnique", async () => ({ ...connector, config: { email: user.email, refreshToken: encryptConnectorValue("synthetic-refresh"), accessToken: encryptConnectorValue("synthetic-access"), expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }));
  const urls: URL[] = [];
  mock.method(globalThis, "fetch", async (input: any) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.endsWith("/messages")) {
      assert.equal(url.searchParams.has("q"), false);
      assert.equal(url.searchParams.get("maxResults"), "50");
      return Response.json({ messages: [{ id: "message-test" }] });
    }
    assert.equal(url.searchParams.get("format"), "metadata");
    assert.deepEqual(url.searchParams.getAll("metadataHeaders"), ["From", "Subject", "Date"]);
    return Response.json({ id: "message-test", internalDate: "1767225600000", payload: { headers: [{ name: "From", value: "test@example.invalid" }, { name: "Subject", value: "Subscription renewal" }] } });
  });
  const evidence = stub(prisma.evidenceRecord, "upsert", async () => ({}));
  stub(prisma.popConnector, "update", async () => ({}));
  assert.deepEqual(await scanGmailMetadata(prisma, workspaceId), { imported: 1 });
  assert.equal(urls.length, 2);
  assert.equal(evidence.mock.callCount(), 1);
  assert.deepEqual(Object.keys(evidence.mock.calls[0].arguments[0].create.metadata).sort(), ["fromDomain", "possibleSubscription", "receivedAt"]);
});
