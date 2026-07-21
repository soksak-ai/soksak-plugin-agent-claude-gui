// @ts-nocheck — vanilla 플러그인(main.js) 순수 로직 단위테스트. named export 는 로더가 무시
// (default 만 사용)하므로 플러그인 동작 불변 — 테스트 전용 노출.
//
// RED→구현→GREEN. rail `sessions` 뷰의 행 모델: 감지된 claude pane(panes) + ai.session.find
// 캐시(found) + 라이브 오버레이 conv 를 한 행으로 합성한다.
//   - 라이브 conv.session(오버레이가 fs.watch 로 /resume 까지 추종)이 find 캐시보다 우선한다.
//   - model 은 conv.stats(트랜스크립트 실측)에서만 — 추정 금지, 없으면 null.
//   - 행 순서 = 입력(감지) 순서. 카운터·가짜 키 없이 paneId 가 안정 식별자다.

import { describe, it, expect } from "vitest";
import { buildSessionRows } from "./main.js";

const S1 = "9fde0561-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S2 = "e5ba3cc7-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const pane = (paneId, cwd, extra) => ({ paneId, cwd, open: false, conv: null, ...extra });

describe("buildSessionRows — 감지 pane → rail 행 모델", () => {
  it("감지만 된 pane(세션 미확인)은 session null·program claude 로 나온다", () => {
    const rows = buildSessionRows([pane("p1", "/w/a")], new Map());
    expect(rows).toEqual([
      { paneId: "p1", cwd: "/w/a", program: "claude", session: null, model: null, open: false },
    ]);
  });

  it("ai.session.find 캐시가 session·program 을 채운다", () => {
    const found = new Map([["p1", { sessionId: S1, kind: "claude" }]]);
    const rows = buildSessionRows([pane("p1", "/w/a")], found);
    expect(rows[0].session).toBe(S1);
    expect(rows[0].program).toBe("claude");
  });

  it("라이브 conv.session 이 stale find 캐시를 이긴다(/resume 추종)", () => {
    const found = new Map([["p1", { sessionId: S1, kind: "claude" }]]);
    const p = pane("p1", "/w/a", {
      open: true,
      conv: { session: S2, stats: { model: "claude-fable-5" } },
    });
    const rows = buildSessionRows([p], found);
    expect(rows[0].session).toBe(S2);
    expect(rows[0].open).toBe(true);
  });

  it("model 은 conv.stats 실측에서만 — 없으면 null(추정 금지)", () => {
    const withModel = pane("p1", "/w/a", { conv: { session: S1, stats: { model: "m1" } } });
    const noStats = pane("p2", "/w/b", { conv: { session: S2, stats: { model: "" } } });
    const rows = buildSessionRows([withModel, noStats], new Map());
    expect(rows[0].model).toBe("m1");
    expect(rows[1].model).toBe(null);
  });

  it("행 순서 = 감지 순서(입력 순서 보존)", () => {
    const rows = buildSessionRows([pane("p2", "/w/b"), pane("p1", "/w/a")], new Map());
    expect(rows.map((r) => r.paneId)).toEqual(["p2", "p1"]);
  });

  it("빈 입력·불량 항목에 관대하다(빈 배열·paneId 없는 항목 제외)", () => {
    expect(buildSessionRows([], new Map())).toEqual([]);
    expect(buildSessionRows(null, null)).toEqual([]);
    expect(buildSessionRows([null, { cwd: "/x" }], new Map())).toEqual([]);
  });
});
