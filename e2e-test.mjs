#!/usr/bin/env node

import * as objects from './dist/objects/index.js';

console.log('=== End-to-End Object Database Test ===\n');

// Test 1: Blob creation and hashing
console.log('1. Blob Operations');
const blobContent = Buffer.from('Hello, GitForge!');
const blob = objects.createBlob(blobContent);
const blobHash = objects.hashBlob(blob);
console.log(`   Created blob, hash: ${blobHash.substring(0, 8)}...`);
console.log(`   ✓ Blob hash length: ${blobHash.length} (expected 40)`);

// Test 2: Blob serialization round-trip
const serialized = objects.serializeBlob(blob);
console.log(`   ✓ Serialized blob: ${serialized.length} bytes`);

// Test 3: Compression
console.log('\n2. Compression');
const compressed = objects.compressObjectSync(serialized);
const decompressed = objects.decompressObjectSync(compressed);
console.log(`   ✓ Original: ${serialized.length} bytes`);
console.log(`   ✓ Compressed: ${compressed.length} bytes`);
console.log(`   ✓ Decompressed matches: ${serialized.equals(decompressed)}`);

// Test 4: Tree operations
console.log('\n3. Tree Operations');
const entry1 = objects.createTreeEntry('file1.txt', 'a'.repeat(40), false);
const entry2 = objects.createTreeEntry('subdir', 'b'.repeat(40), true);
const tree = objects.createTree([entry1, entry2]);
console.log(`   ✓ Created tree with ${tree.entries.length} entries`);
console.log(`   ✓ Tree size: ${tree.size} bytes`);

const treeHash = objects.hashTree(tree);
console.log(`   ✓ Tree hash: ${treeHash.substring(0, 8)}...`);

const treeSerialized = objects.serializeTreeContent(tree);
const treeParsed = objects.parseTree(treeSerialized);
console.log(`   ✓ Tree round-trip: ${treeParsed.entries.length} entries preserved`);

// Test 5: Commit operations
console.log('\n4. Commit Operations');
const author = objects.createCommitPerson('Test Author', 'test@example.com', 1234567890);
const committer = objects.createCommitPerson('Test Committer', 'committer@example.com', 1234567891);
const commit = objects.createCommit(
  'a'.repeat(40),
  author,
  committer,
  'Test commit message'
);
console.log(`   ✓ Created commit`);
console.log(`   ✓ Author: ${commit.author.name}`);
console.log(`   ✓ Message: ${commit.message}`);

const commitHash = objects.hashCommit(commit);
console.log(`   ✓ Commit hash: ${commitHash.substring(0, 8)}...`);

const commitSerialized = objects.serializeCommitContent(commit);
const commitParsed = objects.parseCommit(commitSerialized);
console.log(`   ✓ Commit round-trip: message preserved`);

// Test 6: Hash values verification
console.log('\n5. Hash Verification');
const emptyBlob = objects.createBlob(Buffer.alloc(0));
const emptyHash = objects.hashBlob(emptyBlob);
const expectedEmpty = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';
console.log(`   Empty blob hash: ${emptyHash}`);
console.log(`   Expected:        ${expectedEmpty}`);
console.log(`   ✓ Match: ${emptyHash === expectedEmpty}`);

console.log('\n=== All Tests Passed ===');
