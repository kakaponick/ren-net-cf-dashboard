import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { copyToClipboard } from '@/lib/utils';

type NameserversSectionProps = {
	nameservers: string[];
	title?: string;
	description?: string;
};

export function NameserversSection({ 
	nameservers, 
	title = 'Cloudflare Nameservers',
	description = 'Replace your current nameservers with these Cloudflare nameservers:'
}: NameserversSectionProps) {
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	if (!nameservers || nameservers.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col gap-4">
			<Label>{title}</Label>
			<div className="space-y-2 rounded-md border p-3 bg-muted/50">
				{description && (
					<p className="text-sm text-muted-foreground mb-2">
						{description}
					</p>
				)}
				{nameservers.map((nameserver, index) => (
					<div
						key={index}
						className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 border"
					>
						<code className="text-sm font-mono flex-1">{nameserver}</code>
						<Button
							size="sm"
							variant="ghost"
							className="h-8 w-8 p-0"
							onClick={async () => {
								await copyToClipboard(nameserver, `Copied ${nameserver} to clipboard`, 'Failed to copy nameserver');
								setCopiedIndex(index);
								setTimeout(() => setCopiedIndex(null), 2000);
							}}
							title="Copy nameserver"
						>
							{copiedIndex === index ? (
								<Check className="h-4 w-4 text-green-600" />
							) : (
								<Copy className="h-4 w-4 opacity-50" />
							)}
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

