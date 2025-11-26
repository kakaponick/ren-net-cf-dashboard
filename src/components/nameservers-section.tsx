import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';

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
						<CopyButton
							text={nameserver}
							successMessage={`Copied ${nameserver} to clipboard`}
							errorMessage="Failed to copy nameserver"
							size="sm"
							className="h-8 w-8 p-0"
							title="Copy nameserver"
							copyIconClassName="h-4 w-4"
							checkIconClassName="h-4 w-4"
						/>
					</div>
				))}
			</div>
		</div>
	);
}

