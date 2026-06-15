const fs = require("fs");
const path = require("path");

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== "node_modules" && f !== ".expo" && f !== ".git") {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const searchDir = "/Users/thufailahamed/Downloads/store-main/store-mobile";

walkDir(searchDir, (filePath) => {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return;
  const content = fs.readFileSync(filePath, "utf8");
  
  // Find key={...} where the content inside {...} contains = but not =>
  // Let's do it using regex: key=\{([^}]+)\}
  const keyRegex = /key=\{([^}]+)\}/g;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    const inside = match[1];
    if (inside.includes("=") && !inside.includes("=>")) {
      console.log(`FOUND KEY WITH '=': ${filePath} -> key={${inside}}`);
    }
  }

  // Find keyExtractor={...} where the content inside {...} contains = but not =>
  const extRegex = /keyExtractor=\{([^}]+)\}/g;
  while ((match = extRegex.exec(content)) !== null) {
    const inside = match[1];
    if (inside.includes("=") && !inside.includes("=>")) {
      console.log(`FOUND KEYEXTRACTOR WITH '=': ${filePath} -> keyExtractor={${inside}}`);
    }
  }
});
