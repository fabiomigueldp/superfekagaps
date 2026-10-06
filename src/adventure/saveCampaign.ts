/** Both campaigns use v1: recognize their stage namespaces before sanitizing. */
export function assertSaveCampaign(data: Record<string, unknown>, campaign: 'world' | 'delicia'): void {
    // Identifier-free v1 files are ambiguous and keep the existing defaults.
    // Only definite foreign stage IDs reject a file; unknown fields stay valid.
    const foreignId = campaign === 'world' ? /^delicia-/ : /^[1-6]-[1-5]$/;
    const foreign = (id: unknown) => typeof id === 'string' && foreignId.test(id);
    const checkpoint = data.checkpoint && typeof data.checkpoint === 'object'
        ? data.checkpoint as Record<string, unknown> : null;
    if (foreign(data.selected)
        || (Array.isArray(data.completed) && data.completed.some(foreign))
        || foreign(checkpoint?.stage)
        || (data.times && typeof data.times === 'object' && Object.keys(data.times).some(foreign)))
        throw new Error(campaign === 'world'
            ? 'Save da Delícia. Importe na expansão Delícia.'
            : 'Save do World. Importe na campanha World.');
}
