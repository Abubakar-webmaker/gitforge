#!/usr/bin/env node

// Test compression sync functions
try {
  const compress = await import('./dist/objects/compress.js');
  const data = Buffer.from('Hello, World!');
  const compressed = compress.compressObjectSync(data);
  const decompressed = compress.decompressObjectSync(compressed);
  console.log('✓ Compression sync functions exported and working');
} catch (e) {
  console.log('✗ Compression sync error:', e.message);
}

// Test hash values
try {
  const hash = await import('./dist/objects/hash.js');
  const emptyHash = hash.hashObject('blob', Buffer.from(''));
  const helloHash = hash.hashObject('blob', Buffer.from('Hello, World!'));
  
  console.log('\nHash values:');
  console.log('Empty blob:     ', emptyHash);
  console.log('Expected:        e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  console.log('Match:', emptyHash === 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391' ? '✓' : '✗');
  
  console.log('\nHello, World!:  ', helloHash);
  console.log('Expected:        b45ef6fec89518d314f546fd6c3025367b721684');
  console.log('Match:', helloHash === 'b45ef6fec89518d314f546fd6c3025367b721684' ? '✓' : '✗');
} catch (e) {
  console.log('✗ Hash error:', e.message);
}

// Test tree entry
try {
  const tree = await import('./dist/objects/tree.js');
  const entry = tree.createTreeEntry('file.txt', 'a'.repeat(40), false);
  console.log('\n✓ Tree entry created successfully');
  console.log('  Mode:', entry.mode, '(expected 33188)');
} catch (e) {
  console.log('✗ Tree error:', e.message);
}
