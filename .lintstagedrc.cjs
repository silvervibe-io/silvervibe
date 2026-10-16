const path = require('node:path');

/** Batch Prettier invocations so Windows does not hit "command line is too long". */
module.exports = {
  '*': (filenames) => {
    const relative = filenames.map((f) =>
      path.relative(process.cwd(), f).split(path.sep).join('/'),
    );
    const batchSize = 30;
    const commands = [];
    for (let i = 0; i < relative.length; i += batchSize) {
      const batch = relative.slice(i, i + batchSize);
      commands.push(
        `prettier --write --ignore-unknown ${batch.map((f) => `"${f}"`).join(' ')}`,
      );
    }
    return commands;
  },
};
