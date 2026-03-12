import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const featureCards = [
	{
		title: "Free and Open Source",
		description:
			"Use a free open-source HTTP client that keeps your API workflow visible in GitHub, code review, and normal repositories.",
	},
	{
		title: "Plain-Text .http Requests",
		description:
			"Store HTTP requests in .http files that stay readable, diff-friendly, and easy to maintain next to the services they exercise.",
	},
	{
		title: "Layered Environment Variables",
		description:
			"Merge workspace and collection env files without inventing a second configuration system for local, staging, and production APIs.",
	},
	{
		title: "Desktop App and CLI",
		description:
			"Run requests from the terminal or open the desktop app when you want a visual editor for the same git-backed source of truth.",
	},
];

const workflowSteps = [
	{
		title: "Write",
		copy: "Write an HTTP request once in a plain-text .http file and keep it close to the code or service it belongs to.",
	},
	{
		title: "Resolve",
		copy: "Resolve layered environment variables from workspace and collection files before you send a real API request.",
	},
	{
		title: "Run",
		copy: "Run requests with the eshttp CLI or open the free desktop app when you want a visual editing and inspection loop.",
	},
];

const installCommands = [
	{
		label: "npm",
		command: "npm install -g @eshttp/cli",
		tokens: ["npm", "install", "-g", "@eshttp/cli"],
	},
	{
		label: "pnpm",
		command: "pnpm add -g @eshttp/cli",
		tokens: ["pnpm", "add", "-g", "@eshttp/cli"],
	},
	{
		label: "yarn",
		command: "yarn global add @eshttp/cli",
		tokens: ["yarn", "global", "add", "@eshttp/cli"],
	},
	{
		label: "bun",
		command: "bun add -g @eshttp/cli",
		tokens: ["bun", "add", "-g", "@eshttp/cli"],
	},
];

const launchUrl = "https://app.eshttp.com";
const githubUrl = "https://github.com/vhgn/eshttp";

export const Route = createFileRoute("/")({ component: LandingPage });

function RequestCodeSample() {
	return (
		<>
			<div>
				<span className="code-token code-method">GET</span>{" "}
				<span className="code-token code-url">https://</span>
				<span className="code-token code-placeholder">{"{{API_HOST}}"}</span>
				<span className="code-token code-url">/users?limit=25&amp;cursor=</span>
				<span className="code-token code-placeholder">{"{{CURSOR}}"}</span>
			</div>
			<div>
				<span className="code-token code-header">Authorization</span>
				<span className="code-token code-punctuation">:</span>{" "}
				<span className="code-token code-value">Bearer </span>
				<span className="code-token code-placeholder">{"{{TOKEN}}"}</span>
			</div>
			<div>
				<span className="code-token code-header">X-Trace-Mode</span>
				<span className="code-token code-punctuation">:</span>{" "}
				<span className="code-token code-value">preview</span>
			</div>
		</>
	);
}

function WorkspaceSnippetSample() {
	return (
		<>
			<div className="code-token code-file">.env.default</div>
			<div>
				<span className="code-token code-env-key">API_HOST</span>
				<span className="code-token code-punctuation">=</span>
				<span className="code-token code-env-value">api.eshttp.dev</span>
			</div>
			<div>
				<span className="code-token code-env-key">TOKEN</span>
				<span className="code-token code-punctuation">=</span>
				<span className="code-token code-env-value">replace-me</span>
			</div>
			<div>
				<span className="code-token code-env-key">CURSOR</span>
				<span className="code-token code-punctuation">=</span>
			</div>
			<div>&nbsp;</div>
			<div className="code-token code-file">users.http</div>
			<div>
				<span className="code-token code-method">GET</span>{" "}
				<span className="code-token code-url">https://</span>
				<span className="code-token code-placeholder">{"{{API_HOST}}"}</span>
				<span className="code-token code-url">/users</span>
			</div>
			<div>
				<span className="code-token code-header">Authorization</span>
				<span className="code-token code-punctuation">:</span>{" "}
				<span className="code-token code-value">Bearer </span>
				<span className="code-token code-placeholder">{"{{TOKEN}}"}</span>
			</div>
		</>
	);
}

function InstallCommandSample({ tokens }: { tokens: string[] }) {
	return (
		<>
			{tokens.map((token, index) => {
				const className =
					token === "@eshttp/cli"
						? "code-token code-cli-package"
						: token.startsWith("-")
							? "code-token code-cli-flag"
							: index === 0
								? "code-token code-cli-bin"
								: "code-token code-cli-subcommand";

				return (
					<span key={token}>
						{index > 0 ? " " : null}
						<span className={className}>{token}</span>
					</span>
				);
			})}
		</>
	);
}

