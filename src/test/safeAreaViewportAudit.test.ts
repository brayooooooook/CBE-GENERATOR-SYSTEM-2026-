import fs from 'fs';
import path from 'path';

console.log('--- RUNNING PHASE 2B-4 SAFE-AREA & VIEWPORT AUDIT TESTS ---');

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

// 1. Audit index.html for viewport-fit=cover
const rootDir = process.cwd();
const indexHtmlPath = path.resolve(rootDir, 'index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

assert(
  indexHtmlContent.includes('viewport-fit=cover'),
  'index.html contains viewport-fit=cover in meta viewport tag'
);
assert(
  indexHtmlContent.includes('width=device-width'),
  'index.html contains width=device-width in meta viewport tag'
);

// 2. Audit src/index.css for Safe-Area CSS Tokens and Viewport rules
const indexCssPath = path.resolve(rootDir, 'src/index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

assert(
  indexCssContent.includes('--sat: env(safe-area-inset-top, 0px);'),
  'src/index.css defines --sat safe-area top token with 0px fallback'
);
assert(
  indexCssContent.includes('--sab: env(safe-area-inset-bottom, 0px);'),
  'src/index.css defines --sab safe-area bottom token with 0px fallback'
);
assert(
  indexCssContent.includes('--sal: env(safe-area-inset-left, 0px);'),
  'src/index.css defines --sal safe-area left token with 0px fallback'
);
assert(
  indexCssContent.includes('--sar: env(safe-area-inset-right, 0px);'),
  'src/index.css defines --sar safe-area right token with 0px fallback'
);
assert(
  indexCssContent.includes('min-height: 100dvh;'),
  'src/index.css specifies modern dynamic viewport height min-height: 100dvh;'
);
assert(
  indexCssContent.includes('.pt-safe') &&
  indexCssContent.includes('.pb-safe') &&
  indexCssContent.includes('.pl-safe') &&
  indexCssContent.includes('.pr-safe') &&
  indexCssContent.includes('.p-safe'),
  'src/index.css provides reusable standards-compliant safe-area utility classes'
);

// 3. Audit src/components/Header.tsx for Sticky Header Safe-Area Inset
const headerPath = path.resolve(rootDir, 'src/components/Header.tsx');
const headerContent = fs.readFileSync(headerPath, 'utf8');

assert(
  headerContent.includes('pt-[env(safe-area-inset-top,0px)]') &&
  headerContent.includes('pl-[env(safe-area-inset-left,0px)]') &&
  headerContent.includes('pr-[env(safe-area-inset-right,0px)]'),
  'src/components/Header.tsx applies safe-area top and side insets to sticky header'
);

// 4. Audit src/components/Sidebar.tsx for Mobile Drawer Safe-Area Inset
const sidebarPath = path.resolve(rootDir, 'src/components/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(
  sidebarContent.includes('pt-[max(0.875rem,env(safe-area-inset-top,0px))]') ||
  sidebarContent.includes('env(safe-area-inset-top,0px)'),
  'src/components/Sidebar.tsx handles safe-area top in mobile drawer header'
);
assert(
  sidebarContent.includes('pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))]') ||
  sidebarContent.includes('env(safe-area-inset-bottom,0px)'),
  'src/components/Sidebar.tsx handles safe-area bottom in mobile drawer footer'
);

// 5. Audit src/components/MobileBottomNav.tsx for Bottom Safe-Area Insets
const mobileNavPath = path.resolve(rootDir, 'src/components/MobileBottomNav.tsx');
const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8');

assert(
  mobileNavContent.includes('pb-[env(safe-area-inset-bottom,0px)]'),
  'src/components/MobileBottomNav.tsx applies safe-area bottom padding to fixed nav bar'
);
assert(
  mobileNavContent.includes('pb-[max(2rem,calc(1.5rem+env(safe-area-inset-bottom,0px)))]'),
  'src/components/MobileBottomNav.tsx applies safe-area bottom padding to quick action bottom sheet'
);

console.log(`\nPHASE 2B-4 TEST SUMMARY: ${passed}/${total} assertions passed.`);
if (passed !== total) {
  process.exit(1);
}
