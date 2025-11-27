'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function ChangelogPage() {
	const [htmlContent, setHtmlContent] = useState<string>('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Load the static HTML changelog
		fetch('/changelog.html')
			.then((res) => {
				if (!res.ok) {
					throw new Error('Failed to load changelog');
				}
				return res.text();
			})
			.then((html) => {
				// Extract the body content from the HTML
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');
				const bodyContent = doc.body.innerHTML;
				setHtmlContent(bodyContent);
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Card className="w-full max-w-md">
					<CardContent className="py-10 px-6">
						<div className="text-center">
							<Spinner className="h-6 w-6 mx-auto mb-3 text-primary" />
							<p className="text-sm text-muted-foreground">Loading changelog...</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold">Changelog</h1>
					<p className="text-muted-foreground">
						History of changes and improvements
					</p>
				</div>
				<Card>
					<CardContent className="p-6">
						<p className="text-destructive">Error loading changelog: {error}</p>
						<p className="text-sm text-muted-foreground mt-2">
							Make sure to run <code className="px-1.5 py-0.5 bg-muted rounded text-xs">pnpm generate-changelog</code> or build the project to generate the changelog.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div
				className="changelog-wrapper"
				dangerouslySetInnerHTML={{ __html: htmlContent }}
				style={{
					// Override inline styles to use theme variables
					color: 'hsl(var(--foreground))',
				}}
			/>
		</div>
	);
}

