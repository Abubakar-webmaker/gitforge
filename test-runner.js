const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('npm test -- --run 2>&1', {
    cwd: 'c:\\Projects\\gitforge',
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  
  fs.writeFileSync('test-results.txt', output);
  console.log('Test results written to test-results.txt');
  console.log('Lines:', output.split('\n').length);
} catch (error) {
  fs.writeFileSync('test-results.txt', error.stdout + '\n\nSTDERR:\n' + error.stderr);
  console.log('Test results (with errors) written to test-results.txt');
}
