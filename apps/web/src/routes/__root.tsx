import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

const siteName = "eshttp";
const siteTitle = "eshttp | Free Open-Source HTTP Client for .http Workflows";
const siteDescription =
	"eshttp is a free, open-source HTTP client for plain-text .http files, layered environment variables, git-friendly API workflows, and fast CLI or desktop execution.";
const siteUrl = "https://eshttp.com";
const canonicalUrl = `${siteUrl}/`;
const socialImageUrl = `${siteUrl}/social-preview.png`;
const launchUrl = "https://app.eshttp.com";
const githubUrl = "https://github.com/vhgn/eshttp";
const softwareApplicationJsonLd = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: siteName,
	applicationCategory: "DeveloperApplication",
	description: siteDescription,
	image: socialImageUrl,
	isAccessibleForFree: true,
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	sameAs: [githubUrl, launchUrl],
	url: canonicalUrl,
});

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: siteTitle,
			},
			{
				name: "description",
				content: siteDescription,
			},
			{
				name: "robots",
				content: "index,follow,max-image-preview:large",
			},
			{
				name: "application-name",
				content: siteName,
			},
			{
				name: "theme-color",
				content: "#f3f4f1",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:url",
				content: canonicalUrl,
			},
			{
				property: "og:site_name",
				content: siteName,
			},
			{
				property: "og:locale",
				content: "en_US",
			},
			{
				property: "og:title",
				content: siteTitle,
			},
			{
				property: "og:description",
				content: siteDescription,
			},
			{
				property: "og:image",
				content: socialImageUrl,
			},
			{
				property: "og:image:alt",
				content:
					"eshttp landing page preview for a free and open-source HTTP client",
			},
			{
				property: "og:image:width",
				content: "1536",
			},
			{
				property: "og:image:height",
				content: "1024",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: siteTitle,
			},
			{
				name: "twitter:description",
				content: siteDescription,
			},
			{
				name: "twitter:image",
				content: socialImageUrl,
			},
			{
				name: "twitter:image:alt",
				content:
					"eshttp landing page preview for a free and open-source HTTP client",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "canonical",
				href: canonicalUrl,
			},
			{
				rel: "icon",
				href: "/favicon.ico",
			},
			{
				rel: "apple-touch-icon",
				href: "/logo192.png",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: softwareApplicationJsonLd }}
				/>
			</head>
			<body className="landing-body font-sans antialiased [overflow-wrap:anywhere]">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
