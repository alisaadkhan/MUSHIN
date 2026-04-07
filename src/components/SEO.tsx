import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = "MUSHIN — Creator Intelligence";
const DEFAULT_DESCRIPTION = "Find verified Pakistani creators, detect fraud, and run outreach campaigns from one workspace.";
const DEFAULT_OG_IMAGE = "/mushin-preview-v2.png";
const BASE_URL = "https://mushin.app";

export function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = "website",
  noindex = false,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — MUSHIN` : DEFAULT_TITLE;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta") as HTMLMetaElement;
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const setProp = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta") as HTMLMetaElement;
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("description", description || DEFAULT_DESCRIPTION);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow");
    setProp("og:title", fullTitle);
    setProp("og:description", description || DEFAULT_DESCRIPTION);
    setProp("og:type", ogType);
    setProp("og:image", ogImage || `${BASE_URL}${DEFAULT_OG_IMAGE}`);
    setProp("og:url", canonical || `${BASE_URL}${window.location.pathname}`);
    setProp("og:site_name", "MUSHIN");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description || DEFAULT_DESCRIPTION);
    setMeta("twitter:card", "summary_large_image");

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link") as HTMLLinkElement;
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [title, description, canonical, ogImage, ogType, noindex]);

  return null;
}
