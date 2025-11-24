import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { parseBulkDomains } from '@/lib/utils';

interface BulkDomainInputFormProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

export function BulkDomainInputForm({ value, onChange, disabled }: BulkDomainInputFormProps) {
	const validDomains = parseBulkDomains(value);

	return (
		<div className="space-y-2">
			<Label htmlFor="bulk-domains">Domain Names (one per line)</Label>
			<Textarea
				id="bulk-domains"
				placeholder="example.com&#10;example.org&#10;example.net"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="min-h-[120px] font-mono text-sm"
				disabled={disabled}
			/>
			<p className="text-sm text-muted-foreground">
				Enter one domain per line. Invalid domains will be skipped.
			</p>
			{value.trim() && (
				<p className="text-sm text-muted-foreground">
					Valid domains: {validDomains.length}
				</p>
			)}
		</div>
	);
}

