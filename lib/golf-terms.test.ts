import { describe, expect, it } from "vitest";
import { scoreName, shotLanding } from "./golf-terms";

describe("scoreName", () => {
  it("names scores relative to par", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map((s) => scoreName(s, 3).label)).toEqual([
      "Hole in one!",
      "Eagle",
      "Birdie",
      "Par",
      "Bogey",
      "Double bogey",
      "Triple bogey",
      "+6",
    ]);
  });

  it("uses albatross for 3+ under on long holes", () => {
    expect(scoreName(1, 5)).toEqual({ label: "Albatross", tone: "under" });
  });

  it("calls an off-list guess a lost ball", () => {
    expect(scoreName(15, 3, false)).toEqual({ label: "Lost ball", tone: "lost" });
  });
});

describe("shotLanding", () => {
  it("drops in the hole on an exact hit", () => {
    expect(shotLanding(28, 28, 0, 15)).toEqual({ kind: "hole" });
  });
  it("lands short when the guess ranks better than the target, long when worse", () => {
    expect(shotLanding(20, 28, 8, 15)).toEqual({ kind: "short", fraction: 8 / 15 });
    expect(shotLanding(31, 28, 3, 15)).toEqual({ kind: "long", fraction: 3 / 15 });
  });
  it("goes in the water when off-list, and caps distance", () => {
    expect(shotLanding(null, 5, 15, 15)).toEqual({ kind: "water" });
    expect(shotLanding(60, 5, 15, 15)).toEqual({ kind: "long", fraction: 1 });
  });
});
