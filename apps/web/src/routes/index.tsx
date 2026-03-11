import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const featureCards = [
	{
		title: "Plain-Text Requests",
		description:
			"Keep requests in .http files that review cleanly, survive refactors, and stay readable inside a normal repo.",
	},
	{
		title: "Layered Environments",
		description:
			"Merge workspace and collection env files without inventing a second config system for your team.",
	},
	{
		title: "CLI-First Flow",
		description:
			"Run, list, and switch environments from the terminal first, then use the app when a visual pass helps.",
	},
	{
		title: "Git-Native Workspaces",
		description:
			"Collections, request changes, and future desktop sync all fit into a normal git-backed workflow.",
	},
];

const workflowSteps = [
	{
		title: "Write",
		copy: "Describe a request once in plain text and keep it close to the service it belongs to.",
	},
	{
		title: "Resolve",
		copy: "Layer workspace and collection environment values before you ship a real request.",
	},
	{
		title: "Run",
		copy: "Run requests directly with the global eshttp CLI, then open the app when a visual editing loop helps.",
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
				<span className="code-token code-url">/users</span>
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
			<div>&nbsp;</div>
			<div className="code-token code-punctuation">{"{"}</div>
			<div>
				<span className="code-token code-indent"> </span>
				<span className="code-token code-string">"limit"</span>
				<span className="code-token code-punctuation">:</span>{" "}
				<span className="code-token code-number">25</span>
				<span className="code-token code-punctuation">,</span>
			</div>
			<div>
				<span className="code-token code-indent"> </span>
				<span className="code-token code-string">"cursor"</span>
				<span className="code-token code-punctuation">:</span>{" "}
				<span className="code-token code-string">"</span>
				<span className="code-token code-placeholder">{"{{CURSOR}}"}</span>
				<span className="code-token code-string">"</span>
			</div>
			<div className="code-token code-punctuation">{"}"}</div>
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
		<main>
			<div className="page-wrap px-4 pb-20 pt-4 sm:px-6 lg:px-8">
				<header className="nav-shell rise-in mt-4 flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-center gap-3">
						<img className="nav-logo" src="/logo.png" alt="eshttp logo" />
						<div>
							<p className="m-0 text-[0.7rem] font-semibold tracking-[0.34em] text-[var(--muted)] uppercase">
								eshttp
							</p>
							<p className="m-0 text-sm text-[var(--text-soft)]">
								HTTP workflows in plain text
							</p>
						</div>
					</div>

					<nav className="flex flex-wrap items-center gap-5 text-sm text-[var(--text-soft)]">
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
							Ship requests as code, not screenshots.
						</h1>
						<p
							className="rise-in mt-6 max-w-2xl text-base leading-8 text-[var(--text-soft)] sm:text-lg"
							style={{ animationDelay: "180ms" }}
						>
							eshttp gives API teams a git-friendly workflow for{" "}
							<code>.http</code> files, layered environments, and fast request
							execution. The landing page stays static. The app lives at{" "}
							<code>app.eshttp.com</code>.
						</p>

						<div
							className="rise-in mt-8 flex flex-wrap gap-3"
							style={{ animationDelay: "260ms" }}
						>
							<a className="button-link button-link-primary" href={launchUrl}>
								Launch app.eshttp.com
							</a>
							<a
								className="button-link button-link-ghost"
								href={githubUrl}
								target="_blank"
								rel="noreferrer"
							>
								View source
							</a>
						</div>

						<div
							className="rise-in mt-10 grid gap-3 sm:grid-cols-3"
							style={{ animationDelay: "340ms" }}
						>
							<article className="stat-card">
								<span className="stat-value">.http</span>
								<p className="stat-label">Requests live in plain text</p>
							</article>
							<article className="stat-card">
								<span className="stat-value">.env</span>
								<p className="stat-label">Workspace and collection layering</p>
							</article>
							<article className="stat-card">
								<span className="stat-value">CLI</span>
								<p className="stat-label">Fast terminal-first execution</p>
							</article>
						</div>
					</div>

					<div className="rise-in relative" style={{ animationDelay: "220ms" }}>
						<div className="orb orb-a" aria-hidden="true" />
						<div className="orb orb-b" aria-hidden="true" />

						<div className="showcase-shell">
							<div className="showcase-brand">
								<img
									className="showcase-logo"
									src="/logo.png"
									alt="eshttp logo"
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

								<pre className="code-block">
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

				<section id="features" className="mt-18 scroll-mt-24">
					<div className="section-heading">
						<p className="eyebrow">
							Built for teams that review API work in git
						</p>
						<h2 className="section-title">
							A sharper workflow than another tab of saved requests.
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
				>
					<div className="workflow-panel">
						<p className="eyebrow">Typical flow</p>
						<h2 className="section-title max-w-xl">
							Keep the request definition close to the code that owns it.
						</h2>
						<p className="mt-4 max-w-lg text-base leading-8 text-[var(--text-soft)]">
							eshttp fits teams that want source-controlled requests, explicit
							environment files, and a lighter mental model than a giant shared
							request database.
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
							<pre className="code-block compact">
								<code>
									<WorkspaceSnippetSample />
								</code>
							</pre>
						</div>

						<div className="snippet-note">
							<p className="snippet-note-title">Why it works</p>
							<p className="snippet-note-copy">
								Request files, env files, and collections all stay legible in
								code review. The app becomes a better editor for the same source
								of truth instead of a separate storage layer.
							</p>
						</div>

						<div className="snippet-note">
							<p className="snippet-note-title">Install globally</p>
							<div
								className="install-tabs mt-4"
								role="tablist"
								aria-label="Install options"
							>
								{installCommands.map((entry) => (
									<button
										key={entry.label}
										className={`install-tab${entry.label === activeInstallCommand.label ? " is-active" : ""}`}
										type="button"
										role="tab"
										aria-selected={entry.label === activeInstallCommand.label}
										onClick={() => setSelectedInstaller(entry.label)}
									>
										{entry.label}
									</button>
								))}
							</div>
							<div className="install-command-row mt-4">
								<code className="install-command">
									<InstallCommandSample tokens={activeInstallCommand.tokens} />
								</code>
								<button
									className="install-copy"
									type="button"
									onClick={() => void copyCommand(activeInstallCommand.command)}
									aria-label={`Copy ${activeInstallCommand.label} install command`}
								>
									Copy
								</button>
							</div>
						</div>
					</div>
				</section>

				<section className="cta-shell mt-18">
					<p className="eyebrow">Ready to switch?</p>
					<h2 className="section-title max-w-3xl">
						Open the app, keep the repo, and stop hand-syncing request changes.
					</h2>
					<div className="mt-8 flex flex-wrap gap-3">
						<a className="button-link button-link-primary" href={launchUrl}>
							Continue to app.eshttp.com
						</a>
						<a className="button-link button-link-ghost" href="#workflow">
							See the workflow
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
	);
}
