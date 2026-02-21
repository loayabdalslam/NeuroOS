export interface LinkMetadata {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    url: string;
    siteName?: string;
}

export const fetchMetadata = async (url: string): Promise<LinkMetadata | null> => {
    try {
        // @ts-ignore - proxyRequest is exposed in preload.ts
        const html = await window.electron.proxyRequest(url);
        if (!html || typeof html !== 'string') return null;

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const getMeta = (name: string) =>
            doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
            doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

        const metadata: LinkMetadata = {
            url,
            title: getMeta('og:title') || doc.title || '',
            description: getMeta('og:description') || getMeta('description') || '',
            image: getMeta('og:image') || '',
            type: getMeta('og:type') || 'website',
            siteName: getMeta('og:site_name') || ''
        };

        // YouTube specific handling if OG is missing or needs better images
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.includes('watch?v=')
                ? url.split('v=')[1]?.split('&')[0]
                : url.includes('youtu.be/') ? url.split('youtu.be/')[1]?.split('?')[0] : null;

            if (videoId && !metadata.image) {
                metadata.image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
        }

        return metadata;
    } catch (e) {
        console.error('Metadata fetch failed', e);
        return null;
    }
};
