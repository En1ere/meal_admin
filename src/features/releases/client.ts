export async function loadAchievementsPage() {
    return (await import('./catalog-pages.js')).AchievementsPage;
}

export async function loadReputationPage() {
    return (await import('./catalog-pages.js')).ReputationPage;
}

export async function loadReleaseDetailPage() {
    return (await import('./release-page.js')).ReleaseDetailPage;
}

export async function loadReleasesPage() {
    return (await import('./release-page.js')).ReleasesPage;
}
