import { describe, expect, it } from "vitest";
import { en } from "./en";
import { tr } from "./tr";

describe("UT-I18N-KEYS-001 translation dictionaries", () => {
  it("keeps Turkish and English keys identical and values non-empty", () => {
    const trKeys = Object.keys(tr).sort();
    const enKeys = Object.keys(en).sort();

    expect(enKeys).toEqual(trKeys);
    for (const key of trKeys) {
      expect(tr[key as keyof typeof tr].trim(), `${key} is empty in Turkish`).not.toBe("");
      expect(en[key as keyof typeof en].trim(), `${key} is empty in English`).not.toBe("");
    }
  });
});
