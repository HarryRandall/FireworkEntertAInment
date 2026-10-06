'use client';
import dynamic from 'next/dynamic';
/** Loads the renderer view only in a browser, including hover previews. */
export const DesignPreview = dynamic(() => import('./preview-surface'), { ssr: false });
