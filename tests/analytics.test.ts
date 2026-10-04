import { describe, expect, it } from "vitest";
import { funnelByAngle, leaderboard, replyHeatmap } from "@/lib/analytics";
import { languageFor } from "@/lib/language";
import type { OutreachEvent, Person } from "@/lib/types";

const ev = (over: Partial<OutreachEvent>): OutreachEvent => ({
  id: Math.random().toString(),
  orgId: "o",
  companyId: "c1",
  companyName: "Acme",
  personId: "p1",
  personName: "Jo",
  userId: "u1",
  userName: "Max",
  type: "connection_sent",
  angle: "first_90_days",
  note: null,
  at: "2026-10-01T08:00:00Z",
  ...over,
});

describe("outreach analytics", () => {
  const events = [
    ev({ type: "connection_sent" }),
    ev({ type: "accepted", at: "2026-10-01T09:00:00Z" }),
    ev({ type: "replied", at: "2026-10-02T14:30:00Z" }),
    ev({ type: "meeting_booked", at: "2026-10-03T10:00:00Z" }),
    ev({ companyId: "c2", personId: "p2", type: "message_sent", angle: "team_buildout", userId: "u2", userName: "Lea" }),
  ];

  it("counts threads per stage by angle", () => {
    const f = funnelByAngle(events);
    expect(f.find((x) => x.angle === "first_90_days")).toMatchObject({ sent: 1, accepted: 1, replied: 1, meeting: 1 });
    expect(f.find((x) => x.angle === "team_buildout")).toMatchObject({ sent: 1, accepted: 0, replied: 0, meeting: 0 });
  });

  it("puts replies on the right weekday and hour in the time zone", () => {
    const grid = replyHeatmap(events, "Europe/Berlin");
    expect(grid[4][16]).toBe(1); // Fri 2 Oct 2026, 14:30 UTC = 16:30 CEST
    expect(grid[5][12]).toBe(1); // Sat 3 Oct, meeting booked 10:00 UTC = 12:00
  });

  it("ranks SDRs by meetings", () => {
    const b = leaderboard(events);
    expect(b[0]).toMatchObject({ name: "Max", meetings: 1, replyRate: 1 });
    expect(b[1]).toMatchObject({ name: "Lea", sent: 1, replied: 0 });
  });
});

describe("opener language", () => {
  const person = (posts: string[]) => ({ title: "Head of Sales", posts: posts.map((text) => ({ text, at: null, url: null })) }) as unknown as Person;
  it("uses German for DACH unless the profile is English", () => {
    expect(languageFor("DE", person(["Wir bauen unser Team auf und suchen SDRs"]))).toBe("German");
    expect(languageFor("DE", person(["We are hiring for our new team and this is the moment"]))).toBe("English");
    expect(languageFor("GB", person([]))).toBe("English");
  });
});
