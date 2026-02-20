/**
 * 빌드 전 실행되는 동적 사이트맵 생성 스크립트
 * - 정적 경로 + Supabase에서 가져온 모든 공개 게시글 URL을 포함
 * - .env.local 의 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 사용
 *
 * 실행: node scripts/generate-sitemap.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── 1. .env.local 파싱 ──────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    const env = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
    }
    return env;
  } catch {
    console.warn("⚠️  .env.local 파일을 찾을 수 없습니다. 환경 변수를 직접 사용합니다.");
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SITE_BASE = "https://modumotu.com";
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌  VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 가 없습니다.");
  process.exit(1);
}

// ── 2. 정적 경로 정의 ────────────────────────────────────────────────────────
const STATIC_ROUTES = [
  { path: "/",          changefreq: "daily",   priority: "1.0" },
  { path: "/ranking",   changefreq: "hourly",  priority: "0.9" },
  { path: "/community", changefreq: "hourly",  priority: "0.9" },
  { path: "/contact",   changefreq: "monthly", priority: "0.5" },
  { path: "/privacy",   changefreq: "monthly", priority: "0.4" },
  { path: "/terms",     changefreq: "monthly", priority: "0.4" },
];

// ── 3. Supabase REST API로 게시글 목록 조회 ─────────────────────────────────
async function fetchAllPostIds() {
  const PAGE_SIZE = 1000;
  let from = 0;
  const posts = [];

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/posts?select=id,updated_at&order=created_at.desc&limit=${PAGE_SIZE}&offset=${from}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase 쿼리 실패 (${res.status}): ${body}`);
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    posts.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return posts;
}

// ── 4. XML 생성 ──────────────────────────────────────────────────────────────
function buildXml(staticRoutes, posts) {
  const indent = "  ";

  const staticEntries = staticRoutes
    .map(({ path, changefreq, priority }) =>
      [
        `${indent}<url>`,
        `${indent}  <loc>${SITE_BASE}${path}</loc>`,
        `${indent}  <lastmod>${TODAY}</lastmod>`,
        `${indent}  <changefreq>${changefreq}</changefreq>`,
        `${indent}  <priority>${priority}</priority>`,
        `${indent}</url>`,
      ].join("\n")
    )
    .join("\n");

  const postEntries = posts
    .map(({ id, updated_at }) => {
      const lastmod = updated_at
        ? new Date(updated_at).toISOString().slice(0, 10)
        : TODAY;
      return [
        `${indent}<url>`,
        `${indent}  <loc>${SITE_BASE}/community/${id}</loc>`,
        `${indent}  <lastmod>${lastmod}</lastmod>`,
        `${indent}  <changefreq>weekly</changefreq>`,
        `${indent}  <priority>0.7</priority>`,
        `${indent}</url>`,
      ].join("\n");
    })
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ``,
    `  <!-- 정적 페이지 (${staticRoutes.length}개) -->`,
    staticEntries,
    ``,
    `  <!-- 커뮤니티 게시글 (${posts.length}개) -->`,
    postEntries,
    ``,
    `</urlset>`,
  ].join("\n");
}

// ── 5. 실행 ──────────────────────────────────────────────────────────────────
(async () => {
  console.log("🗺  사이트맵 생성 시작...");

  let posts = [];
  try {
    posts = await fetchAllPostIds();
    console.log(`   ✅ 게시글 ${posts.length}개 조회 완료`);
  } catch (err) {
    console.warn(`   ⚠️  게시글 조회 실패 (정적 경로만 포함합니다): ${err.message}`);
  }

  const xml = buildXml(STATIC_ROUTES, posts);
  const outPath = resolve(ROOT, "public/sitemap.xml");
  writeFileSync(outPath, xml, "utf-8");

  console.log(`   ✅ sitemap.xml 저장 완료 → ${outPath}`);
  console.log(`   총 URL: ${STATIC_ROUTES.length + posts.length}개`);
})();
