import { Activity } from 'react';

type ActivityMode = 'visible' | 'hidden';

type ActivityBoundaryProps = {
		mode?: ActivityMode;
		children: React.ReactElement;
};

export function ActivityBoundary({ mode = 'visible', children }: ActivityBoundaryProps) {
		return <Activity mode={mode}>{children}</Activity>;
}

