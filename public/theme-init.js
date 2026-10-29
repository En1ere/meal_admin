(() => {
    const allowed = new Set(['coffee-light', 'coffee-dark', 'nature-light', 'nature-dark']);
    try {
        const saved = localStorage.getItem('meal-admin-theme');
        if (saved && allowed.has(saved)) document.documentElement.dataset.theme = saved;
    } catch {
        // The default theme in index.html remains active when storage is unavailable.
    }
})();
