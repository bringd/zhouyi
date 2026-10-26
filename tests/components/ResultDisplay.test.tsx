import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ResultDisplay } from "@/components/sections/ResultDisplay";
import { saveRecord, getRecord, clearAllRecords } from "@/lib/storage";
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

// The "收藏到卦册" button talks to the Worker; mock it so tests stay
// offline and can assert the mapped payload.
vi.mock("@/lib/records", () => ({
  saveCloudRecord: vi.fn(),
}));

import { saveCloudRecord } from "@/lib/records";
const mockedSaveCloud = saveCloudRecord as unknown as ReturnType<typeof vi.fn>;

vi.mock('@/lib/feed', () => ({ publishPost: vi.fn() }))
vi.mock('@/lib/imageGen', async () => {
  const actual = await vi.importActual<typeof import('@/lib/imageGen')>('@/lib/imageGen')
  return { ...actual, downloadCardPng: vi.fn() }
})
import { publishPost } from '@/lib/feed'
import { downloadCardPng } from '@/lib/imageGen'
const mockedPublish = vi.mocked(publishPost)
const mockedDownload = vi.mocked(downloadCardPng)

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
  it('keeps generated text visible and warns when its cache cannot be saved', async () => {
    saveRecord(baseRecord)
    mockedGenerate.mockResolvedValue({ text: '本次解读正文', chunks: ['本次解读正文'] })
    render(<MemoryRouter><ResultDisplay recordId={baseRecord.id} /></MemoryRouter>)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: '卦象详解' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('未能保存到浏览器')
      expect(screen.getByText('本次解读正文')).toBeInTheDocument()
      expect(screen.queryByText('已保存的解读')).not.toBeInTheDocument()
      expect(getRecord(baseRecord.id)?.aiInterpretation).toBeUndefined()
    } finally {
      setItem.mockRestore()
    }
  })
  beforeEach(() => {
    clearAllRecords();
    mockedGenerate.mockReset();
    mockedSaveCloud.mockReset();
    mockedPublish.mockReset()
    mockedDownload.mockReset()
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
    expect(screen.getByRole("button", { name: /下载卦象卡/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发布到社区/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /再起一卦/ })).toBeInTheDocument();
  });

  it("renders the 收藏到卦册 button", () => {
    saveRecord(baseRecord);
    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /收藏到卦册/ })).toBeInTheDocument();
  });

  it("saves the record to the cloud with the mapped payload, then locks the button", async () => {
    saveRecord(baseRecord);
    mockedSaveCloud.mockResolvedValue({ id: "cloud-9", createdAt: 1 });

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /收藏到卦册/ }));

    await waitFor(() => expect(mockedSaveCloud).toHaveBeenCalledTimes(1));
    const payload = mockedSaveCloud.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.type).toBe("three-number");
    expect(payload.numbers).toEqual([123, 456, 789]);
    expect(payload.mainHexagramId).toBe(1);
    expect(payload.changedHexagramId).toBe(2);
    expect(payload.movingLine).toBe(1);
    expect(payload.question).toBe(baseRecord.question);

    expect(await screen.findByRole("button", { name: /已收藏/ })).toBeDisabled();
    expect(await screen.findByText("已收藏到云端卦册")).toBeInTheDocument();
  });

  it("falls back to a local-only toast when the cloud save fails", async () => {
    saveRecord(baseRecord);
    mockedSaveCloud.mockRejectedValue(new Error("HTTP 500 Internal Server Error"));

    render(
      <MemoryRouter>
        <ResultDisplay recordId="test-record-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /收藏到卦册/ }));

    expect(
      await screen.findByText("云端暂不可用，记录已存本地"),
    ).toBeInTheDocument();
    // Still retryable.
    expect(screen.getByRole("button", { name: /收藏到卦册/ })).toBeInTheDocument();
  });

  it('only requests interpretation after a click and persists the completed stream', async () => {
    saveRecord(baseRecord)
    let finish: (() => void) | undefined
    mockedGenerate.mockImplementation((_input, _apiKey, onChunk?: (chunk: string) => void) => new Promise((resolve) => {
      onChunk?.('## 卦象概要\n正在展开的第一段')
      finish = () => resolve({ text: '## 卦象概要\n完整的解读', chunks: ['完整的解读'] })
    }))
    render(<MemoryRouter><ResultDisplay recordId={baseRecord.id} /></MemoryRouter>)
    expect(mockedGenerate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '卦象详解' }))
    expect(await screen.findByText('正在展开的第一段')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '解读中…' })).toBeDisabled()
    await act(async () => { finish?.() })
    expect(await screen.findByText('完整的解读')).toBeInTheDocument()
    expect(getRecord(baseRecord.id)?.aiInterpretation).toBe('## 卦象概要\n完整的解读')
    expect(screen.getByText('已保存的解读')).toBeInTheDocument()
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })

  it('treats a whitespace-only cached reading as empty', () => {
    saveRecord({ ...baseRecord, aiInterpretation: '   ' })
    render(<MemoryRouter><ResultDisplay recordId={baseRecord.id} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '卦象详解' })).toBeInTheDocument()
    expect(mockedGenerate).not.toHaveBeenCalled()
  })

  it('downloads the paired hexagram card with the saved interpretation', async () => {
    saveRecord(cachedRecord)
    mockedDownload.mockResolvedValue(undefined)
    render(<MemoryRouter><ResultDisplay recordId={baseRecord.id} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '下载卦象卡' }))
    await waitFor(() => expect(mockedDownload).toHaveBeenCalledTimes(1))
    expect(mockedDownload).toHaveBeenCalledWith(expect.objectContaining({
      main: expect.objectContaining({ id: 1 }),
      changed: expect.objectContaining({ id: 2 }),
      movingLine: 1,
      aiSummary: cachedRecord.aiInterpretation,
    }), '易象阁-起卦-乾为天.png')
    expect(await screen.findByText('已下载卦象卡')).toBeInTheDocument()
  })

  it('publishes the current question and summary and links to the community', async () => {
    saveRecord(cachedRecord)
    mockedPublish.mockResolvedValue({ id: 'post-test', createdAt: '2026-10-22T00:00:00Z' })
    render(<MemoryRouter><ResultDisplay recordId={baseRecord.id} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '发布到社区' }))
    await waitFor(() => expect(mockedPublish).toHaveBeenCalledTimes(1))
    expect(mockedPublish).toHaveBeenCalledWith(expect.objectContaining({
      mainHexagramId: 1,
      changedHexagramId: 2,
      movingLine: 1,
      question: baseRecord.question,
      aiSummary: cachedRecord.aiInterpretation,
    }))
    expect(await screen.findByRole('link', { name: '已发布 · 查看' })).toHaveAttribute('href', '/feed')
    expect(screen.queryByRole('button', { name: '发布到社区' })).not.toBeInTheDocument()
  })
});
