const fs = require('fs');
const path = require('path');

function convertESMtoCJS(content) {
  // Convert default import: import x from 'y';
  content = content.replace(
    /^import\s+([\w$]+)\s+from\s+['"](.+)['"];?/gm,
    "const $1 = require('$2');"
  );

  // Convert named import: import { a, b } from 'y';
  content = content.replace(
    /^import\s+\{([^}]+)\}\s+from\s+['"](.+)['"];?/gm,
    (match, imports, mod) => {
      return `const {${imports.trim()}} = require('${mod}');`;
    }
  );

  // Convert side-effect import: import 'y';
  content = content.replace(
    /^import\s+['"](.+)['"];?/gm,
    "require('$1');"
  );

  // Convert export default
  content = content.replace(
    /^export\s+default\s+/gm,
    'module.exports = '
  );

  // Convert named exports
  content = content.replace(
    /^export\s+\{([^}]+)\};?/gm,
    (match, exports) => {
      return exports
        .split(',')
        .map((e) => `module.exports.${e.trim()} = ${e.trim()};`)
        .join('\n');
    }
  );

  return content;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const converted = convertESMtoCJS(content);

      if (converted !== content) {
        fs.writeFileSync(fullPath, converted, 'utf8');
        console.log(`✅ Converted: ${fullPath}`);
      }
    }
  }
}

// 🏁 Run the script from the project root
processDirectory(process.cwd());
