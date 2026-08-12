import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DivinationForm } from "@/components/sections/DivinationForm";
import { getAllRecords, clearAllRecords } from "@/lib/storage";

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
});
