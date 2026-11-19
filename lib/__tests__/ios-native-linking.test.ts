/**
 * Every dependency that ships an iOS podspec must be in ios/Podfile.lock.
 *
 * App Review rejected 1.0.1 (2) because expo-video was added to package.json
 * without re-running `pod install`: the JS bundle imported it, the binary had
 * no ExpoVideo native module, and the home screen threw
 * "Cannot find native module 'ExpoVideo'" on launch, which crashed the app.
 * Fix a failure here with: cd ios && pod install
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const lockPath = join(root, "ios", "Podfile.lock");

function podspecName(pkgDir: string): string | null {
  for (const sub of ["ios", "", "apple"]) {
    const dir = join(pkgDir, sub);
    if (!existsSync(dir)) continue;
    const spec = readdirSync(dir).find((f) => f.endsWith(".podspec"));
    if (spec) return spec.replace(/\.podspec$/, "");
  }
  return null;
}

describe("iOS native linking", () => {
  it.skipIf(!existsSync(lockPath))("links every native dependency in Podfile.lock", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const lock = readFileSync(lockPath, "utf8");
    const missing: string[] = [];
    for (const dep of Object.keys(pkg.dependencies)) {
      const dir = join(root, "node_modules", dep);
      if (!existsSync(dir)) continue;
      const pod = podspecName(dir);
      if (pod && !lock.includes(`\n  - ${pod} `)) missing.push(`${dep} (${pod})`);
    }
    expect(missing, "run `cd ios && pod install`").toEqual([]);
  });
});
