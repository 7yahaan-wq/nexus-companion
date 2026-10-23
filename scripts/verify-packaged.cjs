require('./verification-runner.cjs')
  .runCli('packaged')
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
