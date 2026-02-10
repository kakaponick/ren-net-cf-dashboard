
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { CloudCheck, CloudOff } from 'lucide-react';
import { VPSIPCombobox } from '@/components/vps-ip-combobox'; // Correct import path

interface RootARecordInputProps {
	ipAddress: string;
	proxied: boolean;
	onIPChange: (ip: string) => void;
	onProxiedChange: (proxied: boolean) => void;
	onSubmit: () => void;
	disabled?: boolean;
}

export function RootARecordInput({
	ipAddress,
	proxied,
	onIPChange,
	onProxiedChange,
	onSubmit,
	disabled
}: RootARecordInputProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor="root-ip">Root A Record (Optional). Proxied: {proxied ? 'Yes' : 'No'}</Label>
			<div className="flex items-center gap-3">
				<div className="flex-1" onKeyDown={(e) => {
					if (e.key === 'Enter' && !disabled) {
						onSubmit();
					}
				}}>
					<VPSIPCombobox
						value={ipAddress}
						onChange={onIPChange}
						disabled={disabled}
						placeholder="Server IP address"
					/>
				</div>
				<Toggle
					id="proxied"
					pressed={proxied}
					onPressedChange={onProxiedChange}
					disabled={disabled}
					variant='outline'
					size='lg'
					title={proxied ? 'Proxied' : 'DNS Only'}
				>
					{proxied ? <CloudCheck className="text-green-500" /> : <CloudOff className="text-white" />}
				</Toggle>
			</div>
			<p className="text-sm text-muted-foreground">
				If provided, a root A record (@) will be created with this IP address for each domain
			</p>
		</div>
	);
}