function LandingPage() {
	const [selectedInstaller, setSelectedInstaller] = useState("npm");

	const copyCommand = async (command: string) => {
		try {
			await navigator.clipboard.writeText(command);
		} catch {
			// Ignore clipboard failures and leave the text selectable.
		}
	};

	const activeInstallCommand =
		installCommands.find((entry) => entry.label === selectedInstaller) ??
		installCommands[0];

	return (
		<>
			<a className="skip-link" href="#main-content">
				Skip to content
			</a>
			<main id="main-content">
				<div className="page-wrap px-4 pb-20 pt-4 sm:px-6 lg:px-8">
					<header className="nav-shell rise-in mt-4 flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex items-center gap-3">
							<img
								className="nav-logo"
								src="/logo192.png"
								alt="eshttp logo mark"
								width={48}
								height={48}
							/>
							<div>
								<p className="m-0 text-[0.7rem] font-semibold tracking-[0.34em] text-[var(--muted)] uppercase">
									eshttp
								</p>
								<p className="m-0 text-sm text-[var(--text-soft)]">
									Free and open-source HTTP workflows
								</p>
							</div>
						</div>

						<nav
							className="flex flex-wrap items-center gap-5 text-sm text-[var(--text-soft)]"
							aria-label="Primary"
						>
							<a className="nav-link" href="#features">
								Features
							</a>
							<a className="nav-link" href="#workflow">
								Workflow
							</a>
							<a
								className="nav-link"
								href={githubUrl}
								target="_blank"
								rel="noreferrer"
							>
								GitHub
							</a>
							<a className="button-link button-link-ghost" href={launchUrl}>
								Open App
							</a>
						</nav>
					</header>

					<section className="hero-grid relative mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)] lg:items-center">
						<span className="sparkle sparkle-blue" aria-hidden="true" />
						<span className="sparkle sparkle-yellow" aria-hidden="true" />
						<span className="sparkle sparkle-green" aria-hidden="true" />

						<div className="relative z-10">
							<h1
								className="hero-title rise-in text-5xl leading-[0.95] font-semibold tracking-[-0.05em] text-[var(--text)] sm:text-6xl lg:text-8xl"
								style={{ animationDelay: "90ms" }}
							>
								Free, open-source HTTP client for plain-text .http workflows.
							</h1>
							<p
								className="rise-in mt-6 max-w-2xl text-base leading-8 text-[var(--text-soft)] sm:text-lg"
								style={{ animationDelay: "180ms" }}
							>
								eshttp helps API teams write and run HTTP requests from{" "}
								<code>.http</code> files, layer environment variables, and keep
								desktop and CLI workflows aligned with git. It is free, open
								source, and built for developers who want API tooling that lives
								in the repo instead of a closed request database.
							</p>

							<div
								className="rise-in mt-8 flex flex-wrap gap-3"
								style={{ animationDelay: "260ms" }}
							>
								<a className="button-link button-link-primary" href={launchUrl}>
									Open the free app
								</a>
								<a
									className="button-link button-link-ghost"
									href={githubUrl}
									target="_blank"
									rel="noreferrer"
								>
									View source on GitHub
								</a>
							</div>

							<div
								className="rise-in mt-10 grid gap-3 sm:grid-cols-3"
								style={{ animationDelay: "340ms" }}
							>
								<article className="stat-card">
									<span className="stat-value">.http</span>
									<p className="stat-label">Plain-text HTTP requests</p>
								</article>
								<article className="stat-card">
									<span className="stat-value">OSS</span>
									<p className="stat-label">Free and open source</p>
								</article>
								<article className="stat-card">
									<span className="stat-value">CLI + App</span>
									<p className="stat-label">Terminal and desktop workflow</p>
								</article>
							</div>
						</div>

						<div
							className="rise-in relative"
							style={{ animationDelay: "220ms" }}
						>
							<div className="orb orb-a" aria-hidden="true" />
							<div className="orb orb-b" aria-hidden="true" />

							<div className="showcase-shell">
								<div className="showcase-brand">
									<img
										className="showcase-logo"
										src="/logo192.png"
										alt="eshttp logo mark"
										width={83}
										height={83}
									/>
									<div>
										<p className="showcase-label">Global CLI</p>
										<h3 className="showcase-title">
											Install once. Run with eshttp.
										</h3>
									</div>
								</div>

								<div className="code-panel">
									<div className="panel-topline">
										<span className="panel-dot panel-dot-red" />
										<span className="panel-dot panel-dot-amber" />
										<span className="panel-dot panel-dot-green" />
										<span className="ml-3 text-xs tracking-[0.24em] text-[var(--muted)] uppercase">
											team-api / users / list.http
										</span>
									</div>

									<pre
										className="code-block"
										aria-label="Example HTTP request in a plain-text .http file"
									>
										<code>
											<RequestCodeSample />
										</code>
									</pre>
								</div>

								<div className="response-panel">
									<div className="response-header">
										<span className="response-pill">200 OK</span>
										<span className="text-xs tracking-[0.24em] text-[var(--muted)] uppercase">
											response preview
										</span>
									</div>

									<div className="response-grid">
										<div className="response-card">
											<p className="response-card-label">Active env</p>
											<p className="response-card-value">production</p>
										</div>
										<div className="response-card">
											<p className="response-card-label">Resolved host</p>
											<p className="response-card-value">api.eshttp.dev</p>
										</div>
									</div>

									<div className="terminal-card">
										<p className="terminal-line">
											<span className="terminal-prefix">$</span>
											eshttp run users/list.http --env production
										</p>
									</div>
								</div>
							</div>
						</div>
					</section>

					<section
						id="features"
						className="mt-18 scroll-mt-24"
						aria-labelledby="features-title"
					>
						<div className="section-heading">
							<p className="eyebrow">
								Free and open-source tooling for API teams
							</p>
							<h2 id="features-title" className="section-title">
								A git-friendly HTTP client for developers who prefer readable
								requests over siloed tabs.
							</h2>
						</div>

						<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
							{featureCards.map((card, index) => (
								<article
									key={card.title}
									className="feature-card rise-in"
									style={{ animationDelay: `${index * 90 + 80}ms` }}
								>
									<p className="feature-index">0{index + 1}</p>
									<h3 className="feature-title">{card.title}</h3>
									<p className="feature-copy">{card.description}</p>
								</article>
							))}
						</div>
					</section>

					<section
						id="workflow"
						className="workflow-shell mt-18 grid gap-6 scroll-mt-24 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
						aria-labelledby="workflow-title"
					>
						<div className="workflow-panel">
							<p className="eyebrow">Typical flow</p>
							<h2 id="workflow-title" className="section-title max-w-xl">
								Keep HTTP request definitions close to the code and environment
								files that own them.
							</h2>
							<p className="mt-4 max-w-lg text-base leading-8 text-[var(--text-soft)]">
								eshttp fits teams that want source-controlled API requests,
								explicit environment files, and a lighter mental model than a
								giant shared request database.
							</p>

							<div className="mt-8 space-y-4">
								{workflowSteps.map((step, index) => (
									<article key={step.title} className="step-row">
										<div className="step-count">0{index + 1}</div>
										<div>
											<h3 className="step-title">{step.title}</h3>
											<p className="step-copy">{step.copy}</p>
										</div>
									</article>
								))}
							</div>
						</div>

						<div className="workflow-panel">
							<div className="snippet-shell">
								<div className="snippet-label">
									workspace/.eshttp/workspaces/demo/users
								</div>
								<pre
									className="code-block compact"
									aria-label="Example workspace environment file and HTTP request"
								>
									<code>
										<WorkspaceSnippetSample />
									</code>
								</pre>
							</div>

							<div className="snippet-note">
								<p className="snippet-note-title">Why it works</p>
								<p className="snippet-note-copy">
									Request files, env files, and collections all stay legible in
									code review. The app becomes a better editor for the same
									source of truth instead of a separate storage layer.
								</p>
							</div>

							<div id="install" className="snippet-note">
								<p className="snippet-note-title">Install globally</p>
								<div className="install-tabs mt-4" aria-label="Install options">
									{installCommands.map((entry) => (
										<button
											key={entry.label}
											className={`install-tab${entry.label === activeInstallCommand.label ? " is-active" : ""}`}
											type="button"
											aria-pressed={entry.label === activeInstallCommand.label}
											onClick={() => setSelectedInstaller(entry.label)}
										>
											{entry.label}
										</button>
									))}
								</div>
								<div className="install-command-row mt-4" aria-live="polite">
									<code className="install-command">
										<InstallCommandSample
											tokens={activeInstallCommand.tokens}
										/>
									</code>
									<button
										className="install-copy"
										type="button"
										onClick={() =>
											void copyCommand(activeInstallCommand.command)
										}
										aria-label={`Copy ${activeInstallCommand.label} install command`}
									>
										Copy
									</button>
								</div>
							</div>
						</div>
					</section>

					<section className="cta-shell mt-18" aria-labelledby="cta-title">
						<p className="eyebrow">Ready to switch?</p>
						<h2 className="section-title max-w-3xl">
							<span id="cta-title">
								Start with a free open-source HTTP client that keeps your
								requests in the repo.
							</span>
						</h2>
						<p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-soft)]">
							Open the app, install the CLI, or review the source on GitHub.
							eshttp keeps HTTP requests, environment variables, and API
							workflow history in plain text.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<a className="button-link button-link-primary" href={launchUrl}>
								Open app.eshttp.com
							</a>
							<a className="button-link button-link-ghost" href="#workflow">
								See how the workflow works
							</a>
						</div>
					</section>

					<footer className="footer-shell mt-12 pb-10 pt-8 text-sm text-[var(--text-soft)]">
						<a href={launchUrl}>Open App</a>
						<span className="footer-separator" />
						<a href="#install">Install CLI</a>
						<span className="footer-separator" />
						<a href={githubUrl} target="_blank" rel="noreferrer">
							GitHub
						</a>
					</footer>
				</div>
			</main>
		</>
	);
}
