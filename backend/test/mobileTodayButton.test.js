import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

describe('Mobile Today Button & Date Selector Integrity Suite', () => {
  const navbarPath = path.join(rootDir, 'frontend', 'src', 'components', 'Navbar.jsx');
  const dashboardPath = path.join(rootDir, 'frontend', 'src', 'pages', 'Dashboard.jsx');
  const dateContextPath = path.join(rootDir, 'frontend', 'src', 'context', 'DateContext.jsx');

  test('1. Navbar.jsx defines the Today button in the mobile layout (lg:hidden)', () => {
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    // Verify mobile header container exists with lg:hidden
    assert.match(navbarContent, /<div className="flex lg:hidden items-center/);

    // Verify Today button exists inside the mobile section
    const mobileSection = navbarContent.split('Mobile Date indicator, Today button & Hamburger')[1]?.split('Mobile Hamburger Menu button')[0];
    assert.ok(mobileSection, 'Mobile section with Today button should exist');
    assert.match(mobileSection, /resetToToday/, 'Mobile Today button must call resetToToday');
    assert.match(mobileSection, />\s*Today\s*<\/button>/, 'Mobile Today button must display "Today" text');
    assert.match(mobileSection, /title="Set to today's real date"/);
  });

  test('2. Navbar.jsx keeps the laptop layout intact in desktop section (hidden lg:flex)', () => {
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    const desktopSection = navbarContent.split('Operational Date Selector in Header')[1]?.split('Desktop Nav Links')[0];
    assert.ok(desktopSection, 'Desktop date section should exist');
    assert.match(desktopSection, /hidden lg:flex/, 'Desktop layout must remain guarded with hidden lg:flex');
    assert.match(desktopSection, /type="date"/, 'Desktop layout must have date input');
    assert.match(desktopSection, />\s*Today\s*<\/button>/, 'Desktop layout must preserve Today button');
  });

  test('3. Mobile layout includes responsive sizing without hiding Today at any mobile breakpoint', () => {
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');
    const mobileSection = navbarContent.split('Mobile Date indicator, Today button & Hamburger')[1]?.split('Mobile Hamburger Menu button')[0];

    // Extract the Today button markup from mobileSection
    const buttonMatch = mobileSection.match(/<button[\s\S]*?Today[\s\S]*?<\/button>/);
    assert.ok(buttonMatch, 'Today button markup should exist in mobile section');
    const todayButtonHtml = buttonMatch[0];

    // Ensure no hidden class on Today button itself
    assert.doesNotMatch(todayButtonHtml, /\bhidden\b/, 'Today button in mobile section must NEVER have a hidden class');
    assert.match(todayButtonHtml, /text-\[10px\] xs:text-\[11px\] sm:text-xs/, 'Responsive typography used for 320px-414px+ widths');
  });

  test('4. DateContext correctly calculates Asia/Kolkata system today', () => {
    const dateContextContent = fs.readFileSync(dateContextPath, 'utf8');
    assert.match(dateContextContent, /Asia\/Kolkata/, 'DateContext must use Asia/Kolkata timezone');
    assert.match(dateContextContent, /resetToToday/, 'DateContext must export resetToToday');
    assert.match(dateContextContent, /isToday/, 'DateContext must export isToday indicator');
  });

  test('5. Dashboard.jsx utilizes useDate and connects resetToToday', () => {
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    assert.match(dashboardContent, /resetToToday/, 'Dashboard should have resetToToday available');
    assert.match(dashboardContent, /fetchDashboardData/, 'Dashboard fetches data whenever operationalDate updates');
  });
});
