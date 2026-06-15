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
  
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    // Check if the line has template string matching `${something}=${something}`
    // Or if it matches something like `id + "="` or similar
    if (/\$\{([^}]+)\}=\$\{([^}]+)\}/.test(line) || 
        /\$\{([^}]+)\}-\$\{([^}]+)\}/.test(line) ||
        /\+.*['"]=/.test(line) || 
        /['"]=.*\+/.test(line) ||
        /\+.*['"]-/.test(line) || 
        /['"]-.*\+/.test(line) ||
        /key=/.test(line) ||
        /keyExtractor/.test(line)) {
      if (!line.includes("=>") && !line.includes("==") && !line.includes("===") && !line.includes("const ") && !line.includes("let ") && !line.includes("import ")) {
        console.log(`${filePath}:${index + 1}: ${line.trim()}`);
      }
    }
  });
});
