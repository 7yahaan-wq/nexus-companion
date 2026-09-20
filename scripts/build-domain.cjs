require('esbuild').buildSync({
  entryPoints: ['src/domain/calendar.ts'],
  outfile: 'electron/generated/calendar.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
});
