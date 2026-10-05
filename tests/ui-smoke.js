const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const projectRoot = path.join(__dirname, '..');
const port = 3800 + Math.floor(Math.random() * 100);
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.join(projectRoot, 'data', `seatlock-ui-${process.pid}.db`);
const artifactPath = process.env.UI_ARTIFACT_DIR || path.join(os.tmpdir(), 'seatlock-ui-artifacts');
const browserCandidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

let server;
let browser;
let serverOutput = '';

async function waitForServer() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start.\n${serverOutput}`);
}

async function assertLayout(page, label) {
    const result = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth
    }));
    if (result.content > result.viewport) {
        throw new Error(`${label} has horizontal overflow: ${result.content}px content in ${result.viewport}px viewport`);
    }
}

async function main() {
    const executablePath = browserCandidates.find(candidate => fs.existsSync(candidate));
    if (!executablePath) throw new Error('Edge or Chrome was not found. Set BROWSER_PATH to run UI smoke tests.');

    fs.mkdirSync(artifactPath, { recursive: true });
    server = spawn(process.execPath, ['server/index.js'], {
        cwd: projectRoot,
        env: {
            ...process.env,
            PORT: String(port),
            DB_PATH: databasePath,
            AUTH_SECRET: 'seatlock-ui-smoke-secret'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', chunk => { serverOutput += chunk; });
    server.stderr.on('data', chunk => { serverOutput += chunk; });
    await waitForServer();

    browser = await chromium.launch({ executablePath, headless: true });
    const desktop = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light'
    });
    const page = await desktop.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Welcome' }).waitFor();
    await assertLayout(page, 'desktop sign-in');
    await page.screenshot({ path: path.join(artifactPath, 'auth-light.png'), fullPage: true });

    await page.getByLabel('Campus ID').fill('ui_reviewer');
    await page.getByLabel('Passcode').fill('review-passcode');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByRole('heading', { name: 'Live availability' }).waitFor();
    await page.getByRole('banner').getByText('Live', { exact: true }).waitFor();
    await assertLayout(page, 'desktop dashboard');
    await page.screenshot({ path: path.join(artifactPath, 'dashboard-light.png'), fullPage: true });

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.getByRole('button', { name: 'Hold a seat' }).click();
    await page.getByRole('heading', { name: 'Confirm before time runs out' }).waitFor();
    await page.screenshot({ path: path.join(artifactPath, 'dashboard-dark-held.png'), fullPage: true });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Welcome' }).waitFor();
    await page.getByLabel('Campus ID').fill('ui_reviewer');
    await page.getByLabel('Passcode').fill('review-passcode');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Confirm before time runs out' }).waitFor();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));

    const storageState = await desktop.storageState();
    const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        storageState
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
    await mobilePage.getByRole('heading', { name: 'Live availability' }).waitFor();
    await assertLayout(mobilePage, 'mobile dashboard');
    await mobilePage.screenshot({ path: path.join(artifactPath, 'dashboard-mobile-dark.png'), fullPage: true });

    await mobile.close();

    const secondTab = await desktop.newPage();
    await secondTab.goto(baseUrl, { waitUntil: 'networkidle' });
    await secondTab.getByRole('button', { name: 'Sign out' }).click();
    await secondTab.getByLabel('Campus ID').fill('ui_second');
    await secondTab.getByLabel('Passcode').fill('review-passcode');
    await secondTab.getByRole('button', { name: 'Create an account' }).click();
    await secondTab.getByRole('banner').getByText('ui_second', { exact: true }).waitFor();
    await page.getByRole('banner').getByText('ui_second', { exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Hold a seat', exact: true }).waitFor();

    await secondTab.getByRole('button', { name: 'Hold a seat', exact: true }).click();
    await secondTab.getByRole('heading', { name: 'Confirm before time runs out' }).waitFor();
    await page.getByRole('heading', { name: 'Confirm before time runs out' }).waitFor();
    const staleAction = await page.request.post(`${baseUrl}/api/confirm`, {
        headers: { 'X-SeatLock-User': 'ui_reviewer', 'Idempotency-Key': 'ui-stale-account-confirm' }
    });
    if (staleAction.status() !== 409) throw new Error('An old displayed identity was allowed to confirm under a different cookie.');

    const independent = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const independentPage = await independent.newPage();
    await independentPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await independentPage.getByLabel('Campus ID').fill('ui_independent');
    await independentPage.getByLabel('Passcode').fill('review-passcode');
    await independentPage.getByRole('button', { name: 'Create an account' }).click();
    await independentPage.getByRole('button', { name: 'Hold a seat', exact: true }).waitFor();
    if (await independentPage.getByRole('button', { name: 'Confirm reservation', exact: true }).count()) {
        throw new Error('An independent account was shown another account\'s confirm action.');
    }
    const forbiddenConfirm = await independentPage.request.post(`${baseUrl}/api/confirm`, {
        headers: { 'Idempotency-Key': 'ui-other-account-confirm' }
    });
    if (forbiddenConfirm.status() !== 404) throw new Error('Another account could confirm the owner\'s hold.');
    await secondTab.getByRole('button', { name: 'Confirm reservation', exact: true }).click();
    await secondTab.getByRole('heading', { name: 'Your seat is secured' }).waitFor();
    await page.getByRole('heading', { name: 'Your seat is secured' }).waitFor();
    await independentPage.getByRole('button', { name: 'Hold a seat', exact: true }).waitFor();
    const independentStatus = await independentPage.request.get(`${baseUrl}/api/status`);
    const independentSnapshot = await independentStatus.json();
    if (independentSnapshot.user.status !== 'none' || independentSnapshot.availability.confirmed !== 1) {
        throw new Error('Owner confirmation leaked into an independent user\'s state or availability was incorrect.');
    }
    await secondTab.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Welcome' }).waitFor();
    await independentPage.getByRole('banner').getByText('ui_independent', { exact: true }).waitFor();
    await independent.close();

    await desktop.close();
    console.log(`UI smoke test passed (signup, login, theme, desktop, mobile, cross-tab sessions, and independent-account ownership).`);
    console.log(`Screenshots: ${artifactPath}`);
}

main().catch(error => {
    console.error(error);
    if (serverOutput) console.error(`\nServer output:\n${serverOutput}`);
    process.exitCode = 1;
}).finally(async () => {
    if (browser) await browser.close();
    if (server && server.exitCode === null) {
        const exited = new Promise(resolve => server.once('exit', resolve));
        server.kill('SIGTERM');
        await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    }
    for (const suffix of ['', '-wal', '-shm']) {
        const file = `${databasePath}${suffix}`;
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
});
