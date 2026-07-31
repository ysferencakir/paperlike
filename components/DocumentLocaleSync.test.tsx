import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "@/store/useLocaleStore";
import { DocumentLocaleSync } from "./DocumentLocaleSync";

describe("DocumentLocaleSync", () => {
  afterEach(() => {
    act(() => useLocaleStore.getState().setLocale("tr"));
  });

  it("keeps the root document language aligned with the selected locale", () => {
    render(<DocumentLocaleSync />);
    expect(document.documentElement.lang).toBe("tr");

    act(() => useLocaleStore.getState().setLocale("en"));
    expect(document.documentElement.lang).toBe("en");
  });
});
