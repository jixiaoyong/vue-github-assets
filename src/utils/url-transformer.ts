/**
 * URL 转换工具 / URL Transformer Utilities
 * 
 * 在 GitHub Pages, Raw 和 CDN 链接之间转换 / Converts between GitHub Pages, Raw, and CDN URLs
 */
import type { CdnOptions } from '@/types';

// ============================================
// 配置 / Configuration
// ============================================

const DEFAULT_CDN_OPTIONS: Required<CdnOptions> = {
    provider: 'wsrv',
    width: 0,
    height: 0,
    quality: 75,
    format: 'webp',
    cacheBust: false,
};

// ============================================
// URL 检测与解析 / URL Detection & Parsing
// ============================================

/**
 * 从 GitHub Pages URL 提取仓库信息 / Extract repository info from a GitHub Pages URL
 */
export function parseGitHubPagesUrl(url: string): {
    owner: string;
    repo: string;
    path: string;
} | null {
    // Pattern: https://{owner}.github.io/{repo}/{path}
    const match = url.match(
        /^https?:\/\/([^.]+)\.github\.io\/([^/]+)\/(.+)$/
    );

    if (!match) return null;

    return {
        owner: match[1],
        repo: match[2],
        path: match[3],
    };
}

/**
 * 检查是否为 GitHub Pages URL / Check if URL is a GitHub Pages URL
 */
export function isGitHubPagesUrl(url: string): boolean {
    return /^https?:\/\/[^.]+\.github\.io\//.test(url);
}

/**
 * 检查是否为 GitHub Raw URL / Check if URL is a GitHub Raw URL
 */
export function isGitHubRawUrl(url: string): boolean {
    return url.includes('raw.githubusercontent.com');
}

// ============================================
// URL 转换 / URL Transformations
// ============================================

/**
 * 将 GitHub Pages URL 转换为 Raw URL / Convert GitHub Pages URL to Raw URL
 * 
 * @param pagesUrl GitHub Pages URL (e.g., https://jixiaoyong.github.io/images/photo.jpg)
 * @param branch 分支名称 (默认: 'main') / Branch name (default: 'main')
 * @returns Raw URL (e.g., https://raw.githubusercontent.com/jixiaoyong/images/main/photo.jpg)
 */
export function toRawUrl(pagesUrl: string, branch = 'main'): string {
    const parsed = parseGitHubPagesUrl(pagesUrl);
    if (!parsed) {
        // 已经是 Raw URL 或非 GitHub URL，原样返回 / Already a raw URL or not a GitHub URL, return as-is
        return pagesUrl;
    }

    return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${parsed.path}`;
}

/**
 * 将 Raw URL 或 Pages URL 转换为 CDN 优化链接 / Convert Raw URL or Pages URL to CDN optimized URL
 */
export function toCdnUrl(url: string, options: CdnOptions = {}): string {
    const opts = { ...DEFAULT_CDN_OPTIONS, ...options };

    // 首先确保是 Raw URL / First ensure we have a raw URL
    let rawUrl = url;
    if (isGitHubPagesUrl(url)) {
        rawUrl = toRawUrl(url);
    }

    // 如果请求，添加缓存破坏参数 / Add cache busting if requested
    if (opts.cacheBust) {
        const separator = rawUrl.includes('?') ? '&' : '?';
        rawUrl = `${rawUrl}${separator}t=${Date.now()}`;
    }

    if (opts.provider === 'wsrv') {
        return buildWsrvUrl(rawUrl, opts);
    } else if (opts.provider === 'statically') {
        return buildStaticallyUrl(rawUrl);
    }

    return rawUrl;
}

/**
 * 构建 wsrv.nl CDN URL / Build wsrv.nl CDN URL
 */
function buildWsrvUrl(rawUrl: string, opts: Required<CdnOptions>): string {
    const params = new URLSearchParams();
    params.set('url', rawUrl);

    if (opts.format === 'webp') {
        params.set('output', 'webp');
    }

    if (opts.quality > 0 && opts.quality < 100) {
        params.set('q', String(opts.quality));
    }

    if (opts.width > 0) {
        params.set('w', String(opts.width));
    }

    if (opts.height > 0) {
        params.set('h', String(opts.height));
    }

    return `https://wsrv.nl/?${params.toString()}`;
}

/**
 * 构建 Statically CDN URL / Build Statically CDN URL
 * Pattern: https://cdn.statically.io/gh/{owner}/{repo}/{branch}/{path}
 */
function buildStaticallyUrl(rawUrl: string): string {
    // 解析 Raw URL / Parse raw URL: https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
    const match = rawUrl.match(
        /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/
    );

    if (!match) return rawUrl;

    const [, owner, repo, branch, path] = match;
    return `https://cdn.statically.io/gh/${owner}/${repo}/${branch}/${path}`;
}

/**
 * 将任意 URL 转回 GitHub Pages 显示链接 / Convert any URL back to GitHub Pages display URL
 */
export function toDisplayUrl(
    url: string,
    owner: string,
    repo: string
): string {
    // 如果已经是 Pages URL，原样返回 / If already a pages URL, return as-is
    if (isGitHubPagesUrl(url)) return url;

    // 从 Raw URL 提取路径 / Extract path from raw URL
    const match = url.match(
        /^https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/
    );

    if (match) {
        return `https://${owner}.github.io/${repo}/${match[1]}`;
    }

    return url;
}

/**
 * 构建完整的 URL 链 / Build complete URL chain for an asset
 */
export function buildUrlChain(
    path: string,
    config: { owner: string; repo: string; branch?: string },
    cdnOptions?: CdnOptions
): {
    displayUrl: string;
    rawUrl: string;
    cdnUrl: string;
} {
    const branch = config.branch || 'main';
    const displayUrl = `https://${config.owner}.github.io/${config.repo}/${path}`;
    const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${branch}/${path}`;
    const cdnUrl = toCdnUrl(rawUrl, cdnOptions);

    return { displayUrl, rawUrl, cdnUrl };
}
