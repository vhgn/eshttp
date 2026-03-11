import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

const siteUrl = "https://eshttp.com";
const socialImageUrl = `${siteUrl}/social-preview.png`;

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
				title: "eshttp | HTTP Workflows In Plain Text",
			},
			{
				name: "description",
				content:
					"eshttp is a fast HTTP workflow tool built around plain-text requests, environment layering, and git-friendly workspaces.",
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
				content: siteUrl,
			},
			{
				property: "og:title",
				content: "eshttp | HTTP Workflows In Plain Text",
			},
			{
				property: "og:description",
				content:
					"eshttp is a fast HTTP workflow tool built around plain-text requests, environment layering, and git-friendly workspaces.",
			},
			{
				property: "og:image",
				content: socialImageUrl,
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
				content: "eshttp | HTTP Workflows In Plain Text",
			},
			{
				name: "twitter:description",
				content:
					"eshttp is a fast HTTP workflow tool built around plain-text requests, environment layering, and git-friendly workspaces.",
			},
			{
				name: "twitter:image",
				content: socialImageUrl,
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.ico",
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
			</head>
			<body className="landing-body font-sans antialiased [overflow-wrap:anywhere]">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
