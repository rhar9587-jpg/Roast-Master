import { describe, expect, it } from "vitest";
import { maskEmail } from "./entitlementsStore";

describe("maskEmail", () => {
  it("masks local part while keeping domain", () => {
    expect(maskEmail("robert@gmail.com")).toBe("ro***@gmail.com");
  });

  it("handles short local parts", () => {
    expect(maskEmail("a@x.co")).toBe("a***@x.co");
  });
});
