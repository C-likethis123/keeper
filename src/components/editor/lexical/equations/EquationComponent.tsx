import type * as React from "react";

import { MathView } from "@/components/editor/lexical/equations/MathView";

export default function EquationComponent({
  equation,
  inline,
	}: {
	  equation: string;
	  inline: boolean;
	}): React.ReactElement {
  return <MathView expression={equation} displayMode={!inline} />;
}
