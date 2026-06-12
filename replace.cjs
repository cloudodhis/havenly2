const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
  { regex: /bg-black/g, replacement: 'bg-white' },
  { regex: /bg-\[\#1A1A1A\]/g, replacement: 'bg-gray-50' },
  { regex: /bg-\[\#111\]/g, replacement: 'bg-white' },
  { regex: /text-white/g, replacement: 'text-gray-900' },
  { regex: /border-white\/10/g, replacement: 'border-gray-200' },
  { regex: /border-white\/5/g, replacement: 'border-gray-100' },
  { regex: /border-white\/20/g, replacement: 'border-gray-300' },
  { regex: /bg-white\/5/g, replacement: 'bg-gray-100' },
  { regex: /bg-white\/10/g, replacement: 'bg-gray-200' },
  { regex: /bg-white\/20/g, replacement: 'bg-gray-300' },
  { regex: /hover:bg-white\/5/g, replacement: 'hover:bg-gray-100' },
  { regex: /hover:bg-white\/10/g, replacement: 'hover:bg-gray-200' },
  { regex: /hover:bg-white\/20/g, replacement: 'hover:bg-gray-300' },
  { regex: /text-gray-400/g, replacement: 'text-gray-500' },
  { regex: /text-gray-300/g, replacement: 'text-gray-600' },
  { regex: /border-gray-800/g, replacement: 'border-gray-200' },
  { regex: /bg-white text-black/g, replacement: 'bg-purple-600 text-white' },
  { regex: /bg-white text-gray-900/g, replacement: 'bg-purple-600 text-white' }, // since text-white was replaced
  { regex: /hover:bg-gray-200/g, replacement: 'hover:bg-purple-700' },
  { regex: /fill-white/g, replacement: 'fill-purple-600' },
  { regex: /border-white/g, replacement: 'border-purple-600' },
  { regex: /focus:border-white/g, replacement: 'focus:border-purple-600' },
  { regex: /ring-white/g, replacement: 'ring-purple-600' },
  { regex: /bg-\[\#8E9A9F\]\/60/g, replacement: 'bg-white/80' },
  { regex: /bg-\[\#8E9A9F\]\/40/g, replacement: 'bg-white/60' },
  { regex: /bg-\[\#8E9A9F\]\/80/g, replacement: 'bg-gray-100/80' },
  { regex: /bg-\[\#1A1F2C\]\/95/g, replacement: 'bg-white/95' },
  { regex: /bg-\[\#1A1F2C\]\/80/g, replacement: 'bg-white/80' },
  { regex: /text-white\/60/g, replacement: 'text-gray-500' },
  { regex: /text-white\/40/g, replacement: 'text-gray-400' },
  { regex: /text-white\/70/g, replacement: 'text-gray-600' },
  { regex: /text-white\/20/g, replacement: 'text-gray-300' },
  { regex: /border-white\/30/g, replacement: 'border-gray-300' },
  { regex: /border-white\/40/g, replacement: 'border-gray-400' },
  { regex: /hover:border-white\/20/g, replacement: 'hover:border-gray-300' },
  { regex: /hover:border-white\/30/g, replacement: 'hover:border-gray-400' },
  { regex: /hover:text-white/g, replacement: 'hover:text-purple-600' },
  { regex: /bg-indigo-600/g, replacement: 'bg-purple-600' },
  { regex: /text-indigo-600/g, replacement: 'text-purple-600' },
  { regex: /border-indigo-600/g, replacement: 'border-purple-600' },
  { regex: /bg-blue-500/g, replacement: 'bg-purple-500' },
  { regex: /text-blue-500/g, replacement: 'text-purple-600' },
  { regex: /border-blue-500/g, replacement: 'border-purple-500' },
  { regex: /bg-black\/80/g, replacement: 'bg-gray-900/80' },
  { regex: /bg-black\/90/g, replacement: 'bg-gray-900/90' },
  { regex: /bg-black\/60/g, replacement: 'bg-gray-900/60' },
  { regex: /bg-black\/50/g, replacement: 'bg-gray-900/50' },
  { regex: /bg-black\/40/g, replacement: 'bg-gray-900/40' },
  { regex: /bg-black\/20/g, replacement: 'bg-gray-900/20' },
  { regex: /text-gray-900\/60/g, replacement: 'text-gray-500' },
  { regex: /text-gray-900\/40/g, replacement: 'text-gray-400' },
  { regex: /text-gray-900\/70/g, replacement: 'text-gray-600' },
  { regex: /text-gray-900\/20/g, replacement: 'text-gray-300' },
  { regex: /border-purple-600\/10/g, replacement: 'border-purple-200' },
  { regex: /border-purple-600\/5/g, replacement: 'border-purple-100' },
  { regex: /border-purple-600\/20/g, replacement: 'border-purple-300' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;

      for (const { regex, replacement } of replacements) {
        content = content.replace(regex, replacement);
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
      }
    }
  }
}

processDirectory(directoryPath);
