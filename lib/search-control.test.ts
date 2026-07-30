import { describe, expect, it } from "vitest";
import {
  isSearchAbortError,
  throwIfSearchAborted,
  yieldSearchControl,
} from "./search-control";

describe("large-book search control", () => {
  it("throws a recognizable AbortError for cancelled searches", () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => throwIfSearchAborted(controller.signal)).toThrowError(
      expect.objectContaining({ name: "AbortError" })
    );
  });

  it("yields successfully while the search remains active", async () => {
    await expect(yieldSearchControl(new AbortController().signal)).resolves.toBeUndefined();
  });

  it("interrupts a pending yield when cancellation arrives", async () => {
    const controller = new AbortController();
    const pending = yieldSearchControl(controller.signal);
    controller.abort();

    await expect(pending).rejects.toSatisfy(isSearchAbortError);
  });
});
