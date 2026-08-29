import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, buttonClassName } from "@/shared/ui/button";

describe("buttonClassName", () => {
  it("includes primary and size tokens", () => {
    const classes = buttonClassName({ variant: "primary", size: "md" });
    expect(classes).toContain("bg-[var(--color-primary)]");
    expect(classes).toContain("min-h-[52px]");
  });

  it("includes secondary tokens and extra className", () => {
    const classes = buttonClassName({ variant: "secondary", size: "md", className: "w-full" });
    expect(classes).toContain("border");
    expect(classes).toContain("w-full");
  });

  it("keeps Button as a native button element", () => {
    render(<Button variant="primary">Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
