import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';

type NameserversSectionProps = {
	nameservers: string[];
	title?: string;
	inline?: boolean;
};

export function NameserversSection({
	nameservers,
	title = 'Cloudflare Nameservers',
	inline = false,
}: NameserversSectionProps) {
	if (!nameservers || nameservers.length === 0) {
		return null;
	}

	const pills = (
		<div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5">
			{nameservers.map((nameserver, index) => (
				<div
					key={index}
					className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 min-w-0"
				>
					<code className="text-xs font-mono truncate">{nameserver}</code>
					<CopyButton
						text={nameserver}
						successMessage={`Copied ${nameserver} to clipboard`}
						errorMessage="Failed to copy nameserver"
						size="sm"
						className="h-5 w-5 shrink-0 p-0"
						title="Copy nameserver"
						copyIconClassName="h-3 w-3"
						checkIconClassName="h-3 w-3"
					/>
				</div>
			))}
		</div>
	);

	if (inline) return pills;

	return (
		<div className="flex flex-col gap-1.5">
			<Label className="text-xs font-medium">{title}</Label>
			{pills}
		</div>
	);
}

