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
  
  // Search for key={...}
  const keyMatches = content.match(/key=\{([^}]+)\}/g);
  if (keyMatches) {
    for (const match of keyMatches) {
      // Remove arrow functions from match
      let cleanMatch = match.replace(/=>/g, "");
      if (cleanMatch.includes("=") || cleanMatch.includes("`") || cleanMatch.includes("+")) {
        console.log(`${filePath}: key match: ${match}`);
      }
    }
  }

  // Search for keyExtractor={...}
  const extMatches = content.match(/keyExtractor=\{([^}]+)\}/g);
  if (extMatches) {
    for (const match of extMatches) {
      let cleanMatch = match.replace(/=>/g, "");
      if (cleanMatch.includes("=") || cleanMatch.includes("`") || cleanMatch.includes("+")) {
        console.log(`${filePath}: keyExtractor match: ${match}`);
      }
    }
  }
});
