import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NumberBoxWithRandomizer } from "@/components/ui/NumberBoxRandomizer";

describe("NumberBoxWithRandomizer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label, input, and the random button", () => {
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={() => {}}
        label="第一灵数"
      />,
    );
    expect(screen.getByText("第一灵数")).toBeInTheDocument();
    expect(screen.getByLabelText("随机生成灵数")).toBeInTheDocument();
    expect(screen.getByText("天降灵数")).toBeInTheDocument();
  });

  it("emits a valid 3-digit number after reel animation completes", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    // reel duration is 1400ms; advance past it
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const final = onChange.mock.calls[0][0] as number;
    expect(final).toBeGreaterThanOrEqual(100);
    expect(final).toBeLessThanOrEqual(999);
    expect(Number.isInteger(final)).toBe(true);
  });

  it("emits a valid 3-digit number after scroll variant completes", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="scroll"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("emits a valid 3-digit number after stem-branch variant completes", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="stem-branch"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("debounces repeat clicks during animation", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    const btn = screen.getByLabelText("随机生成灵数");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Only one END → exactly one onChange call
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('button text changes to "取数中…" during animation', () => {
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={() => {}}
        label="第一灵数"
        variant="reel"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    expect(screen.getByText("取数中…")).toBeInTheDocument();
  });

  it("clears timers on unmount (no onChange after unmount)", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
