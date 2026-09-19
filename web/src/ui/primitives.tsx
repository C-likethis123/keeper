import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PolymorphicButtonProps<T extends ElementType> = {
	as?: T;
	children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function Button<T extends ElementType = "button">({
	as,
	children,
	className,
	...props
}: PolymorphicButtonProps<T>) {
	const Component = as ?? "button";
	const classes = ["button", className].filter(Boolean).join(" ");

	return (
		<Component className={classes} {...props}>
			{children}
		</Component>
	);
}

export function Page({ children, title }: { children: ReactNode; title: string }) {
	return (
		<main className="page" aria-labelledby="page-title">
			<header className="page__header">
				<p className="eyebrow">Keeper</p>
				<h1 id="page-title">{title}</h1>
			</header>
			{children}
		</main>
	);
}

export function Surface({ children }: { children: ReactNode }) {
	return <section className="surface">{children}</section>;
}
