import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord | null;
  old_record: NotificationRecord | null;
}

interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

// ── Google Service Account → OAuth2 Access Token (Web Crypto API) ─────────────

/**
 * 구글 서비스 계정 JSON에서 RS256 서명된 JWT를 만들고
 * Google OAuth2 토큰 엔드포인트에서 액세스 토큰을 교환합니다.
 *
 * 외부 라이브러리 없이 Deno 내장 Web Crypto API만 사용합니다.
 */
async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // JWT Header · Payload
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const toBase64Url = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const signingInput = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  // PEM → DER 변환 후 CryptoKey 생성
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const derBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    derBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // RS256 서명
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64Url = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${signatureB64Url}`;

  // JWT → OAuth2 Access Token 교환
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`OAuth2 토큰 교환 실패 (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// ── FCM HTTP v1 단건 발송 ─────────────────────────────────────────────────────

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  link: string
): Promise<{ success: boolean; error?: string }> {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const res = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        // ⚠️ notification 필드를 의도적으로 제외합니다.
        // FCM 스펙: notification 필드가 있으면 브라우저가 가로채서 자동 표시하고
        // Service Worker의 onBackgroundMessage가 호출되지 않습니다.
        // data-only 메시지여야만 onBackgroundMessage → showNotification() 흐름이 동작합니다.
        data: { title, body, link },
        webpush: {
          headers: {
            // 긴급 배송 요청 — 배터리 절약 모드에서도 즉시 전달
            Urgency: "high",
            // 메시지 유효 기간 24시간 (오프라인 상태에서도 재전달)
            TTL: "86400",
          },
          fcm_options: { link },
        },
      },
    }),
  });

  if (res.ok) return { success: true };

  const errBody = await res.json() as { error?: { message?: string } };
  const errMsg = errBody?.error?.message ?? `HTTP ${res.status}`;

  // 만료·등록 해제된 토큰은 삭제해야 하므로 별도 식별
  const isTokenInvalid =
    errMsg.includes("UNREGISTERED") || errMsg.includes("INVALID_ARGUMENT");

  return { success: false, error: isTokenInvalid ? "INVALID_TOKEN" : errMsg };
}

// ── Edge Function Entry Point ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Supabase Database Webhook은 POST로만 전송됨
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── 환경변수 로드 ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fcmServiceAccountRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");

  if (!supabaseUrl || !supabaseServiceRoleKey || !fcmServiceAccountRaw) {
    console.error("[send-push-notification] 필수 환경변수 누락");
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── Webhook 페이로드 파싱 ──
  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  // INSERT 이벤트가 아니거나 record가 없으면 무시
  if (payload.type !== "INSERT" || !payload.record) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user_id, title, body, link } = payload.record;
  const notificationLink = link ?? "/";

  // ── Supabase Admin 클라이언트 (push_tokens 조회용) ──
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: tokens, error: tokenErr } = await supabase
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", user_id);

  if (tokenErr) {
    console.error("[send-push-notification] 토큰 조회 실패:", tokenErr.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    console.log(`[send-push-notification] 등록된 토큰 없음 (user: ${user_id})`);
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Google Access Token 발급 ──
  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(fcmServiceAccountRaw) as ServiceAccount;
  } catch {
    console.error("[send-push-notification] FCM_SERVICE_ACCOUNT JSON 파싱 실패");
    return new Response("Internal Server Error", { status: 500 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(serviceAccount);
  } catch (err) {
    console.error("[send-push-notification] Access Token 발급 실패:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  // ── 각 토큰에 FCM 발송 ──
  const invalidTokenIds: string[] = [];
  let sentCount = 0;

  await Promise.all(
    tokens.map(async (row: { id: string; token: string }) => {
      const result = await sendFcmMessage(
        serviceAccount.project_id,
        accessToken,
        row.token,
        title,
        body,
        notificationLink
      );

      if (result.success) {
        sentCount++;
      } else if (result.error === "INVALID_TOKEN") {
        // 만료된 토큰은 DB에서 제거
        invalidTokenIds.push(row.id);
        console.warn(`[send-push-notification] 만료된 토큰 제거 예정: ${row.id}`);
      } else {
        console.error(`[send-push-notification] 발송 실패 (token: ${row.id}):`, result.error);
      }
    })
  );

  // 만료된 토큰 일괄 삭제
  if (invalidTokenIds.length > 0) {
    await supabase.from("push_tokens").delete().in("id", invalidTokenIds);
  }

  console.log(
    `[send-push-notification] 완료 — 발송: ${sentCount}, 만료 토큰 삭제: ${invalidTokenIds.length}`
  );

  return new Response(
    JSON.stringify({ sent: sentCount, removed: invalidTokenIds.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
