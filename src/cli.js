const { handleAuthCommand } = require('./commands/auth');
const { handleProfilesCommand } = require('./commands/profiles');

async function run(args) {
  const [command, subcommand, ...rest] = args;

  if (!command) {
    printHelp();
    return;
  }

  if (['login', 'logout', 'whoami'].includes(command)) {
    await handleAuthCommand(command, rest);
    return;
  }

  if (command === 'profiles') {
    if (!subcommand) {
      console.error('Please specify a subcommand (list, get, search, create, export)');
      console.log('Use: insighta profiles <subcommand> --help');
      return;
    }
    await handleProfilesCommand(subcommand, rest);
    return;
  }

  console.log(`Command not implemented yet: ${command}`);
}

function printHelp() {
  console.log(`
Insighta CLI - Stage 3

Usage:
  insighta login
  insighta logout
  insighta whoami
  insighta profiles list [options]
  insighta profiles get <id>
  insighta profiles search --q "query"
  insighta profiles create --name "Name"
  insighta profiles export --q "query" --output file.csv

For more details on a command, run it with --help.
  `);
}

module.exports = { run };