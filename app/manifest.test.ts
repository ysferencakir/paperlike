import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("UT-PWA-MANIFEST-001 web app manifest", () => {
  it("defines an installable standalone application shell", () => {
    const value = manifest();

    expect(value).toMatchObject({
      name: expect.stringContaining("Paperlike"),
      short_name: "Paperlike",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#fbfaf8",
      theme_color: "#fbfaf8",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "any", purpose: "any" }),
        expect.objectContaining({ sizes: "any", purpose: "maskable" }),
      ])
    );
  });
});
