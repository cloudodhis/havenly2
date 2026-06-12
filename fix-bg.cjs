const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
  { regex: /min-h-screen flex flex-col bg-purple-600 text-white/g, replacement: 'min-h-screen flex flex-col bg-white text-gray-900' },
  { regex: /min-h-screen bg-purple-600 text-white/g, replacement: 'min-h-screen bg-white text-gray-900' },
  { regex: /className="w-full h-14 rounded-lg border border-gray-200 bg-purple-600 text-white px-4 py-2 text-lg focus:border-purple-600 outline-none transition-colors appearance-none"/g, replacement: 'className="w-full h-14 rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2 text-lg focus:border-purple-600 outline-none transition-colors appearance-none"' },
  { regex: /className="w-5 h-5 rounded border-gray-300 bg-purple-600 text-white focus:ring-purple-600"/g, replacement: 'className="w-5 h-5 rounded border-gray-300 bg-white text-purple-600 focus:ring-purple-600"' },
  { regex: /bg-purple-600 text-gray-500/g, replacement: 'bg-white text-gray-500' },
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
