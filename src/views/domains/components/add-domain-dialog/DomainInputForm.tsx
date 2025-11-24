import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DomainInputFormProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
}

export function DomainInputForm({ value, onChange, onSubmit, disabled }: DomainInputFormProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor="domain-name">Domain Name</Label>
			<Input
				id="domain-name"
				placeholder="example.com"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !disabled) {
						onSubmit();
					}
				}}
				disabled={disabled}
			/>
		</div>
	);
}

