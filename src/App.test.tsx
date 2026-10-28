import axe from "axe-core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import type { PracticeData } from "./data/types";
import rawPractices from "./data/sample-practices.json";
import { downloadBlob, generatePdf } from "./pdf/generate";

vi.mock("./pdf/generate", () => ({
  generatePdf: vi.fn(),
  downloadBlob: vi.fn(),
  pdfFileName: (plz: string) => `psychotherapie-leipzig-${plz}.pdf`,
}));

const practices = rawPractices as unknown as PracticeData;
const practiceItems = () =>
  screen.queryAllByRole("listitem").filter((li) => li.classList.contains("practice"));

describe("App", () => {
  it("always shows the crisis numbers", () => {
    render(<App />);
    expect(screen.getByText(/112/)).toBeInTheDocument();
    expect(screen.getByText(/116117/)).toBeInTheDocument();
    expect(screen.getByText(/0800 111 0 111/)).toBeInTheDocument();
  });

  it("shows the OpenStreetMap attribution in the footer", () => {
    render(<App />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("© OpenStreetMap contributors, ODbL");
  });

  it("names the page", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Psychotherapie/);
  });
});

describe("PLZ input", () => {
  const submit = (value: string) => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
  };

  it("confirms a valid Leipzig PLZ", () => {
    submit("04318");
    expect(screen.getByText(/04318 ist gültig/)).toBeInTheDocument();
  });

  it("shows an error for an invalid PLZ", () => {
    submit("01067");
    expect(screen.getByRole("alert")).toHaveTextContent(/nicht zu Leipzig/);
    expect(screen.getByLabelText(/Postleitzahl/)).toHaveAttribute("aria-invalid", "true");
  });

  it("uses role=alert without aria-live for an invalid PLZ", () => {
    submit("01067");
    const feedback = screen.getByRole("alert");
    expect(feedback).toHaveAttribute("id", "plz-feedback");
    expect(feedback).not.toHaveAttribute("aria-live");
  });

  it("uses aria-live=polite without a role for a valid PLZ", () => {
    submit("04318");
    const feedback = screen.getByText(/04318 ist gültig/);
    expect(feedback).toHaveAttribute("aria-live", "polite");
    expect(feedback).not.toHaveAttribute("role");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("privacy", () => {
  it("shows the Datenschutz section", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Datenschutz" })).toBeInTheDocument();
    expect(screen.getByText(/bleiben im Browser/)).toBeInTheDocument();
  });

  it("form has no action and prevents default submit", () => {
    const { container } = render(<App />);
    const form = container.querySelector("form")!;
    expect(form.hasAttribute("action")).toBe(false);
    expect(fireEvent.submit(form)).toBe(false);
  });
});

describe("result list", () => {
  it("shows the sample practices nearest first after entering 04318", () => {
    render(<App />);
    expect(screen.queryByRole("list", { name: "Praxen" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value: "04318" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByRole("heading", { name: "Praxen nach Entfernung" })).toBeInTheDocument();
    expect(screen.getByText(/im Umkreis von 2 km/)).toBeInTheDocument();
    const items = practiceItems();
    expect(items).toHaveLength(practices.practices.length);

    const expected = [
      "Dipl.-Psych. Erika Beispiel",
      "Dr. med. Max Muster",
      "Lena Platzhalter",
      "Dr. phil. Jonas Fiktiv",
      "Dr. med. Karl Skizze",
      "Dipl.-Psych. Sara Probe",
      "Ben Erfunden",
      "Tom Testmann",
      "Dipl.-Psych. Paul Entwurf",
      "Dr. rer. nat. Ida Demo",
      "Dipl.-Psych. Nora Annahme",
      "Mia Vorlage",
    ];
    expect(expected).toHaveLength(practices.practices.length);
    expected.forEach((name, i) => {
      expect(items[i]).toHaveTextContent(name);
      expect(items[i]).toHaveTextContent(`${i + 1}.`);
    });
    expect(screen.getByRole("button", { name: "PDF herunterladen" })).toBeEnabled();
    expect(screen.getAllByRole("link", { name: /0341/ })[0].getAttribute("href")).toMatch(
      /^tel:\d+$/,
    );
    expect(screen.getByRole("note")).toHaveTextContent("112");
  });

  it("highlights absent and inactive practices", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value: "04318" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(practices.practices.some((p) => p.absent)).toBe(true);
    expect(practices.practices.some((p) => p.inactiveHere)).toBe(true);
    expect(
      screen.getAllByText(/Laut KV abwesend von \d\d\.\d\d\.\d{4} bis/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Laut KV derzeit nicht an diesem Standort tätig").length,
    ).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  const open = () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value: "04318" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
  };

  it("shows no count or reset button while filters are off", () => {
    open();
    expect(screen.queryByRole("button", { name: "Filter zurücksetzen" })).toBeNull();
    expect(practiceItems()).toHaveLength(practices.practices.length);
  });

  it("narrows the list, shows the count and resets", () => {
    open();
    const total = practices.practices.length;
    const expected = practices.practices.filter((p) => p.video).length;
    fireEvent.click(screen.getByLabelText("Videosprechstunde"));
    expect(screen.getByText(`${expected} von ${total} Praxen`)).toBeInTheDocument();
    expect(practiceItems()).toHaveLength(expected);
    fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
    expect(practiceItems()).toHaveLength(total);
  });

  it("explains an empty result and keeps the crisis box", () => {
    // Find a language that no practice offers together with all three flags.
    const language = [...new Set(practices.practices.flatMap((p) => p.languages))].find(
      (l) =>
        !practices.practices.some(
          (p) => p.languages.includes(l) && p.video && p.accessible && p.group,
        ),
    );
    expect(language).toBeDefined();
    open();
    fireEvent.click(screen.getByLabelText("Videosprechstunde"));
    fireEvent.click(screen.getByLabelText("stufenlos/Aufzug"));
    fireEvent.click(screen.getByLabelText("Gruppentherapie"));
    fireEvent.change(screen.getByLabelText("Sprache"), { target: { value: language } });
    expect(practiceItems()).toHaveLength(0);
    expect(screen.getByText(/weiten Sie die Filter aus/)).toBeInTheDocument();
    expect(screen.getByText(/116117/)).toBeInTheDocument();
  });
});

describe("PDF download", () => {
  const open = (plz: string) => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value: plz } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
  };

  it("has no download button before a valid PLZ is set", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "PDF herunterladen" })).not.toBeInTheDocument();
  });

  it("shows progress, then downloads psychotherapie-leipzig-{plz}.pdf", async () => {
    let finish: (b: Blob) => void = () => {};
    vi.mocked(generatePdf).mockReturnValue(new Promise((r) => (finish = r)));
    open("04318");
    fireEvent.click(screen.getByRole("button", { name: "PDF herunterladen" }));
    expect(await screen.findByRole("button", { name: "PDF wird erstellt …" })).toBeDisabled();
    const blob = new Blob(["x"]);
    finish(blob);
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(blob, "psychotherapie-leipzig-04318.pdf"),
    );
    expect(await screen.findByRole("button", { name: "PDF herunterladen" })).toBeEnabled();
    const input = vi.mocked(generatePdf).mock.calls[0][0];
    expect(input.plz).toBe("04318");
    expect(input.practices).toHaveLength(practices.practices.length);
  });

  it("shows an error when generation fails", async () => {
    vi.mocked(generatePdf).mockRejectedValue(new Error("boom"));
    open("04318");
    fireEvent.click(screen.getByRole("button", { name: "PDF herunterladen" }));
    expect(await screen.findByText(/PDF konnte nicht erstellt werden/)).toBeInTheDocument();
  });
});

