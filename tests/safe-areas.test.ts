import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("system UI safe-area contract", () => {
  it("enables safe-area viewport handling on installed web apps", () => {
    const layout = read("../src/app/layout.tsx");
    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).toContain('import "./safe-areas.css"');
  });

  it("reserves clock, notch, navigation and side-cutout space across every entry screen", () => {
    const css = read("../src/app/safe-areas.css");
    for (const variable of ["top", "bottom", "left", "right"]) {
      expect(css).toContain(`env(safe-area-inset-${variable}, 0px)`);
    }
    for (const selector of [".topbar", ".intro-page", ".auth-shell", ".onboard-brand", ".mobile-nav", ".mobile-fab", ".modal-backdrop"]) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("@media (max-width: 580px)");
  });

  it("keeps Android WebView within the visible bars and above the soft keyboard", () => {
    const activity = read("../android/app/src/main/java/com/hisabtechnologies/mezgeb/MainActivity.java");
    expect(activity).toContain("setDecorFitsSystemWindows(false)");
    expect(activity).toContain("WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()");
    expect(activity).toContain("WindowInsets.Type.ime()");
    expect(activity).toContain("Math.max(bars.bottom, keyboard.bottom)");
    expect(activity).toContain("params.setMargins(bars.left, bars.top, bars.right, safeBottom)");
    expect(activity).not.toContain("FLAG_FULLSCREEN");
  });
});
