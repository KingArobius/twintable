import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchShare } from "@/components/SearchShare";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Sharing controls", () => {
  it("copies the reproducible link on desktop and confirms success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { toast } = await import("sonner");
    render(<SearchShare search={{ restaurant: "Nobu", city: "Miami" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://twintable.app/?restaurant=Nobu&city=Miami"));
    expect(toast.success).toHaveBeenCalledWith("Link copied");
  });
  it("uses native sharing on touch devices with the requested text and URL", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<SearchShare search={{ restaurant: "Nobu", city: "Miami" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Twin Table", text: "I found restaurants like Nobu in Miami on Twin Table 🍽️", url: "https://twintable.app/?restaurant=Nobu&city=Miami" }));
  });
});