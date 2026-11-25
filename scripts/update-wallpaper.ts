import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { chromium } from "playwright-core";

const defaultUrl = "https://www.wilfred.me.uk/voxel-scenes/";

async function downloadWallpaper(url: URL, directory: string) {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.setDefaultTimeout(120_000);
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded" });
    if (!response?.ok()) throw new Error(`Could not load Voxel Scenes (HTTP ${response?.status()}).`);

    const status = await page.locator("#status").textContent();
    if (status?.includes("WebGL")) throw new Error(status);
    await page.locator("#seed").filter({ hasText: /\d+$/ }).waitFor({ state: "attached" });

    // The site's idle controls can be hidden by the time a headless render finishes.
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#save").dispatchEvent("click")]);
    const filename = basename(download.suggestedFilename());
    if (!filename.endsWith(".png")) throw new Error("The site did not export a PNG.");

    const path = join(directory, filename);
    const temporaryDirectory = await mkdtemp(join(directory, ".download-"));
    try {
      const temporaryFile = join(temporaryDirectory, filename);
      await download.saveAs(temporaryFile);
      await rename(temporaryFile, path);
      return path;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.platform !== "darwin") throw new Error("Run this script on macOS.");
  const url = new URL(process.argv[2] ?? defaultUrl);
  url.searchParams.delete("seed");
  const directory = join(homedir(), "Pictures", "Voxel Scenes");
  await mkdir(directory, { recursive: true });
  const path = await downloadWallpaper(url, directory);
  console.log(`Saved ${path}`);

  execFileSync(
    "/usr/bin/osascript",
    [
      "-l",
      "JavaScript",
      "-e",
      `
    ObjC.import("AppKit");
    function run(argv) {
      var image = $.NSURL.fileURLWithPath(argv[0]);
      var screens = $.NSScreen.screens;
      if (screens.count === 0) throw new Error("No displays in this macOS session.");
      var workspace = $.NSWorkspace.sharedWorkspace;
      for (var i = 0; i < screens.count; i++) {
        var error = Ref();
        if (!workspace.setDesktopImageURLForScreenOptionsError(image, screens.objectAtIndex(i), $.NSDictionary.dictionary, error)) {
          throw new Error(ObjC.unwrap(error[0].localizedDescription));
        }
      }
    }
  `,
      path,
    ],
    { stdio: "inherit" },
  );
  console.log("Wallpaper updated.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
