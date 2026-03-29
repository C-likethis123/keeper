import React from "react";

interface QueryErrorBoundaryProps {
	children: React.ReactNode;
	fallbackRender: (error: Error, reset: () => void) => React.ReactNode;
}

interface QueryErrorBoundaryState {
	error: Error | null;
}

export default class QueryErrorBoundary extends React.Component<
	QueryErrorBoundaryProps,
	QueryErrorBoundaryState
> {
	state: QueryErrorBoundaryState = {
		error: null,
	};

	static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
		return { error };
	}

	private reset = () => {
		this.setState({ error: null });
	};

	render() {
		if (this.state.error) {
			return this.props.fallbackRender(this.state.error, this.reset);
		}

		return this.props.children;
	}
}
