import { describe, expect, it } from "vitest";
import { canonicalManagerKey, managerDisplayName } from "./managerIdentity";
import { ownerKeyFor } from "./teamStateThroughWeek";
import { findCellByManagerKeys } from "../weeklyEmailNarratives";

describe("canonicalManagerKey — stable identity", () => {
  it("same owner with renamed display name keeps one continuous key", () => {
    const before = canonicalManagerKey({
      ownerId: "user-alice",
      rosterId: 1,
      displayName: "Alice 2021",
      username: "alice",
    });
    const after = canonicalManagerKey({
      ownerId: "user-alice",
      rosterId: 1,
      displayName: "A-Renamed",
      username: "alice",
    });
    expect(before).toBe("owner:user-alice");
    expect(after).toBe(before);
    expect(managerDisplayName({ displayName: "A-Renamed", username: "alice", rosterId: 1 })).toBe(
      "A-Renamed",
    );
  });

  it("different owners with identical display name stay separate", () => {
    const a = canonicalManagerKey({
      ownerId: "owner-1",
      rosterId: 3,
      displayName: "Same Name",
    });
    const b = canonicalManagerKey({
      ownerId: "owner-2",
      rosterId: 7,
      displayName: "Same Name",
    });
    expect(a).toBe("owner:owner-1");
    expect(b).toBe("owner:owner-2");
    expect(a).not.toBe(b);
  });

  it("roster owner change between seasons does not transfer history key", () => {
    const oldOwner = canonicalManagerKey({
      ownerId: "old-owner",
      rosterId: 5,
      seasonLeagueId: "league-2022",
      displayName: "Team Five",
    });
    const newOwner = canonicalManagerKey({
      ownerId: "new-owner",
      rosterId: 5,
      seasonLeagueId: "league-2023",
      displayName: "Team Five",
    });
    expect(oldOwner).toBe("owner:old-owner");
    expect(newOwner).toBe("owner:new-owner");
    expect(oldOwner).not.toBe(newOwner);
  });

  it("without owner_id, identical display names do not share a key across seasons", () => {
    const a = canonicalManagerKey({
      ownerId: null,
      rosterId: 2,
      seasonLeagueId: "lg-a",
      displayName: "Dup Name",
    });
    const b = canonicalManagerKey({
      ownerId: null,
      rosterId: 9,
      seasonLeagueId: "lg-b",
      displayName: "Dup Name",
    });
    expect(a).toBe("roster:lg-a:2");
    expect(b).toBe("roster:lg-b:9");
    expect(a).not.toBe(b);
  });

  it("aligns with within-season ownerKeyFor when owner_id present", () => {
    expect(canonicalManagerKey({ ownerId: "x", rosterId: 4 })).toBe(ownerKeyFor("x", 4));
  });
});

describe("findCellByManagerKeys — rivalry/H2H join", () => {
  const cells = [
    {
      a: "owner:alice",
      b: "owner:bob",
      aName: "Alice",
      bName: "Bob",
      badge: "NEMESIS",
      record: "0-5",
      games: 5,
    },
    {
      a: "owner:carol",
      b: "owner:dave",
      aName: "Same Display",
      bName: "Other",
      badge: "OWNED",
      record: "4-0",
      games: 4,
    },
  ];

  it("joins by stable manager keys, not display names", () => {
    const hit = findCellByManagerKeys(cells, "owner:bob", "owner:alice");
    expect(hit?.badge).toBe("NEMESIS");
    expect(hit?.record).toBe("0-5");
  });

  it("does not select the wrong manager when display names collide", () => {
    // A third owner who also renders as "Same Display" must not match carol's cell.
    const miss = findCellByManagerKeys(cells, "owner:impostor", "owner:dave");
    expect(miss).toBeNull();
    const hit = findCellByManagerKeys(cells, "owner:carol", "owner:dave");
    expect(hit?.aName).toBe("Same Display");
    expect(hit?.a).toBe("owner:carol");
  });
});
