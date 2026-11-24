"use client";

import dynamic from "next/dynamic";

// These screens read localStorage / the URL hash on first render, so they only
// render in the browser. That keeps the first paint free of hydration flicker.
const Loading = () => <div className="min-h-dvh" />;

export const EditorClient = dynamic(() => import("./Editor"), { ssr: false, loading: Loading });
export const SharedClient = dynamic(() => import("./SharedView"), { ssr: false, loading: Loading });
export const HistoryClient = dynamic(() => import("./History"), { ssr: false, loading: Loading });
