import { hashObject } from './dist/objects/hash.js';
import { compressObjectSync, decompressObjectSync } from './dist/objects/compress.js';
import { createBlob, hashBlob } from './dist/objects/blob.js';

console.log('Testing hash object:');
const emptyHash = hashObject('blob', Buffer.from(''));
console.log('Empty blob hash:', emptyHash);
console.log('Expected:        e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
console.log('Match:', emptyHash === 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');

console.log('\nTesting compress sync:');
try {
  const data = Buffer.from('Hello, World!');
  const compressed = compressObjectSync(data);
  const decompressed = decompressObjectSync(compressed);
  console.log('Compression works:', decompressed.toString() === 'Hello, World!');
} catch (e) {
  console.error('Compression error:', e.message);
}

console.log('\nTesting blob creation:');
try {
  const blob = createBlob(Buffer.from('test content'));
  const hash = hashBlob(blob);
  console.log('Blob hash created:', hash.length === 40);
  console.log('Hash:', hash);
} catch (e) {
  console.error('Blob error:', e.message);
}
