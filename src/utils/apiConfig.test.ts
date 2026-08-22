import { getApiBaseUrl, buildApiUrl } from './apiConfig';

console.log('--- RUNNING API CONFIG & URL ABSTRACTION TESTS ---');

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}

// Test 1: Standard same-origin web resolution (VITE_API_BASE_URL empty)
delete process.env.VITE_API_BASE_URL;
const defaultUrl1 = buildApiUrl('/api/admin/create-teacher');
assert(defaultUrl1 === '/api/admin/create-teacher', `Default resolution should be '/api/admin/create-teacher', got '${defaultUrl1}'`);

// Test 2: Path missing leading slash
const defaultUrl2 = buildApiUrl('api/auth/resolve-identifier');
assert(defaultUrl2 === '/api/auth/resolve-identifier', `Missing leading slash should normalize to '/api/auth/resolve-identifier', got '${defaultUrl2}'`);

// Test 3: Query parameters preserved
const defaultUrl3 = buildApiUrl('/api/learner/exam-ranking?exam_id=exam_test_123&token=test_tok');
assert(
  defaultUrl3 === '/api/learner/exam-ranking?exam_id=exam_test_123&token=test_tok',
  `Query params preserved in URL: '${defaultUrl3}'`
);

// Test 4: Dynamic environment variable override test with trailing slash
process.env.VITE_API_BASE_URL = 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/';

const remoteUrl1 = buildApiUrl('/api/admin/create-teacher');
assert(
  remoteUrl1 === 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/api/admin/create-teacher',
  `Remote URL with trailing slash cleaned: '${remoteUrl1}'`
);

// Test 5: Dynamic environment variable without leading slash in path
const remoteUrl2 = buildApiUrl('api/learner/class-teachers');
assert(
  remoteUrl2 === 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/api/learner/class-teachers',
  `Remote URL without leading slash normalized: '${remoteUrl2}'`
);

// Test 6: Reset to empty env produces relative URL
process.env.VITE_API_BASE_URL = '';
const resetUrl = buildApiUrl('/api/admin/delete-learner');
assert(resetUrl === '/api/admin/delete-learner', `Reset to empty env produces relative URL: '${resetUrl}'`);

console.log(`\nTEST SUMMARY: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
