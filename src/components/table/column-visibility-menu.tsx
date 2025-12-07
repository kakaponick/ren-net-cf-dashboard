import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export type ColumnVisibilityItem = {
		id: string;
		label: string;
		isVisible: boolean;
		onToggle: (isVisible: boolean) => void;
		disabled?: boolean;
};

type ColumnVisibilityMenuProps = {
		items: ColumnVisibilityItem[];
		triggerLabel?: string;
		className?: string;
};

export function ColumnVisibilityMenu({
		items,
		triggerLabel = 'Columns',
		className
}: ColumnVisibilityMenuProps) {
		return (
				<DropdownMenu>
						<DropdownMenuTrigger asChild>
								<Button
										variant="outline"
										size="sm"
										className={cn('h-8 gap-2', className)}
								>
										<Settings2 className="h-4 w-4" />
										<span>{triggerLabel}</span>
								</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{items.map(({ id, label, isVisible, onToggle, disabled }) => (
										<DropdownMenuCheckboxItem
												key={id}
												className="capitalize"
												checked={isVisible}
												onCheckedChange={(value) => onToggle(Boolean(value))}
												onSelect={(event) => event.preventDefault()}
												disabled={disabled}
										>
												{label}
										</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuContent>
				</DropdownMenu>
		);
}