describe("layout and accessibility", () => {
  const enter = (value: string) => {
    fireEvent.change(screen.getByLabelText(/Postleitzahl/), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
  };
  // jsdom has no layout or CSS, so colour contrast is covered by the design tokens instead.
  const axeOptions = { rules: { "color-contrast": { enabled: false } } };

  it("has no axe violations on the start page", async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations on the list for 04318", async () => {
    const { container } = render(<App />);
    enter("04318");
    expect(practiceItems().length).toBeGreaterThan(0);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations with an error shown", async () => {
    const { container } = render(<App />);
    enter("01067");
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it("explains the three steps in the intro", () => {
    render(<App />);
    const steps = screen.getByRole("list", { name: "" });
    expect(steps).toHaveTextContent("Postleitzahl eingeben");
    expect(steps).toHaveTextContent("PDF herunterladen");
  });

  it("links the crisis numbers as tel: links", () => {
    render(<App />);
    const note = screen.getByRole("note");
    const hrefs = within(note)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["tel:112", "tel:116117", "tel:08001110111", "tel:08001110222"]);
  });

  it("shows the number of active filters on the collapsible filter button", () => {
    render(<App />);
    enter("04318");
    const toggle = screen.getByRole("button", { name: "Filter" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByLabelText("Videosprechstunde"));
    fireEvent.click(screen.getByLabelText("Gruppentherapie"));
    expect(screen.getByRole("button", { name: "Filter (2 aktiv)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filter (2 aktiv)" }));
    expect(screen.getByRole("button", { name: "Filter (2 aktiv)" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("uses no inline styles", () => {
    const { container } = render(<App />);
    enter("04318");
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("shows source and data date in the footer", () => {
    render(<App />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /Quelle: .* · Stand \d\d\.\d\d\.\d{4}/,
    );
  });
});
