require('./verification-runner.cjs')
  .runCli('full')
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
