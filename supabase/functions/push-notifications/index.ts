import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { jwtVerify } from "https://deno.land/x/jose@v4.15.4/index.ts";
import { getDbConnection } from "../_shared/database.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Lets browsers reuse the permission check instead of repeating it before every request.
  "Access-Control-Max-Age": "86400",
};

function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET not configured");
  return new TextEncoder().encode(secret);
}

async function verifyAuth(authHeader: string | null): Promise<{ userId: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.email) return null;
    return { userId: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

// ========== Helpers ==========
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

function uint8ToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ========== VAPID Key Generation ==========
async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const jwkPriv = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: uint8ToBase64Url(rawPub),
    privateKey: JSON.stringify(jwkPriv),
  };
}

// ========== Web Push Encryption (RFC 8291) ==========
async function hkdfDerive(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function encryptPayload(clientPubKeyBase64: string, authSecretBase64: string, payload: string) {
  const clientPubKeyBytes = base64UrlToUint8Array(clientPubKeyBase64);
  const authSecret = base64UrlToUint8Array(authSecretBase64);

  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubKey = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const clientPubKey = await crypto.subtle.importKey("raw", clientPubKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubKey }, localKeyPair.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyInfo = concatUint8(encoder.encode("WebPush: info\0"), clientPubKeyBytes, localPubKey);
  const ikm = await hkdfDerive(sharedSecret, authSecret, keyInfo, 32);
  const contentEncryptionKey = await hkdfDerive(ikm, salt, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfDerive(ikm, salt, encoder.encode("Content-Encoding: nonce\0"), 12);

  const paddedPayload = concatUint8(encoder.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", contentEncryptionKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload);

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatUint8(salt, rs, new Uint8Array([65]), localPubKey, new Uint8Array(encrypted));
}

async function createVapidAuthHeader(endpoint: string, vapidPrivateKeyJwk: JsonWebKey) {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { ...vapidPrivateKeyJwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { aud: audience, exp: now + 12 * 3600, sub: "mailto:admin@navigator-goda.app" };

  const encHeader = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify(jwtPayload)));
  const signingInput = `${encHeader}.${encPayload}`;

  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(signingInput)));

  let rawSig: Uint8Array;
  if (signature.length === 64) {
    rawSig = signature;
  } else {
    const rLen = signature[3];
    const r = signature.slice(4, 4 + rLen);
    const sOffset = 4 + rLen + 2;
    const s = signature.slice(sOffset);
    const rPad = new Uint8Array(32);
    const sPad = new Uint8Array(32);
    rPad.set(r.slice(Math.max(0, r.length - 32)), Math.max(0, 32 - r.length));
    sPad.set(s.slice(Math.max(0, s.length - 32)), Math.max(0, 32 - s.length));
    rawSig = concatUint8(rPad, sPad);
  }

  const token = `${signingInput}.${uint8ToBase64Url(rawSig)}`;

  const pubJwk = { ...vapidPrivateKeyJwk };
  delete pubJwk.d;
  const pubKey = await crypto.subtle.importKey("jwk", { ...pubJwk, key_ops: [] }, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pubKey));

  return `vapid t=${token}, k=${uint8ToBase64Url(rawPub)}`;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPrivateKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const ciphertext = await encryptPayload(subscription.p256dh, subscription.auth_key, payload);
    const authorization = await createVapidAuthHeader(subscription.endpoint, vapidPrivateKeyJwk);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": ciphertext.byteLength.toString(),
        Authorization: authorization,
        TTL: "86400",
        Urgency: "normal",
      },
      body: ciphertext,
    });

    if (!response.ok) {
      console.error(`Push failed ${subscription.endpoint}: ${response.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendPush error:", err);
    return false;
  }
}

// ========== Daily Messages ==========
const DAILY_MESSAGES = [
  { title: "Доброе утро! ☀️", body: "Загляни в свой фокус дня — тебя ждут полезные подсказки" },
  { title: "Новый день! ✨", body: "Посмотри задачи на сегодня и начни день продуктивно" },
  { title: "Привет! 🌟", body: "Твой навигатор обновлён — проверь энергию дня" },
  { title: "Утро доброе! 🌸", body: "Самое время заглянуть в планы на день" },
  { title: "С добрым утром! 💫", body: "Узнай, какая энергия сегодня и настройся на успех" },
  { title: "Время планировать! 📋", body: "Проверь свои задачи и фокус на сегодня" },
  { title: "Начни день с ясности! 🎯", body: "Посмотри рекомендации навигатора" },
  { title: "Навигатор ждёт! 🧭", body: "Проверь свой персональный прогноз на день" },
  { title: "Хороший день! 🌿", body: "Загляни в навигатор — узнай фокус дня" },
  { title: "Утренний ритуал! ☕", body: "Начни день с проверки своего плана" },
  { title: "Время действовать! 🚀", body: "Твои задачи и привычки ждут тебя" },
  { title: "Пора за дело! 💪", body: "Посмотри, что приготовил навигатор на сегодня" },
  { title: "Сегодня — твой день! 🌈", body: "Проверь энергию дня и настройся на лучшее" },
  { title: "Утренний фокус! 🔮", body: "Узнай подсказки навигатора на сегодня" },
  { title: "Новые возможности! 🌻", body: "Загляни в план дня — тебя ждут открытия" },
  { title: "Просыпайся с планом! 📝", body: "Задачи на день уже ждут тебя в навигаторе" },
  { title: "Энергия дня! ⚡", body: "Проверь, какие советы даёт навигатор сегодня" },
  { title: "Время мудрости! 🔑", body: "Загляни в свой персональный фокус дня" },
  { title: "Доброе утро! 🌅", body: "Не забудь проверить свои задачи на сегодня" },
  { title: "Продуктивного дня! 📌", body: "Твой навигатор готов — проверь планы" },
  { title: "С новым днём! 🎊", body: "Узнай свой фокус дня и двигайся к цели" },
  { title: "Утренняя мотивация! 🌞", body: "Загляни в навигатор за вдохновением" },
  { title: "Начинай красиво! 🦋", body: "Посмотри рекомендации на сегодня" },
  { title: "Держи ритм! 🎵", body: "Проверь привычки и задачи на день" },
  { title: "Время для себя! 🧘", body: "Загляни в навигатор — позаботься о своём дне" },
  { title: "Сверимся с планом! 🗓", body: "Посмотри, что запланировано на сегодня" },
  { title: "Твой день начинается! 🌤", body: "Энергия дня уже ждёт тебя в навигаторе" },
  { title: "Проверь навигатор! 📱", body: "Новый день — новые подсказки и задачи" },
  { title: "Начни с главного! 🏆", body: "Посмотри фокус дня и расставь приоритеты" },
  { title: "Доброе утро! 🍀", body: "Сегодня удачный день — загляни в навигатор" },
];

function getDailyMessage() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
}

// ========== Main Handler ==========
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // === MIGRATE ===
    if (action === "migrate") {
      const sql = getDbConnection();
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.push_config (
          id SERIAL PRIMARY KEY,
          vapid_public_key TEXT NOT NULL,
          vapid_private_key TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth_key TEXT NOT NULL,
          timezone_offset INT NOT NULL DEFAULT 180,
          last_notified_date DATE,
          last_expiry_notified_date DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        ALTER TABLE life_navigator.push_subscriptions
        ADD COLUMN IF NOT EXISTS last_expiry_notified_date DATE
      `;
      await sql.end();
      return new Response(JSON.stringify({ success: true, message: "Push tables created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GET-VAPID-KEY ===
    if (action === "get-vapid-key") {
      const sql = getDbConnection();
      let configs = await sql`SELECT vapid_public_key FROM life_navigator.push_config LIMIT 1`;
      if (configs.length === 0) {
        const keys = await generateVapidKeys();
        await sql`INSERT INTO life_navigator.push_config (vapid_public_key, vapid_private_key) VALUES (${keys.publicKey}, ${keys.privateKey})`;
        configs = [{ vapid_public_key: keys.publicKey }];
      }
      await sql.end();
      return new Response(JSON.stringify({ publicKey: configs[0].vapid_public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SUBSCRIBE (auth required) ===
    if (action === "subscribe" && req.method === "POST") {
      const authData = await verifyAuth(req.headers.get("Authorization"));
      if (!authData) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subscription, timezoneOffset } = await req.json();
      const sql = getDbConnection();
      await sql`
        INSERT INTO life_navigator.push_subscriptions (user_id, endpoint, p256dh, auth_key, timezone_offset)
        VALUES (${authData.userId}::uuid, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}, ${timezoneOffset || 180})
        ON CONFLICT (endpoint) DO UPDATE SET
          user_id = ${authData.userId}::uuid,
          p256dh = ${subscription.keys.p256dh},
          auth_key = ${subscription.keys.auth},
          timezone_offset = ${timezoneOffset || 180},
          last_notified_date = NULL
      `;
      await sql.end();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UNSUBSCRIBE (auth required) ===
    if (action === "unsubscribe" && req.method === "POST") {
      const authData = await verifyAuth(req.headers.get("Authorization"));
      if (!authData) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sql = getDbConnection();
      await sql`DELETE FROM life_navigator.push_subscriptions WHERE user_id = ${authData.userId}::uuid`;
      await sql.end();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SEND-DAILY (called by cron — no additional auth needed, only sends predefined messages) ===
    if (action === "send-daily" && req.method === "POST") {

      const sql = getDbConnection();
      const configs = await sql`SELECT vapid_public_key, vapid_private_key FROM life_navigator.push_config LIMIT 1`;
      if (configs.length === 0) {
        await sql.end();
        return new Response(JSON.stringify({ error: "VAPID not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const vapidPrivateKeyJwk = JSON.parse(configs[0].vapid_private_key);
      const utcHour = new Date().getUTCHours();
      const targetOffset = ((8 - utcHour + 24) % 24) * 60;
      const altOffset = targetOffset > 720 ? targetOffset - 1440 : (targetOffset === 0 ? 0 : targetOffset + 1440);
      const today = new Date().toISOString().split("T")[0];

      console.log("send-daily query params:", { utcHour, targetOffset, altOffset, today });

      const subs = await sql`
        SELECT * FROM life_navigator.push_subscriptions
        WHERE (timezone_offset = ${targetOffset} OR timezone_offset = ${altOffset})
          AND (last_notified_date IS NULL OR last_notified_date < ${today}::date)
      `;

      console.log("send-daily found subscriptions:", subs.length);

      // Also log all subscriptions for debugging
      const allSubs = await sql`SELECT id, user_id, timezone_offset, last_notified_date, endpoint FROM life_navigator.push_subscriptions`;
      console.log("All subscriptions:", JSON.stringify(allSubs.map((s: any) => ({ id: s.id, tz: s.timezone_offset, last: s.last_notified_date }))));

      const message = getDailyMessage();
      const payload = JSON.stringify(message);
      let sent = 0;
      let failed = 0;

      for (const sub of subs) {
        const ok = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key },
          payload,
          vapidPrivateKeyJwk
        );
        if (ok) {
          sent++;
          await sql`UPDATE life_navigator.push_subscriptions SET last_notified_date = ${today}::date WHERE id = ${sub.id}`;
        } else {
          failed++;
          // Don't delete on first failure - could be temporary
          console.error("Push failed for sub:", sub.id, sub.endpoint);
        }
      }

      // === Subscription expiry notifications ===
      // Ensure column exists (idempotent)
      await sql`ALTER TABLE life_navigator.push_subscriptions ADD COLUMN IF NOT EXISTS last_expiry_notified_date DATE`;

      const EXPIRY_MESSAGES: Record<number, { title: string; body: string }> = {
        7: { title: "⏰ Подписка заканчивается", body: "Подписка заканчивается через неделю — успей продлить!" },
        2: { title: "⚠️ Осталось 2 дня", body: "Через 2 дня подписка истечёт — продли, чтобы не потерять доступ" },
        1: { title: "🔔 Завтра истекает подписка", body: "Завтра подписка заканчивается — продли сегодня!" },
        0: { title: "🚨 Последний день подписки", body: "Сегодня последний день подписки — продли прямо сейчас" },
      };

      const expirySubs = await sql`
        SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth_key, ps.last_expiry_notified_date,
               p.subscription_until
        FROM life_navigator.push_subscriptions ps
        JOIN life_navigator.profiles p ON p.id = ps.user_id
        WHERE p.subscription_until IS NOT NULL
          AND (ps.timezone_offset = ${targetOffset} OR ps.timezone_offset = ${altOffset})
      `;

      let expirySent = 0;
      for (const sub of expirySubs) {
        const subUntil = new Date(sub.subscription_until);
        const todayDate = new Date(today);
        subUntil.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((subUntil.getTime() - todayDate.getTime()) / 86400000);

        const expiryMsg = EXPIRY_MESSAGES[diffDays];
        if (!expiryMsg) continue;

        // Skip if already notified today
        if (sub.last_expiry_notified_date && new Date(sub.last_expiry_notified_date).toISOString().split("T")[0] === today) continue;

        const ok = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key },
          JSON.stringify(expiryMsg),
          vapidPrivateKeyJwk
        );
        if (ok) {
          expirySent++;
          await sql`UPDATE life_navigator.push_subscriptions SET last_expiry_notified_date = ${today}::date WHERE id = ${sub.id}`;
        }
      }

      console.log("send-daily result:", { sent, failed, total: subs.length, expirySent });

      await sql.end();
      return new Response(JSON.stringify({ success: true, sent, failed, total: subs.length, expirySent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Push error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
