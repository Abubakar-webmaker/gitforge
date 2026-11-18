const { spawn } = require('child_process');

const proc = spawn('npm', ['test', '--', '--run'], {
  cwd: 'c:\\Projects\\gitforge',
  stdio: 'pipe'
});

let output = '';
let errorOutput = '';

proc.stdout.on('data', (data) => {
  output += data.toString();
});

proc.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

proc.on('close', (code) => {
  // Look for the summary line
  const lines = output.split('\n');
  
  console.log('=== TEST SUMMARY ===');
  for (const line of lines) {
    if (line.includes('passed') || line.includes('failed') || line.includes('Test Files') || line.includes('FAIL') || line.includes('PASS')) {
      console.log(line);
    }
  }
  
  // Look for actual failures
  console.log('\n=== FAILURES ===');
  let inFailure = false;
  for (const line of lines) {
    if (line.includes('✖') || line.includes('FAIL')) {
      inFailure = true;
    }
    if (inFailure && (line.includes('AssertionError') || line.includes('Expected') || line.includes('Received'))) {
      console.log(line);
    }
  }
});

// Timeout after 180 seconds
setTimeout(() => {
  process.exit(1);
}, 180000);
