import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function useLoadingToast(isLoading: boolean, message: string) {
	const toastId = useRef<string | number | null>(null);

	useEffect(() => {
		if (isLoading && !toastId.current) {
			toastId.current = toast.loading(message);
		} else if (!isLoading && toastId.current) {
			toast.dismiss(toastId.current);
			toastId.current = null;
		}
	}, [isLoading, message]);
}
