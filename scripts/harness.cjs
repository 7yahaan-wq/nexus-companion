require('./verification-runner.cjs')
  .runCli(process.argv.includes('--full') ? 'full' : 'core', ['--full', '--resume'])
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
