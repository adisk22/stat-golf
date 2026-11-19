import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse";
import { duplicateEntityIssues, normalizeName, parseRankingCsv } from "./ranking";

describe("parseCsv", () => {
  it("parses simple rows with CRLF and a BOM", () => {
    expect(parseCsv("﻿rank,name,value\r\n1,A,10\r\n")).toEqual([
      ["rank", "name", "value"],
      ["1", "A", "10"],
    ]);
  });

  it("handles quotes, escaped quotes, commas and newlines inside quotes", () => {
    expect(parseCsv('1,"Real ""Sample"", FC",5\n2,"Multi\nLine",4')).toEqual([
      ["1", 'Real "Sample", FC', "5"],
      ["2", "Multi\nLine", "4"],
    ]);
  });

  it("skips blank lines and handles no trailing newline", () => {
    expect(parseCsv("a,b\n\n\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("1,,3\n")).toEqual([["1", "", "3"]]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('1,"oops,2')).toThrow(/Unclosed quote/);
  });
});

const csv = (...lines: string[]) => ["rank,name,value", ...lines].join("\n");

describe("parseRankingCsv", () => {
  it("accepts a valid descending list with ties", () => {
    const res = parseRankingCsv(csv("1,Alpha,90", "2,Beta,80", "2,Gamma,80", "4,Delta,70"), "desc");
    expect(res.errors).toEqual([]);
    expect(res.rows.map((r) => [r.rank, r.name, r.value, r.line])).toEqual([
      [1, "Alpha", 90, 2],
      [2, "Beta", 80, 3],
      [2, "Gamma", 80, 4],
      [4, "Delta", 70, 5],
    ]);
  });

  it("accepts an ascending list and reordered header columns", () => {
    const res = parseRankingCsv("name,value,rank\nA,0.5,1\nB,0.7,2", "asc");
    expect(res.errors).toEqual([]);
    expect(res.rows[1]).toMatchObject({ name: "B", rank: 2, value: 0.7 });
  });

  it("requires the header", () => {
    expect(parseRankingCsv("1,A,10\n2,B,9", "desc").errors[0]!.message).toMatch(/Header must contain/);
  });

  it("reports bad cells with line numbers", () => {
    const res = parseRankingCsv(csv("1,A,10", "x,B,9", "3,,8", "4,D,lots"), "desc");
    expect(res.errors).toEqual([
      { line: 3, message: 'Rank "x" is not a positive whole number.' },
      { line: 4, message: "Name is empty." },
      { line: 5, message: 'Value "lots" is not a number.' },
    ]);
  });

  it("rejects values out of order for the declared direction", () => {
    const res = parseRankingCsv(csv("1,A,10", "2,B,12"), "desc");
    expect(res.errors[0]).toMatchObject({ line: 3 });
    expect(res.errors[0]!.message).toMatch(/higher than the row above/);
    expect(parseRankingCsv(csv("1,A,10", "2,B,12"), "asc").errors).toEqual([]);
  });

  it("rejects unsorted ranks", () => {
    expect(parseRankingCsv(csv("2,A,10", "1,B,12"), "asc").errors[0]!.message).toMatch(/sorted by rank/);
  });

  it("rejects gaps that are not ties", () => {
    const res = parseRankingCsv(csv("1,A,10", "3,B,9"), "desc");
    expect(res.errors).toEqual([{ line: 3, message: expect.stringMatching(/Expected rank 2/) }]);
  });

  it("rejects ties that don't share a rank, and shared ranks with different values", () => {
    expect(parseRankingCsv(csv("1,A,10", "2,B,10"), "desc").errors[0]!.message).toMatch(/Expected rank 1/);
    expect(parseRankingCsv(csv("1,A,10", "1,B,9"), "desc").errors[0]!.message).toMatch(/Expected rank 2/);
  });

  it("rejects a tie followed by the wrong next rank", () => {
    expect(parseRankingCsv(csv("1,A,10", "1,B,10", "2,C,9"), "desc").errors[0]!.message).toMatch(/Expected rank 3/);
  });

  it("rejects duplicate names ignoring case and accents", () => {
    const res = parseRankingCsv(csv("1,Atlético Ficticio,10", "2,atletico ficticio,9"), "desc");
    expect(res.errors).toEqual([{ line: 3, message: '"atletico ficticio" duplicates line 2.' }]);
  });

  it("parses numbers with spaces and exponents", () => {
    const res = parseRankingCsv(csv("1,A,1 200", "2,B,1.5e2"), "desc");
    expect(res.rows.map((r) => r.value)).toEqual([1200, 150]);
  });

  it("rejects an empty body", () => {
    expect(parseRankingCsv("rank,name,value\n", "desc").errors[0]!.message).toBe("No data rows.");
  });
});

describe("normalizeName", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalizeName("  Atlético-Ficticio F.C. ")).toBe("atletico ficticio f c");
  });
});

describe("duplicateEntityIssues", () => {
  it("flags two rows matched to one entity", () => {
    expect(
      duplicateEntityIssues([
        { line: 2, entityId: "x" },
        { line: 3, entityId: null },
        { line: 4, entityId: "x" },
      ]),
    ).toEqual([{ line: 4, message: "Matches the same entity as line 2." }]);
  });
});
