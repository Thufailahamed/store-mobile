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
  
  // Search for pattern: `${...}=${...}` or similar template strings or concatenated strings containing =
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (line.includes("=") && (line.includes("`") || line.includes("'") || line.includes('"'))) {
      // Exclude simple things like variable declarations or default values
      if (!line.trim().startsWith("const ") && !line.trim().startsWith("let ") && !line.trim().startsWith("import ")) {
        console.log(`${filePath}:${index + 1}: ${line}`);
      }
    }
  });
});
