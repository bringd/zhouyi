import { describe, it, expect } from "vitest";
import { buildNumberError } from "@/lib/validation";

describe("buildNumberError", () => {
  it("returns null when all three numbers are valid (100-999)", () => {
    expect(buildNumberError([100, 200, 999])).toBeNull();
    expect(buildNumberError([123, 456, 789])).toBeNull();
  });

  it("returns generic message when all three are missing", () => {
    expect(buildNumberError([null, null, null])).toBe(
      "请填写三个灵数（可手动输入或随机生成）",
    );
  });

  it("lists exactly the missing labels", () => {
    expect(buildNumberError([100, null, 200])).toBe("请填写：第二灵数");
    expect(buildNumberError([null, 100, null])).toBe(
      "请填写：第一灵数、第三灵数",
    );
  });

  it("treats out-of-range as missing", () => {
    expect(buildNumberError([99, 200, 300])).toBe("请填写：第一灵数");
    expect(buildNumberError([100, 1000, 100])).toBe("请填写：第二灵数");
  });
});
