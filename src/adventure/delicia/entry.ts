// Preserve old links, including versioned deployments, without starting another game shell.
const campaign = new URL('./', window.location.href);
campaign.searchParams.set('chapter', 'delicia');
window.location.replace(campaign.href);
