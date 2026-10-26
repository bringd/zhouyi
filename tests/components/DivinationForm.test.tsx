import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DivinationForm } from "@/components/sections/DivinationForm";
import { getAllRecords, clearAllRecords } from "@/lib/storage";
import { QUESTION_POOL } from "@/lib/sampleQuestions";

// Mock react-router-dom's useNavigate to avoid actual navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("DivinationForm", () => {
  it('stays on the form when the browser cannot save the result', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })
    try {
      const onResult = vi.fn()
      render(<MemoryRouter><DivinationForm initialNumbers={[129, 257, 601]} onResult={onResult} /></MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: '启 卦' }))
      expect(onResult).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('本地记录保存失败')
    } finally {
      setItem.mockRestore()
    }
  })
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    clearAllRecords();
  });

  it("renders the title and prompt", () => {
    render(
      <MemoryRouter>
        <DivinationForm />
      </MemoryRouter>,
    );
    expect(screen.getByText("三 数 起 卦")).toBeInTheDocument();
    expect(screen.getByText("问于心，发于数，止于卦")).toBeInTheDocument();
  });

  it("renders the question input", () => {
    render(
      <MemoryRouter>
        <DivinationForm />
      </MemoryRouter>,
    );
    expect(document.querySelector("textarea")).not.toBeNull();
  });

  it("renders all 3 number box labels", () => {
    render(
      <MemoryRouter>
        <DivinationForm />
      </MemoryRouter>,
    );
    expect(screen.getByText("第一灵数")).toBeInTheDocument();
    expect(screen.getByText("第二灵数")).toBeInTheDocument();
    expect(screen.getByText("第三灵数")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(
      <MemoryRouter>
        <DivinationForm />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "启 卦" })).toBeInTheDocument();
  });

  it("uses initial question and numbers when provided", () => {
    render(
      <MemoryRouter>
        <DivinationForm
          initialQuestion="my question"
          initialNumbers={[123, 456, 789]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText("my question")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("456")).toBeInTheDocument();
    expect(screen.getByDisplayValue("789")).toBeInTheDocument();
  });

  it("disables submit button when not all numbers are valid", () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, null, 789]} />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "启 卦" });
    expect(button).toBeDisabled();
  });

  it("enables submit button when all numbers are valid", () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, 456, 789]} />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "启 卦" });
    expect(button).not.toBeDisabled();
  });

  it("calls onResult with a new recordId and saves a record on submit", () => {
    const onResult = vi.fn();
    render(
      <MemoryRouter>
        <DivinationForm
          initialNumbers={[123, 456, 789]}
          initialQuestion="career"
          onResult={onResult}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "启 卦" }));

    expect(onResult).toHaveBeenCalledTimes(1);
    const recordId = onResult.mock.calls[0][0];
    expect(typeof recordId).toBe("string");
    expect(recordId.length).toBeGreaterThan(0);

    // Verify it was saved
    const records = getAllRecords();
    expect(records.length).toBe(1);
    expect(records[0].id).toBe(recordId);
    expect(records[0].question).toBe("career");
    expect(records[0].numbers).toEqual([123, 456, 789]);
    expect(records[0].type).toBe("three-number");
  });

  it("navigates to /result/:id when no onResult callback", () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, 456, 789]} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "启 卦" }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const path = mockNavigate.mock.calls[0][0];
    expect(path).toMatch(/^\/result\/[a-f0-9-]+$/);
  });

  it("saves the default question when the user does not type anything", () => {
    const onResult = vi.fn();
    render(
      <MemoryRouter>
        <DivinationForm
          initialNumbers={[123, 456, 789]}
          initialQuestion="my question"
          onResult={onResult}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "启 卦" }));

    const records = getAllRecords();
    expect(records[0].question).toBe("my question");
  });

  it("saves the user-typed question when provided", () => {
    const onResult = vi.fn();
    render(
      <MemoryRouter>
        <DivinationForm
          initialNumbers={[123, 456, 789]}
          initialQuestion="my question"
          onResult={onResult}
        />
      </MemoryRouter>,
    );

    const textarea = screen.getByPlaceholderText("my question");
    fireEvent.change(textarea, { target: { value: "用户自己写的问题" } });
    fireEvent.click(screen.getByRole("button", { name: "启 卦" }));

    const records = getAllRecords();
    expect(records[0].question).toBe("用户自己写的问题");
  });

  it("shows a random sample question as placeholder when no initialQuestion is provided", () => {
    render(
      <MemoryRouter>
        <DivinationForm />
      </MemoryRouter>,
    );
    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    const ph = textarea?.getAttribute("placeholder") ?? "";
    expect(ph.length).toBeGreaterThan(0);
  });

  it("disables submit when fields are missing so the user cannot trigger an error display yet", () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, null, null]} />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "启 卦" });
    expect(button).toBeDisabled();
  });

  it("does not render any error text before submit is attempted", () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, null, null]} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/请填写/)).not.toBeInTheDocument();
  });

  it('uses a suggested question and saves it with the chosen numbers', () => {
    render(
      <MemoryRouter>
        <DivinationForm initialNumbers={[123, 456, 789]} onResult={vi.fn()} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: '事业方向' }))
    const question = screen.getByRole('textbox', { name: '所问之事' })
    // 预置问句来自站点自己的问询池，不是演示假数据；这里断言「来自池子」而不是逐字硬编码
    const filled = (question as HTMLTextAreaElement).value
    expect(QUESTION_POOL).toContain(filled)
    expect(filled.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '事业方向' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '启 卦' }))
    expect(getAllRecords()[0].question).toBe(filled)
  })

  it('labels the number inputs and updates progress when typing or clearing', () => {
    render(<MemoryRouter><DivinationForm /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('第一灵数'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('第二灵数'), { target: { value: '456' } })
    expect(screen.getByRole('status')).toHaveTextContent('已选定 2 / 3 个灵数')
    fireEvent.change(screen.getByLabelText('第三灵数'), { target: { value: '789' } })
    expect(screen.getByRole('button', { name: '启 卦' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('第二灵数'), { target: { value: '4' } })
    expect(screen.getByLabelText('第二灵数')).toHaveValue('4')
    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('已选定 2 / 3 个灵数')
  })

  it('prevents submitting existing numbers while a new number is rolling', () => {
    const onResult = vi.fn()
    render(<MemoryRouter><DivinationForm initialNumbers={[123, 456, 789]} onResult={onResult} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '随机生成第一灵数' }))
    expect(screen.getByLabelText('第一灵数')).toBeDisabled()
    expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: '三数起卦' }))
    expect(onResult).not.toHaveBeenCalled()
    expect(getAllRecords()).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('请先停止取数，再启卦。')
    fireEvent.click(screen.getByRole('button', { name: '停止生成第一灵数' }))
    expect(screen.getByLabelText('第一灵数')).toBeEnabled()
    expect(screen.getByRole('button', { name: '启 卦' })).toBeEnabled()
  })

  it('keeps all three selections when randomizers are used together', () => {
    render(<MemoryRouter><DivinationForm onResult={vi.fn()} /></MemoryRouter>)
    for (const label of ['第一灵数', '第二灵数', '第三灵数']) {
      fireEvent.click(screen.getByRole('button', { name: `随机生成${label}` }))
    }
    for (const label of ['第一灵数', '第二灵数', '第三灵数']) {
      fireEvent.click(screen.getByRole('button', { name: `停止生成${label}` }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('已选定 3 / 3 个灵数')
    fireEvent.click(screen.getByRole('button', { name: '启 卦' }))
    expect(getAllRecords()).toHaveLength(1)
    expect(getAllRecords()[0].numbers).toHaveLength(3)
    for (const number of getAllRecords()[0].numbers ?? []) {
      expect(number).toBeGreaterThanOrEqual(100)
      expect(number).toBeLessThanOrEqual(999)
    }
  })
});
