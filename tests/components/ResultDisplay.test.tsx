import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResultDisplay } from "@/components/sections/ResultDisplay";
import { saveRecord, clearAllRecords } from "@/lib/storage";
import type { UserRecord } from "@/types";

// Mock the AI module to avoid actual network calls
vi.mock("@/lib/ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return {
    ...actual,
    generateInterpretation: vi.fn(),
  };
});

import { generateInterpretation } from "@/lib/ai";
const mockedGenerate = generateInterpretation as unknown as ReturnType<typeof vi.fn>;

const baseRecord: UserRecord = {
  id: "test-record-1",
  type: "three-number",
  createdAt: 1_700_000_000_000,
  question: "Should I make this decision?",
  numbers: [123, 456, 789],
  region: "Asia/Shanghai",
  timezone: "Asia/Shanghai",
  mainHexagramId: 1,
  movingLine: 1,
  changedHexagramId: 2,
  version: 1,
};

// A record that has already been AI-interpreted (cached result)
const cachedRecord: UserRecord = {
  ...baseRecord,
  aiInterpretation: "## 卦象概要\n乾为天，刚健之象……",
};

describe("ResultDisplay", () => {
  beforeEach(() => {
    clearAllRecords();
    mockedGenerate.mockReset();
  });

  it("renders not-found message when record does not exist", () => {
    render(
      <MemoryRouter>
        <ResultDisplay recordId="non-existent-id" />
      </MemoryRouter>,
    );
    expect(screen.getByText("未找到该起卦记录")).toBeInTheDocument();
    expect(screen.getByText("重新起卦")).toBeInTheDocument();
  });

  it("renders the header and main hexagram name", () => {
    saveRecord(baseRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("卦 象 已 成")).toBeInTheDocument();
    expect(screen.getAllByText("乾为天").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/第\s*1\s*爻/i).length).toBeGreaterThan(0);
  });

  it("renders the 卦象详解 button and triggers streaming AI on click", async () => {
    saveRecord(baseRecord);
    mockedGenerate.mockResolvedValue({ text: "AI 解读文本", chunks: ["AI 解读文本"] });

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "卦象详解" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockedGenerate).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/AI 解读文本/)).toBeInTheDocument();
  });

  // SEMANTIC ANCHOR — must not regress to static JSON content.
  // Without this test, anyone could "simplify" the button back to a static
  // modernInterpretation reader and the suite would still be green.
  it("SEMANTIC ANCHOR: generateInterpretation is called with the user's question and the hexagram context", async () => {
    saveRecord(baseRecord);
    mockedGenerate.mockResolvedValue({ text: "ok", chunks: ["ok"] });

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "卦象详解" }));

    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1));

    const args = mockedGenerate.mock.calls[0] as [unknown, unknown, unknown];
    const input = args[0] as {
      mainHexagram: { id: number; name: string };
      changedHexagram: { id: number; name: string };
      movingLine: number;
      question: string | undefined;
    };

    expect(input.question).toBe(baseRecord.question);
    expect(input.mainHexagram.id).toBe(baseRecord.mainHexagramId);
    expect(input.changedHexagram.id).toBe(baseRecord.changedHexagramId);
    expect(input.movingLine).toBe(baseRecord.movingLine);
    expect(args[1]).toBeNull(); // apiKey=null => server-side demo key
  });

  it("streamed chunks accumulate into aiText", async () => {
    saveRecord(baseRecord);
    mockedGenerate.mockImplementation(
      async (_input, _apiKey, onChunk?: (c: string) => void) => {
        onChunk?.("第一段");
        onChunk?.("第二段");
        onChunk?.("第三段");
        return { text: "第一段第二段第三段", chunks: ["第一段", "第二段", "第三段"] };
      },
    );

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "卦象详解" }));

    await waitFor(() => {
      expect(screen.getByText(/第三段/)).toBeInTheDocument();
    });
  });

  it("shows the 重试 button + an error message on AIError and re-calls on retry", async () => {
    saveRecord(baseRecord);
    const aiError = new (await import("@/lib/ai")).AIError("rate limited", "rate-limit");
    mockedGenerate.mockRejectedValueOnce(aiError).mockResolvedValueOnce({
      text: "OK 第二次成功",
      chunks: ["OK 第二次成功"],
    });

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "卦象详解" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/rate limited/);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(screen.getByText(/OK 第二次成功/)).toBeInTheDocument();
    });
  });

  it("works with no question (the AI prompt has a fallback branch)", async () => {
    const noQuestion: UserRecord = { ...baseRecord, question: undefined };
    saveRecord(noQuestion);
    mockedGenerate.mockResolvedValue({ text: "通用解读", chunks: ["通用解读"] });

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "卦象详解" }));

    await waitFor(() => expect(mockedGenerate).toHaveBeenCalledTimes(1));
    const args = mockedGenerate.mock.calls[0] as [unknown, unknown, unknown];
    const input = args[0] as { question: string | undefined };
    expect(input.question).toBeUndefined();
    expect(await screen.findByText(/通用解读/)).toBeInTheDocument();
  });

  it("cached aiInterpretation: button gone, content rendered directly", () => {
    saveRecord(cachedRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "卦象详解" })).not.toBeInTheDocument();
    expect(screen.getByText(/刚健之象/)).toBeInTheDocument();
    expect(screen.getByText("卦象概要")).toBeInTheDocument();
  });

  it("does not render any old AI 解读 UI artifacts (button text, error text)", () => {
    saveRecord(baseRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("AI 解 读")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(screen.queryByText(/解读中|生成中/)).not.toBeInTheDocument();
  });

  it("renders twin spread with 本卦/变卦 labels", () => {
    saveRecord(baseRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("本卦")).toBeInTheDocument();
    expect(screen.getByText("变卦")).toBeInTheDocument();
  });

  it("renders the action buttons (template ①)", () => {
    saveRecord(baseRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /收藏本卦/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发布到社区/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /再起一卦/ })).toBeInTheDocument();
  });
});
