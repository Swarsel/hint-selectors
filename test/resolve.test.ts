import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apply_exclude,
  match_pattern_regex,
  merge_sites,
  resolve,
  type Sites,
} from "../src/resolve.ts";

describe("match_pattern_regex", () => {
  it("matches http and https for the * scheme", () => {
    const regex = match_pattern_regex("*://example.com/*");
    assert.ok(regex.test("http://example.com/"));
    assert.ok(regex.test("https://example.com/a?b=c"));
    assert.ok(!regex.test("ftp://example.com/"));
  });

  it("matches the domain itself and subdomains for *.host", () => {
    const regex = match_pattern_regex("https://*.example.com/*");
    assert.ok(regex.test("https://example.com/"));
    assert.ok(regex.test("https://a.b.example.com/x"));
    assert.ok(!regex.test("https://notexample.com/"));
  });

  it("anchors the path and treats * as a wildcard", () => {
    const regex = match_pattern_regex("*://www.youtube.com/watch*");
    assert.ok(regex.test("https://www.youtube.com/watch?v=x"));
    assert.ok(!regex.test("https://www.youtube.com/feed/watch"));
  });

  it("ignores ports", () => {
    assert.ok(match_pattern_regex("*://localhost/*").test("http://localhost:8080/"));
  });

  it("rejects invalid patterns", () => {
    assert.throws(() => match_pattern_regex("example.com"));
    assert.throws(() => match_pattern_regex("*://exa*mple.com/"));
  });
});

describe("resolve", () => {
  const sites: Sites = {
    "example.com": [
      { include: ".global" },
      {
        match: ["*://www.example.com/watch*"],
        include: ".watch",
        exclude: ".ads",
        sets: { primary: ".main" },
      },
      { match: ["*://old.example.com/*"], sets: { primary: ".old" } },
    ],
    "sub.example.com": [{ sets: { primary: ".sub" } }],
  };

  it("returns null for unknown hosts", () => {
    assert.equal(resolve(sites, "https://other.org/"), null);
  });

  it("returns null for non-http urls", () => {
    assert.equal(resolve(sites, "about:blank"), null);
  });

  it("applies rules without match to the domain and its subdomains", () => {
    assert.deepEqual(resolve(sites, "https://example.com/"), { include: ".global", sets: {} });
    assert.deepEqual(resolve(sites, "https://www.example.com/"), { include: ".global", sets: {} });
  });

  it("combines include and merges sets across matching rules and files", () => {
    assert.deepEqual(resolve(sites, "https://www.example.com/watch?v=1#t=2"), {
      include: ".global, .watch",
      exclude: ".ads",
      sets: { primary: ".main" },
    });
    assert.deepEqual(resolve(sites, "https://sub.example.com/"), {
      include: ".global",
      sets: { primary: ".sub" },
    });
  });

  it("combines exclude and treats a rule with only exclude as a match", () => {
    const only_exclude: Sites = { "ads.example": [{ exclude: "nav" }, { exclude: ".ad" }] };
    assert.deepEqual(resolve(only_exclude, "https://ads.example/"), {
      exclude: "nav, .ad",
      sets: {},
    });
  });

  it("omits include and exclude when no rule sets them", () => {
    assert.deepEqual(resolve(sites, "https://old.example.com/"), {
      include: ".global",
      sets: { primary: ".old" },
    });
    assert.deepEqual(
      resolve({ "plain.example": [{ sets: { primary: ".p" } }] }, "https://plain.example/"),
      {
        sets: { primary: ".p" },
      },
    );
  });

  it("does not match lookalike domains", () => {
    assert.equal(resolve(sites, "https://notexample.com/"), null);
  });
});

describe("apply_exclude", () => {
  it("drops excluded elements and their descendants from a selector list", () => {
    assert.equal(
      apply_exclude("a, button", "nav, .ad"),
      ":is(a, button):not(:is(nav, .ad), :is(nav, .ad) *)",
    );
  });
});

describe("merge_sites", () => {
  it("concatenates rules per domain", () => {
    assert.deepEqual(
      merge_sites(
        { "a.com": [{ include: ".a" }] },
        { "a.com": [{ include: ".b" }], "b.com": [{ include: ".c" }] },
      ),
      { "a.com": [{ include: ".a" }, { include: ".b" }], "b.com": [{ include: ".c" }] },
    );
  });
});
